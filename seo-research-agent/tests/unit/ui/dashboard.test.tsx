// @vitest-environment jsdom

import { act, cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import type { ProjectDto, ResearchDetailResponse, ResearchRunDto } from "@/features/research/types";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: signOutMock }));

const project: ProjectDto = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Acme",
  targetDomain: "example.com",
  description: null,
  countryCode: "US",
  languageCode: "en",
  status: "active",
  version: 1,
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};

const queuedRun: ResearchRunDto = {
  id: "30000000-0000-4000-8000-000000000001",
  projectId: project.id,
  query: "technical seo",
  countryCode: "US",
  languageCode: "en",
  device: "desktop",
  keywordLimit: 100,
  status: "queued",
  version: 1,
  progress: 0,
  keywordCount: 0,
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
  finishedAt: null,
};

const completedRun: ResearchRunDto = {
  ...queuedRun,
  status: "completed",
  progress: 100,
  version: 4,
  keywordCount: 1,
  finishedAt: "2026-10-21T00:01:00.000Z",
};

const keyword = {
  id: 1,
  keyword: "technical seo audit",
  source: "related" as const,
  intent: "commercial" as const,
  searchVolume: 900,
  cpcMicros: 2_500_000,
  competition: 0.4,
  difficulty: 58,
  trend: null,
  countryCode: "US",
  languageCode: "en",
  nicheScore: null,
};

const completedDetail: ResearchDetailResponse = {
  run: completedRun,
  keywords: [keyword],
  nextCursor: null,
  pendingSerpCount: 0,
  analysis: {
    id: "40000000-0000-4000-8000-000000000001",
    status: "completed",
    summary: "Technical audits show measurable demand.",
    output: {
      summary: { statement: "Technical audits show measurable demand.", citationIds: ["kw_1"] },
      opportunitySignals: [{ statement: "Commercial intent is visible.", citationIds: ["kw_1"] }],
      risks: [],
      missingEvidence: [],
      nextSteps: [{ statement: "Validate the leading formats.", citationIds: ["kw_1"] }],
    },
    errorMessage: null,
    updatedAt: "2026-10-21T00:01:10.000Z",
  },
};

const emptySerp = {
  keywordId: 1, status: "completed", nicheScore: 50, hasAiOverview: false, errorMessage: null, fetchedAt: null, results: [],
};

type Handler = (url: URL, init: RequestInit) => Response | Promise<Response>;

/** Routes fetch calls by "METHOD /path"; unmatched calls fail the test loudly. */
function mockApi(routes: Record<string, Handler | Handler[]>) {
  const queues = new Map(Object.entries(routes).map(([key, value]) => [key, [value].flat()]));
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = new URL(String(input), "http://localhost");
    const key = `${init.method ?? "GET"} ${url.pathname}`;
    const queue = queues.get(key);
    // The niche verdict card asks for the seed keyword's SERP; these tests don't assert on it.
    if (!queue?.length && /\/serp\/\d+$/.test(url.pathname)) return json({ serp: emptySerp })();
    if (!queue?.length) throw new Error(`Unexpected request: ${key}`);
    // The last handler repeats so polling can continue indefinitely.
    const handler = queue.length > 1 ? queue.shift()! : queue[0]!;
    return handler(url, init);
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

const json = (value: unknown, status = 200) => () =>
  new Response(JSON.stringify(value), { status, headers: { "content-type": "application/json" } });

const HISTORY = "GET /api/research";
const DETAIL = `GET /api/research/${queuedRun.id}`;

function renderDashboard(projects: ProjectDto[] = [project]) {
  const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
  render(<DashboardClient user={{ name: "Person" }} initialProjects={projects} />);
  return user;
}

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("research dashboard", () => {
  it("invites a first search when the project has no history", async () => {
    mockApi({ [HISTORY]: json({ runs: [] }) });
    renderDashboard();

    expect(await screen.findByText(/Search a topic to see keyword ideas/)).toBeTruthy();
    expect(screen.queryByLabelText("Project")).toBeNull();
  });

  it("submits a search, shows progress, then results with the AI summary", async () => {
    const fetchMock = mockApi({
      [HISTORY]: json({ runs: [] }),
      "POST /api/research": json({ run: queuedRun }, 202),
      [DETAIL]: [json({ ...completedDetail, run: queuedRun, keywords: [], analysis: null }), json(completedDetail)],
    });
    const user = renderDashboard();

    await user.type(screen.getByLabelText("Topic or keyword"), "technical seo");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect(await screen.findByText("Starting search…")).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(2_000));

    const table = await screen.findByRole("table");
    expect(within(table).getByText("technical seo audit")).toBeTruthy();
    expect(within(table).getByText("900")).toBeTruthy();
    expect(within(table).getByText("$2.50")).toBeTruthy();
    expect(screen.getByText("Technical audits show measurable demand.")).toBeTruthy();
    expect(screen.getByText("Validate the leading formats.")).toBeTruthy();
    expect(screen.getByRole("link", { name: "Export CSV" }).getAttribute("href"))
      .toBe(`/api/research/${queuedRun.id}/export`);

    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    const body = JSON.parse(String(post[1]!.body));
    expect(body).toMatchObject({
      projectId: project.id,
      seed: "technical seo",
      countryCode: "US",
      languageCode: "en",
      keywordLimit: 100,
    });
    expect(body.idempotencyKey).toEqual(expect.any(String));
    expect(JSON.stringify(body)).not.toMatch(/owner|role/i);
  });

  it("reopens the latest search on load so results survive a refresh", async () => {
    mockApi({
      [HISTORY]: json({ runs: [completedRun] }),
      [DETAIL]: json(completedDetail),
    });
    renderDashboard();

    expect(await screen.findByRole("heading", { name: "technical seo" })).toBeTruthy();
    expect(await screen.findByText("technical seo audit")).toBeTruthy();
  });

  it("switches between recent searches", async () => {
    const olderRun = {
      ...completedRun,
      id: "30000000-0000-4000-8000-000000000002",
      query: "seo audit tool",
      createdAt: "2026-10-20T00:00:00.000Z",
    };
    mockApi({
      [HISTORY]: json({ runs: [completedRun, olderRun] }),
      [DETAIL]: json(completedDetail),
      [`GET /api/research/${olderRun.id}`]: json({
        ...completedDetail,
        run: olderRun,
        keywords: [{ ...keyword, id: 2, keyword: "best seo audit tool" }],
      }),
    });
    const user = renderDashboard();

    const recent = await screen.findByRole("navigation", { name: "Recent searches" });
    await user.click(within(recent).getByRole("button", { name: "seo audit tool" }));

    expect(await screen.findByText("best seo audit tool")).toBeTruthy();
    expect(within(recent).getByRole("button", { name: "seo audit tool" }).getAttribute("aria-current"))
      .toBe("true");
  });

  it("shows a failed search with a retry that starts a fresh request", async () => {
    const failedRun = {
      ...queuedRun,
      status: "failed" as const,
      errorCode: "PROVIDER_REQUEST_FAILED",
      errorMessage: "Research could not be completed. Try again.",
      finishedAt: "2026-10-21T00:01:00.000Z",
    };
    const retriedRun = { ...queuedRun, id: "30000000-0000-4000-8000-000000000003", createdAt: "2026-10-21T00:02:00.000Z" };
    const fetchMock = mockApi({
      [HISTORY]: json({ runs: [failedRun] }),
      [DETAIL]: json({ run: failedRun, keywords: [], nextCursor: null, analysis: null, pendingSerpCount: 0 }),
      "POST /api/research": json({ run: retriedRun }, 202),
      [`GET /api/research/${retriedRun.id}`]: json({ run: retriedRun, keywords: [], nextCursor: null, analysis: null, pendingSerpCount: 0 }),
    });
    const user = renderDashboard();

    const alert = await screen.findByRole("alert");
    expect(alert.textContent).toContain("Research could not be completed");
    await user.click(within(alert).getByRole("button", { name: "Try again" }));

    await waitFor(() => expect(screen.getByLabelText("Topic or keyword")).toHaveProperty("value", "technical seo"));
    const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST")!;
    expect(JSON.parse(String(post[1]!.body)).seed).toBe("technical seo");
    expect(await screen.findByText("Starting search…")).toBeTruthy();
  });

  it("keeps keyword results when only the AI summary fails", async () => {
    mockApi({
      [HISTORY]: json({ runs: [completedRun] }),
      [DETAIL]: json({
        ...completedDetail,
        analysis: {
          ...completedDetail.analysis!,
          status: "failed",
          summary: null,
          output: null,
          errorMessage: "AI insights could not be generated. Your keyword results are still available.",
        },
      }),
    });
    renderDashboard();

    expect(await screen.findByText("technical seo audit")).toBeTruthy();
    expect(screen.getByText(/AI insights could not be generated/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Export CSV" })).toBeTruthy();
  });

  it("explains a rejected submission such as unconfigured services", async () => {
    mockApi({
      [HISTORY]: json({ runs: [] }),
      "POST /api/research": json({
        error: { code: "RESEARCH_NOT_CONFIGURED", message: "Keyword research isn't available yet. Try again later." },
      }, 503),
    });
    const user = renderDashboard();

    await user.type(screen.getByLabelText("Topic or keyword"), "technical seo");
    await user.click(screen.getByRole("button", { name: "Search" }));

    expect((await screen.findByRole("alert")).textContent)
      .toBe("Keyword research isn't available yet. Try again later.");
  });

  it("keeps polling through a temporary network failure", async () => {
    mockApi({
      [HISTORY]: json({ runs: [queuedRun] }),
      [DETAIL]: [
        json({ run: queuedRun, keywords: [], nextCursor: null, analysis: null, pendingSerpCount: 0 }),
        () => Promise.reject(new TypeError("Failed to fetch")),
        json(completedDetail),
      ],
    });
    renderDashboard();

    expect(await screen.findByText("Starting search…")).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(1_600));
    expect(await screen.findByText("Connection problem. Retrying…")).toBeTruthy();

    await act(() => vi.advanceTimersByTimeAsync(5_100));
    expect(await screen.findByText("technical seo audit")).toBeTruthy();
    expect(screen.queryByText("Connection problem. Retrying…")).toBeNull();
  });

  it("signs out when the session has expired", async () => {
    mockApi({ [HISTORY]: json({ error: { message: "Sign in to continue." } }, 401) });
    renderDashboard();

    await waitFor(() => expect(signOutMock).toHaveBeenCalledWith({ redirectTo: "/sign-in" }));
  });

  it("falls back to another active project when the chosen one is archived", async () => {
    const second = { ...project, id: "20000000-0000-4000-8000-000000000002", name: "Beta" };
    mockApi({
      [HISTORY]: json({ runs: [] }),
      [`PATCH /api/projects/${project.id}`]: json({ project: { ...project, status: "archived", version: 2 } }),
    });
    const user = renderDashboard([project, second]);

    expect((screen.getByLabelText("Project") as HTMLSelectElement).value).toBe(project.id);
    await user.click(screen.getByRole("button", { name: "Projects" }));
    await user.click(screen.getAllByRole("button", { name: "Archive" })[0]!);
    expect(await screen.findByText("Project archived.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Research" }));

    expect(screen.queryByLabelText("Project")).toBeNull();
    expect(screen.getByRole("button", { name: "Search" })).toBeTruthy();
  });

  it("creates a project without sending an owner or role", async () => {
    const fetchMock = mockApi({
      [HISTORY]: json({ runs: [] }),
      "POST /api/projects": json({ project: { ...project, id: "20000000-0000-4000-8000-000000000009", name: "New site" } }, 201),
    });
    const user = renderDashboard();

    await user.click(screen.getByRole("button", { name: "Projects" }));
    await user.type(screen.getByLabelText("Name"), "New site");
    await user.type(screen.getByLabelText("Website (optional)"), "example.com");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    expect(await screen.findByText("Project created.")).toBeTruthy();
    // The original project stays current; the new one is offered with "Open".
    expect(screen.getByText("Current").closest("li")?.textContent).toContain("Acme");
    expect(screen.getByText("New site").closest("li")?.textContent).toContain("Open");
    await user.click(screen.getByRole("button", { name: "Research" }));
    expect((screen.getByLabelText("Project") as HTMLSelectElement).value).toBe(project.id);

    const post = fetchMock.mock.calls.find(([url]) => String(url) === "/api/projects")!;
    expect(JSON.parse(String(post[1]!.body))).toEqual({
      name: "New site",
      targetDomain: "example.com",
      countryCode: "US",
      languageCode: "en",
    });
  });
});

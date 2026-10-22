// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DashboardClient } from "@/components/dashboard/DashboardClient";

const { signOutMock } = vi.hoisted(() => ({ signOutMock: vi.fn() }));
vi.mock("next-auth/react", () => ({ signOut: signOutMock }));

const project = {
  id: "20000000-0000-4000-8000-000000000001",
  name: "Acme",
  targetDomain: "example.com",
  description: null,
  countryCode: "US",
  languageCode: "en",
  status: "active" as const,
  version: 1,
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
};

const queuedRun = {
  id: "30000000-0000-4000-8000-000000000001",
  projectId: project.id,
  query: "technical seo",
  countryCode: "US",
  languageCode: "en",
  device: "desktop" as const,
  keywordLimit: 100,
  status: "queued" as const,
  version: 1,
  progress: 0,
  keywordCount: 0,
  errorCode: null,
  errorMessage: null,
  createdAt: "2026-10-21T00:00:00.000Z",
  updatedAt: "2026-10-21T00:00:00.000Z",
  finishedAt: null,
};

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
  vi.unstubAllGlobals();
});

describe("live research dashboard", () => {
  it("submits research, reports queue state, then renders provider results", async () => {
    const completedRun = {
      ...queuedRun,
      status: "completed" as const,
      progress: 100,
      version: 4,
      keywordCount: 1,
      finishedAt: "2026-10-21T00:01:00.000Z",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ run: queuedRun }, 202))
      .mockResolvedValueOnce(jsonResponse({
        run: completedRun,
        keywords: [{
          id: 1,
          keyword: "technical seo audit",
          source: "related",
          intent: "commercial",
          searchVolume: 900,
          cpcMicros: 2_500_000,
          competition: 0.4,
          difficulty: 58,
        }],
        nextCursor: null,
        analysis: {
          id: "40000000-0000-4000-8000-000000000001",
          status: "completed",
          summary: "Technical audits show measurable demand.",
          output: {
            summary: {
              statement: "Technical audits show measurable demand.",
              citationIds: ["kw_1"],
            },
            opportunitySignals: [{
              statement: "Commercial intent is visible.",
              citationIds: ["kw_1"],
            }],
            risks: [],
            missingEvidence: [],
            nextSteps: [{
              statement: "Validate the leading formats.",
              citationIds: ["kw_1"],
            }],
          },
          errorMessage: null,
          updatedAt: "2026-10-21T00:01:10.000Z",
        },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DashboardClient user={{ name: "Person", role: "user" }} initialProjects={[project]} />);

    await user.type(screen.getByLabelText("Topic or keyword"), "technical seo");
    await user.click(screen.getByRole("button", { name: "Run research" }));

    expect(await screen.findByText("Waiting for a worker")).toBeTruthy();
    const table = await screen.findByRole("table", {}, { timeout: 3_000 });
    expect(within(table).getByText("technical seo audit")).toBeTruthy();
    expect(screen.getByText("Technical audits show measurable demand.")).toBeTruthy();
    expect(screen.getAllByText("technical seo audit").length).toBeGreaterThan(1);
    expect(screen.getByRole("link", { name: "Export CSV" }).getAttribute("href"))
      .toBe(`/api/research/${queuedRun.id}/export`);
  }, 10_000);

  it("shows a clear terminal provider failure", async () => {
    const failedRun = {
      ...queuedRun,
      status: "failed" as const,
      version: 3,
      errorCode: "PROVIDER_REQUEST_FAILED",
      errorMessage: "Research could not be completed. Try again.",
      finishedAt: "2026-10-21T00:01:00.000Z",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ run: queuedRun }, 202))
      .mockResolvedValueOnce(jsonResponse({
        run: failedRun,
        keywords: [],
        nextCursor: null,
        analysis: null,
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DashboardClient user={{ name: "Person", role: "user" }} initialProjects={[project]} />);

    await user.type(screen.getByLabelText("Topic or keyword"), "technical seo");
    await user.click(screen.getByRole("button", { name: "Run research" }));

    const alert = await screen.findByRole("alert", {}, { timeout: 3_000 });
    expect(alert.textContent).toContain("Research could not be completed");
  });

  it("keeps keyword results available when only AI insights fail", async () => {
    const completedRun = {
      ...queuedRun,
      status: "completed" as const,
      progress: 100,
      version: 4,
      keywordCount: 1,
      finishedAt: "2026-10-21T00:01:00.000Z",
    };
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(jsonResponse({ run: queuedRun }, 202))
      .mockResolvedValueOnce(jsonResponse({
        run: completedRun,
        keywords: [{
          id: 1,
          keyword: "technical seo audit",
          source: "related",
          intent: "commercial",
          searchVolume: 900,
          cpcMicros: 2_500_000,
          competition: 0.4,
          difficulty: 58,
        }],
        nextCursor: null,
        analysis: {
          id: "40000000-0000-4000-8000-000000000002",
          status: "failed",
          summary: null,
          output: null,
          errorMessage: "AI insights could not be generated. Your keyword results are still available.",
          updatedAt: "2026-10-21T00:01:10.000Z",
        },
      }));
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DashboardClient user={{ name: "Person", role: "user" }} initialProjects={[project]} />);

    await user.type(screen.getByLabelText("Topic or keyword"), "technical seo");
    await user.click(screen.getByRole("button", { name: "Run research" }));

    expect(await screen.findByText("technical seo audit", {}, { timeout: 4_000 })).toBeTruthy();
    expect(screen.getByText(/AI insights could not be generated/)).toBeTruthy();
    expect(screen.getByRole("link", { name: "Export CSV" })).toBeTruthy();
  }, 10_000);

  it("creates a project without accepting a client-selected role or owner", async () => {
    const fetchMock = vi.fn<typeof fetch>().mockResolvedValueOnce(
      jsonResponse({ project }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup();
    render(<DashboardClient user={{ name: "Person", role: "user" }} initialProjects={[]} />);

    await user.click(screen.getByRole("button", { name: "Create project" }));
    await user.type(screen.getByLabelText("Name"), "Acme");
    await user.type(screen.getByLabelText("Website (optional)"), "example.com");
    await user.click(screen.getByRole("button", { name: "Create project" }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalledOnce());
    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(JSON.parse(String(init.body))).toEqual({
      name: "Acme",
      targetDomain: "example.com",
      countryCode: "US",
      languageCode: "en",
    });
    expect(String(init.body)).not.toMatch(/role|owner/i);
    expect(await screen.findByText("Project created.")).toBeTruthy();
  });
});

function jsonResponse(value: unknown, status = 200) {
  return new Response(JSON.stringify(value), {
    status,
    headers: { "content-type": "application/json" },
  });
}

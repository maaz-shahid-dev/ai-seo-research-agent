// @vitest-environment jsdom

import { act, cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { ContentGapView } from "@/components/dashboard/ContentGapView";
import { KeywordTable } from "@/components/dashboard/KeywordTable";
import { ResearchResults } from "@/components/dashboard/ResearchResults";
import { SerpPanel } from "@/components/dashboard/SerpPanel";
import { describeTrend } from "@/components/ui/Sparkline";
import type { ContentGapDto, KeywordDto, ProjectDto, SerpAnalysisDto } from "@/features/research/types";
import { safeExternalUrl } from "@/lib/url";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

const RUN_ID = "30000000-0000-4000-8000-000000000001";

function keyword(id: number, name: string, overrides: Partial<KeywordDto> = {}): KeywordDto {
  return {
    id, keyword: name, source: "related", intent: "commercial", searchVolume: 1_000 * id,
    cpcMicros: 500_000 * id, competition: 0.2 * id, difficulty: 10 * id,
    trend: [{ month: "2026-02", volume: 300 }, { month: "2026-01", volume: 100 }, { month: "2026-03", volume: 600 }],
    countryCode: "US", languageCode: "en", nicheScore: null, ...overrides,
  };
}

const project: ProjectDto = {
  id: "20000000-0000-4000-8000-000000000001", name: "Acme", targetDomain: null, description: null,
  countryCode: "US", languageCode: "en", status: "active", version: 1,
  createdAt: "2026-10-21T00:00:00.000Z", updatedAt: "2026-10-21T00:00:00.000Z",
};

const serp: SerpAnalysisDto = {
  keywordId: 1, status: "completed", nicheScore: 72, hasAiOverview: true, errorMessage: null, fetchedAt: "2026-10-22T00:00:00.000Z",
  results: [
    { rank: 1, title: "Best shoes thread", url: "https://www.reddit.com/r/running/1", domain: "reddit.com",
      authority: 91, monthlyTraffic: 900_000, domainAgeYears: 20, siteType: "forum", weakSpots: ["forum"], backlinks: 1_000, referringDomains: 400, rankingKeywords: 90_000, isHomepage: false },
    { rank: 2, title: "Evil link", url: "javascript:alert(1)", domain: "smallblog.com",
      authority: 12, monthlyTraffic: 800, domainAgeYears: 0.5, siteType: "other", weakSpots: ["low-authority", "new-site", "low-traffic"], backlinks: 12, referringDomains: 3, rankingKeywords: 85, isHomepage: true },
    { rank: 3, title: "Nike", url: "https://nike.com/shoes", domain: "nike.com",
      authority: 95, monthlyTraffic: 5_000_000, domainAgeYears: 28, siteType: "other", weakSpots: [], backlinks: null, referringDomains: null, rankingKeywords: null, isHomepage: false },
  ],
};

type Handler = (init: RequestInit) => unknown;
function mockApi(routes: Record<string, Handler[]>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const key = `${init.method ?? "GET"} ${String(input)}`;
    const queue = routes[key];
    if (!queue?.length) throw new Error(`Unexpected request: ${key}`);
    const handler = queue.length > 1 ? queue.shift()! : queue[0]!;
    return new Response(JSON.stringify(handler(init)), { status: 200, headers: { "content-type": "application/json" } });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

beforeEach(() => vi.useFakeTimers({ shouldAdvanceTime: true }));
afterEach(() => {
  cleanup();
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("keyword table (niche hunter)", () => {
  const rows = Array.from({ length: 11 }, (_, index) => keyword(index + 1, `keyword ${index + 1}`));

  function names() {
    return screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("button")[0]!.textContent);
  }

  it("sorts by volume, then reverses, then restores the original order", async () => {
    const user = userEvent.setup({ delay: null });
    render(<KeywordTable keywords={rows} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} onSelect={vi.fn()} />);
    const header = screen.getByRole("button", { name: "Volume" });

    await user.click(header);
    expect(names()[0]).toBe("keyword 11");
    expect(header.closest("th")?.getAttribute("aria-sort")).toBe("descending");
    await user.click(header);
    expect(names()[0]).toBe("keyword 1");
    await user.click(header);
    expect(header.closest("th")?.getAttribute("aria-sort")).toBe("none");
  });

  it("filters by maximum difficulty and shows trend, competition and CPC", async () => {
    const user = userEvent.setup({ delay: null });
    render(<KeywordTable keywords={rows} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} onSelect={vi.fn()} />);

    await user.selectOptions(screen.getByLabelText("Maximum difficulty"), "30");
    expect(names()).toEqual(["keyword 1", "keyword 2", "keyword 3"]);
    const first = screen.getAllByRole("row")[1]!;
    expect(within(first).getByRole("img", { name: "Trend: rising" })).toBeTruthy();
    expect(first.textContent).toContain("Low");
    expect(first.textContent).toContain("$0.50");
  });

  it("shows the niche column only once scores exist, sorting nulls last", async () => {
    const user = userEvent.setup({ delay: null });
    const scored = [keyword(1, "a", { nicheScore: 40 }), keyword(2, "b"), keyword(3, "c", { nicheScore: 80 })];
    const { rerender } = render(<KeywordTable keywords={[keyword(1, "a")]} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} onSelect={vi.fn()} />);
    expect(screen.queryByRole("button", { name: "Niche" })).toBeNull();

    rerender(<KeywordTable keywords={scored} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} onSelect={vi.fn()} />);
    await user.click(screen.getByRole("button", { name: "Niche" }));
    expect(names()).toEqual(["c", "a", "b"]);
  });

  it("opens a keyword from its button or row", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<KeywordTable keywords={[keyword(1, "a")]} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} onSelect={onSelect} />);

    await user.click(screen.getByRole("button", { name: "a" }));
    await user.click(screen.getAllByRole("cell")[1]!);
    expect(onSelect).toHaveBeenCalledTimes(2);
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 1 }));
  });
});

describe("SERP panel", () => {
  it("requests the analysis, polls until ready, and shows authority, traffic, age and weak spots", async () => {
    const url = `/api/research/${RUN_ID}/serp/1`;
    const fetchMock = mockApi({
      [`POST ${url}`]: [() => ({ serp: { ...serp, status: "queued", results: [], nicheScore: null } })],
      [`GET ${url}`]: [() => ({ serp })],
    });
    render(<SerpPanel runId={RUN_ID} keyword={keyword(1, "running shoes")} onClose={vi.fn()} />);

    expect(await screen.findByText("Analyzing the top 10…")).toBeTruthy();
    await act(() => vi.advanceTimersByTimeAsync(2_100));
    const list = await screen.findByRole("list");

    expect(fetchMock.mock.calls[0]![1]).toMatchObject({ method: "POST" });
    expect(within(list).getAllByRole("listitem")).toHaveLength(3);
    expect(within(list).getByText("Forum")).toBeTruthy();
    expect(within(list).getByText("Low authority")).toBeTruthy();
    expect(within(list).getByText("<1 yr")).toBeTruthy();
    expect(screen.getByText("2 of 3 are weak spots")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("72/100")).toBeTruthy();
    expect(within(screen.getByRole("dialog")).getByText("Maybe — still possible")).toBeTruthy();
    expect(within(list).getByText("Dedicated site")).toBeTruthy();
    expect(within(list).getByText("Lowest authority")).toBeTruthy();
  });

  it("never renders unsafe provider URLs as links", async () => {
    mockApi({ [`POST /api/research/${RUN_ID}/serp/1`]: [() => ({ serp })] });
    render(<SerpPanel runId={RUN_ID} keyword={keyword(1, "running shoes")} onClose={vi.fn()} />);

    await screen.findByRole("list");
    expect(screen.queryByRole("link", { name: /Evil link/ })).toBeNull();
    expect(screen.getByRole("link", { name: /Best shoes thread/ }).getAttribute("rel")).toBe("noopener noreferrer");
  });

  it("shows failures and closes with Escape", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onClose = vi.fn();
    mockApi({
      [`POST /api/research/${RUN_ID}/serp/1`]: [() => ({ serp: { ...serp, status: "failed", results: [], errorMessage: "SERP data is unavailable." } })],
    });
    render(<SerpPanel runId={RUN_ID} keyword={keyword(1, "running shoes")} onClose={onClose} />);

    expect((await screen.findByRole("alert")).textContent).toBe("SERP data is unavailable.");
    await user.keyboard("{Escape}");
    expect(onClose).toHaveBeenCalledOnce();
  });
});

describe("content gap", () => {
  const gap: ContentGapDto = {
    status: "completed", targetDomain: "acme.com", competitors: ["rival.com", "other.com"], errorMessage: null,
    keywords: [{ keyword: "trail shoes guide", searchVolume: 4_400, difficulty: 22, cpcMicros: 900_000, competitorDomain: "rival.com", competitorRank: 3 }],
  };

  it("asks for the website first and saves it on the project", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    const onProjectUpdate = vi.fn();
    const fetchMock = mockApi({
      [`PATCH /api/projects/${project.id}`]: [() => ({ project: { ...project, targetDomain: "acme.com", version: 2 } })],
    });
    render(<ContentGapView runId={RUN_ID} project={project} onProjectUpdate={onProjectUpdate} />);

    await user.type(screen.getByLabelText("Your website"), "acme.com");
    await user.click(screen.getByRole("button", { name: "Find gaps" }));

    expect(JSON.parse(String(fetchMock.mock.calls[0]![1]!.body))).toEqual({ targetDomain: "acme.com", version: 1 });
    expect(onProjectUpdate).toHaveBeenCalledWith(expect.objectContaining({ targetDomain: "acme.com" }));
  });

  it("lists keywords competitors rank for", async () => {
    mockApi({ [`POST /api/research/${RUN_ID}/content-gap`]: [() => ({ contentGap: gap })] });
    render(<ContentGapView runId={RUN_ID} project={{ ...project, targetDomain: "acme.com" }} onProjectUpdate={vi.fn()} />);

    const row = (await screen.findByText("trail shoes guide")).closest("tr")!;
    expect(row.textContent).toContain("4,400");
    expect(row.textContent).toContain("rival.com #3");
    expect(screen.getByText(/Compared with rival.com, other.com/)).toBeTruthy();
  });

  it("explains an empty gap", async () => {
    mockApi({ [`POST /api/research/${RUN_ID}/content-gap`]: [() => ({ contentGap: { ...gap, keywords: [] } })] });
    render(<ContentGapView runId={RUN_ID} project={{ ...project, targetDomain: "acme.com" }} onProjectUpdate={vi.fn()} />);

    expect(await screen.findByText(/No gaps found/)).toBeTruthy();
  });
});

describe("result tabs", () => {
  it("switches to question keywords with the keyboard and opens the SERP panel", async () => {
    const user = userEvent.setup({ advanceTimers: vi.advanceTimersByTime });
    mockApi({ [`POST /api/research/${RUN_ID}/serp/2`]: [() => ({ serp: { ...serp, keywordId: 2 } })] });
    render(
      <ResearchResults
        runId={RUN_ID}
        analysis={null}
        project={project}
        onProjectUpdate={vi.fn()}
        keywords={[keyword(1, "running shoes"), keyword(2, "how to lace running shoes")]}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    expect(screen.getByRole("tab", { name: "Questions 1" })).toBeTruthy();
    screen.getByRole("tab", { name: "Keywords 2" }).focus();
    await user.keyboard("{ArrowRight}");
    expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Questions 1" }));
    expect(screen.getByRole("tab", { name: "Questions 1" }).getAttribute("aria-selected")).toBe("true");
    expect(screen.queryByRole("button", { name: "running shoes" })).toBeNull();

    await user.click(screen.getByRole("button", { name: "how to lace running shoes" }));
    expect(await screen.findByRole("dialog", { name: /how to lace running shoes/ })).toBeTruthy();
  });
});

describe("helpers", () => {
  it("describes trends", () => {
    expect(describeTrend([1])).toBe("No trend data");
    expect(describeTrend([100, 100, 100, 150, 150, 150])).toBe("Trend: rising");
    expect(describeTrend([150, 150, 100, 100])).toBe("Trend: falling");
    expect(describeTrend([100, 105, 100, 104])).toBe("Trend: stable");
    expect(describeTrend([0, 0, 5])).toBe("Trend: rising");
  });

  it("allows only http(s) external URLs", () => {
    expect(safeExternalUrl("https://a.com/x")).toBe("https://a.com/x");
    expect(safeExternalUrl("http://a.com")).toBe("http://a.com/");
    expect(safeExternalUrl("javascript:alert(1)")).toBeNull();
    expect(safeExternalUrl("data:text/html,x")).toBeNull();
    expect(safeExternalUrl("not a url")).toBeNull();
  });
});

describe("SERP panel errors", () => {
  it("shows a non-retryable error without an endless spinner", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ error: { message: "Research not found." } }), { status: 404 }),
    ));
    render(<SerpPanel runId={RUN_ID} keyword={keyword(1, "running shoes")} onClose={vi.fn()} />);

    expect((await screen.findByRole("alert")).textContent).toBe("Research not found.");
    expect(screen.queryByText("Analyzing the top 10…")).toBeNull();
  });
});

describe("niche verdict card", () => {
  it("shows the verdict, authority spread, AI Overview and revenue for the seed keyword", async () => {
    const easySerp = {
      ...serp,
      results: [
        { ...serp.results[1]!, rank: 1, authority: 5 },
        { ...serp.results[1]!, rank: 2, authority: 12, isHomepage: false },
        { ...serp.results[1]!, rank: 3, authority: 18, isHomepage: false },
        { ...serp.results[0]!, rank: 4 },
      ],
    };
    mockApi({ [`POST /api/research/${RUN_ID}/serp/1`]: [() => ({ serp: easySerp })] });
    render(
      <ResearchResults
        runId={RUN_ID}
        analysis={null}
        project={project}
        onProjectUpdate={vi.fn()}
        keywords={[keyword(1, "running shoes", { source: "seed", searchVolume: 100_000 })]}
        hasMore={false}
        loadingMore={false}
        onLoadMore={vi.fn()}
      />,
    );

    const card = await screen.findByRole("region", { name: /Is “running shoes” easy to rank for\?/ });
    expect(await within(card).findByText("Ideal — low-hanging fruit")).toBeTruthy();
    expect(card.textContent).toContain("3 sites under authority 20 in the top 10, 1 dedicated site ranking");
    expect(within(card).getByText("Yes")).toBeTruthy();
    expect(card.textContent).toContain("$784");
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  getResearchRunById: vi.fn(),
  getLatestAiAnalysisForRun: vi.fn(),
  listNicheScores: vi.fn(),
  listKeywordResults: vi.fn(),
}));
vi.mock("@/server/db/repositories", () => mocks);

import { buildResearchReport, reportToMarkdown } from "@/features/research/report";
import type { KeywordDto, ResearchRunDto } from "@/features/research/types";
import { loadReportData } from "@/server/research/report";

const run = {
  id: "30000000-0000-4000-8000-000000000001", projectId: "p", query: "betta fish tank", countryCode: "GB", languageCode: "en",
  device: "desktop", keywordLimit: 100, status: "completed", version: 1, progress: 100, keywordCount: 4, errorCode: null,
  errorMessage: null, createdAt: "2026-10-22T10:00:00.000Z", updatedAt: "2026-10-22T10:00:00.000Z", finishedAt: null,
} as ResearchRunDto;

const keyword = (id: number, name: string, searchVolume: number, difficulty: number, source: KeywordDto["source"] = "related"): KeywordDto => ({
  id, keyword: name, source, intent: "informational", searchVolume, cpcMicros: 1_000_000, competition: null, difficulty,
  trend: null, countryCode: "GB", languageCode: "en", nicheScore: null, allintitleCount: null,
});

const keywords = [
  keyword(1, "betta fish tank", 9_000, 50, "seed"),
  keyword(2, "best betta fish tank", 3_000, 30),
  keyword(3, "how to clean a betta fish tank", 1_200, 12),
  keyword(4, "betta fish tank | setup", 400, 8),
];

describe("research report", () => {
  it("summarizes stats, opportunities, coverage and the content plan", () => {
    const report = buildResearchReport(run, keywords, null);
    expect(report).toMatchObject({ title: "betta fish tank", market: "United Kingdom", stats: { keywords: 4, monthlySearches: 13_600, averageDifficulty: 25 }, summary: null });
    expect(report.topOpportunities).toHaveLength(4);
    expect(report.topOpportunities[0]).toMatchObject({ tier: "Prime" });
    expect(report.coverage.map((group) => group.label)).toContain("Questions");
    expect(report.clusters.length).toBeGreaterThan(0);
  });

  it("writes Markdown that tables and headings can't be broken by keyword text", () => {
    const markdown = reportToMarkdown(buildResearchReport(run, keywords, null));
    expect(markdown.startsWith("# Niche report: betta fish tank\n")).toBe(true);
    expect(markdown).toContain("United Kingdom · October 22, 2026");
    expect(markdown).toContain("| Keyword | Opportunity | Volume | KD |");
    expect(markdown).toContain("betta fish tank / setup");
    expect(markdown).not.toContain("tank | setup");
    expect(markdown).not.toContain("## Summary");
    expect(markdown.endsWith("\n")).toBe(true);
  });
});

describe("report loader", () => {
  const stored = (id: number) => ({
    id, ownerId: "u", runId: run.id, keyword: `kw ${id}`, normalizedKeyword: `kw ${id}`, source: "related", provider: "dataforseo",
    providerRequestId: null, retrievedAt: new Date(), intent: "informational", countryCode: "GB", languageCode: "en", searchVolume: 10,
    cpcMicros: null, competition: null, difficulty: 5, trend: null, allintitleCount: null, allintitleCheckedAt: null, createdAt: new Date(),
  });

  beforeEach(() => {
    vi.clearAllMocks();
    mocks.getResearchRunById.mockResolvedValue({ ...run, configuration: { keywordLimit: 100 }, createdAt: new Date(run.createdAt), updatedAt: new Date(), finishedAt: null });
    mocks.getLatestAiAnalysisForRun.mockResolvedValue(null);
    mocks.listNicheScores.mockResolvedValue(new Map());
  });

  it("loads every keyword page for the owner's finished search", async () => {
    mocks.listKeywordResults
      .mockResolvedValueOnce({ items: [stored(1), stored(2)], nextCursor: 2 })
      .mockResolvedValueOnce({ items: [stored(3)], nextCursor: null });
    const data = await loadReportData({} as never, "u", run.id);
    expect(data?.keywords.map((item) => item.id)).toEqual([1, 2, 3]);
    expect(mocks.getResearchRunById).toHaveBeenCalledWith({}, "u", run.id);
    expect(mocks.listKeywordResults).toHaveBeenLastCalledWith({}, "u", run.id, { afterId: 2, limit: 250 });
  });

  it("returns nothing for missing or unfinished searches and stops at the page cap", async () => {
    mocks.getResearchRunById.mockResolvedValueOnce(null);
    expect(await loadReportData({} as never, "u", run.id)).toBeNull();
    mocks.getResearchRunById.mockResolvedValueOnce({ ...run, status: "running" });
    expect(await loadReportData({} as never, "u", run.id)).toBeNull();

    mocks.listKeywordResults.mockResolvedValue({ items: [stored(1)], nextCursor: 1 });
    await loadReportData({} as never, "u", run.id);
    expect(mocks.listKeywordResults).toHaveBeenCalledTimes(4);
  });
});

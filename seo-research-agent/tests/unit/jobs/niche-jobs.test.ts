import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ProviderError extends Error {
    constructor(public provider: string, public code: string, message: string, public retryable: boolean) {
      super(message);
    }
  }
  return {
    database: { kind: "database" },
    ProviderError,
    claimSerpAnalysis: vi.fn(),
    completeSerpAnalysis: vi.fn(),
    failSerpAnalysis: vi.fn(),
    findStaleDomains: vi.fn(),
    getDomainMetrics: vi.fn(),
    getKeywordResult: vi.fn(),
    getProviderMarket: vi.fn(),
    getSerpAnalysisById: vi.fn(),
    upsertDomainMetrics: vi.fn(),
    claimContentGap: vi.fn(),
    completeContentGap: vi.fn(),
    failContentGap: vi.fn(),
    getContentGapById: vi.fn(),
    getResearchRunById: vi.fn(),
    listRunSerpDomains: vi.fn(),
    getOrganicSerp: vi.fn(),
    getDomainMetricsFromProvider: vi.fn(),
    getDomainIntersection: vi.fn(),
  };
});

vi.mock("@/server/jobs/client", () => ({
  inngest: { createFunction: vi.fn((opts: unknown, fn: unknown) => ({ opts, fn })) },
}));
vi.mock("@/server/db/client", () => ({ getDatabase: () => mocks.database }));
vi.mock("@/server/db/repositories", () => ({
  claimSerpAnalysis: mocks.claimSerpAnalysis,
  completeSerpAnalysis: mocks.completeSerpAnalysis,
  failSerpAnalysis: mocks.failSerpAnalysis,
  findStaleDomains: mocks.findStaleDomains,
  getDomainMetrics: mocks.getDomainMetrics,
  getKeywordResult: mocks.getKeywordResult,
  getProviderMarket: mocks.getProviderMarket,
  getSerpAnalysisById: mocks.getSerpAnalysisById,
  upsertDomainMetrics: mocks.upsertDomainMetrics,
  claimContentGap: mocks.claimContentGap,
  completeContentGap: mocks.completeContentGap,
  failContentGap: mocks.failContentGap,
  getContentGapById: mocks.getContentGapById,
  getResearchRunById: mocks.getResearchRunById,
  listRunSerpDomains: mocks.listRunSerpDomains,
}));
vi.mock("@/server/providers", () => ({
  ProviderError: mocks.ProviderError,
  createDataForSeoClient: () => ({
    getOrganicSerp: mocks.getOrganicSerp,
    getDomainMetrics: mocks.getDomainMetricsFromProvider,
    getDomainIntersection: mocks.getDomainIntersection,
  }),
}));
vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));

import { processContentGap } from "@/server/jobs/content-gap";
import { processSerpAnalysis } from "@/server/jobs/serp";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const RUN_ID = "30000000-0000-4000-8000-000000000001";
const ANALYSIS_ID = "50000000-0000-4000-8000-000000000001";
const REPORT_ID = "60000000-0000-4000-8000-000000000001";

type Handler = (input: { event: { id: string; data: unknown }; step: { run: (id: string, fn: () => unknown) => Promise<unknown> } }) => Promise<unknown>;
const runSerp = (processSerpAnalysis as unknown as { fn: Handler }).fn;
const runGap = (processContentGap as unknown as { fn: Handler }).fn;

function context(data: unknown) {
  const steps: string[] = [];
  return {
    steps,
    input: { event: { id: "event-1", data }, step: { run: async (id: string, fn: () => unknown) => { steps.push(id); return fn(); } } },
  };
}

const market = { locationCode: 2_840, languageCode: "en" };
const serpItems = [
  { rank: 1, title: "Reddit", url: "https://www.reddit.com/r/x", domain: "www.reddit.com", description: null, rankAbsolute: 1 },
  { rank: 2, title: "Blog", url: "https://tinyblog.com/", domain: "tinyblog.com", description: null, rankAbsolute: 2 },
  { rank: null, title: "Ad", url: null, domain: "ads.com", description: null, rankAbsolute: null },
];

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProviderMarket.mockResolvedValue(market);
});

describe("SERP analysis worker", () => {
  beforeEach(() => {
    mocks.claimSerpAnalysis.mockResolvedValue({ id: ANALYSIS_ID, keywordResultId: 7, version: 2 });
    mocks.getKeywordResult.mockResolvedValue({ keyword: "beginner shoes", difficulty: 30, countryCode: "US", languageCode: "en" });
    mocks.getOrganicSerp.mockResolvedValue({ taskId: "task-9", features: ["organic", "ai_overview"], items: serpItems });
    mocks.findStaleDomains.mockResolvedValue(["tinyblog.com"]);
    mocks.getDomainMetricsFromProvider.mockResolvedValue({ cost: 0.1, items: [{ domain: "tinyblog.com", authority: 8 }] });
    mocks.getDomainMetrics.mockResolvedValue([
      { domain: "reddit.com", authority: 91, monthlyTraffic: 1e6, registeredAt: new Date("2005-01-01"), backlinks: 1, referringDomains: 1 },
      { domain: "tinyblog.com", authority: 8, monthlyTraffic: 500, registeredAt: null, backlinks: 1, referringDomains: 1 },
    ]);
    mocks.completeSerpAnalysis.mockResolvedValue({ nicheScore: 55 });
  });

  it("fetches the SERP, refreshes only stale domains, scores and completes", async () => {
    const { input } = context({ version: 1, ownerId: OWNER_ID, runId: RUN_ID, analysisId: ANALYSIS_ID });

    await expect(runSerp(input)).resolves.toEqual({ status: "completed", nicheScore: 55 });

    expect(mocks.getOrganicSerp).toHaveBeenCalledWith({ keyword: "beginner shoes", locationCode: 2_840, languageCode: "en", depth: 10, device: "desktop" });
    expect(mocks.findStaleDomains).toHaveBeenCalledWith(mocks.database, ["reddit.com", "tinyblog.com"]);
    expect(mocks.getDomainMetricsFromProvider).toHaveBeenCalledWith({ domains: ["tinyblog.com"] });
    expect(mocks.upsertDomainMetrics).toHaveBeenCalledWith(mocks.database, [{ domain: "tinyblog.com", authority: 8 }]);
    const [, analysis, worker, stored] = mocks.completeSerpAnalysis.mock.calls[0]!;
    expect(analysis).toEqual({ id: ANALYSIS_ID, ownerId: OWNER_ID, runId: RUN_ID, keywordResultId: 7, version: 2 });
    expect(worker).toBe("event-1");
    // Difficulty 30 → 35 easiness points; both sites are weak (forum, low authority) → 20.
    expect(stored).toMatchObject({ providerRequestId: "task-9", hasAiOverview: true, nicheScore: 55 });
    expect(stored.results.map((result: { rank: number }) => result.rank)).toEqual([1, 2]);
  });

  it("skips the provider when every domain is cached", async () => {
    mocks.findStaleDomains.mockResolvedValue([]);
    await runSerp(context({ version: 1, ownerId: OWNER_ID, runId: RUN_ID, analysisId: ANALYSIS_ID }).input);
    expect(mocks.getDomainMetricsFromProvider).not.toHaveBeenCalled();
  });

  it("does nothing when another worker holds the analysis", async () => {
    mocks.claimSerpAnalysis.mockResolvedValue(null);
    await expect(runSerp(context({ version: 1, ownerId: OWNER_ID, runId: RUN_ID, analysisId: ANALYSIS_ID }).input))
      .resolves.toEqual({ status: "skipped" });
    expect(mocks.getOrganicSerp).not.toHaveBeenCalled();
  });

  it("stops retrying on non-retryable provider errors", async () => {
    mocks.getOrganicSerp.mockRejectedValue(new mocks.ProviderError("dataforseo", "PROVIDER_INVALID_INPUT", "bad", false));
    await expect(runSerp(context({ version: 1, ownerId: OWNER_ID, runId: RUN_ID, analysisId: ANALYSIS_ID }).input))
      .rejects.toMatchObject({ name: "NonRetriableError" });
  });

  it("rejects malformed events without touching the database", async () => {
    await expect(runSerp(context({ version: 1, ownerId: "x" }).input)).rejects.toMatchObject({ name: "NonRetriableError" });
    expect(mocks.claimSerpAnalysis).not.toHaveBeenCalled();
  });

  it("marks the analysis failed when retries are exhausted, only if it still holds the lease", async () => {
    const onFailure = (processSerpAnalysis as unknown as { opts: { onFailure: (input: unknown) => Promise<void> } }).opts.onFailure;
    const failure = { event: { data: { event: { id: "event-1", data: { version: 1, ownerId: OWNER_ID, runId: RUN_ID, analysisId: ANALYSIS_ID } } } } };

    mocks.getSerpAnalysisById.mockResolvedValue({ id: ANALYSIS_ID, status: "running", leaseOwner: "someone-else", version: 3 });
    await onFailure(failure);
    expect(mocks.failSerpAnalysis).not.toHaveBeenCalled();

    mocks.getSerpAnalysisById.mockResolvedValue({ id: ANALYSIS_ID, status: "running", leaseOwner: "event-1", version: 3 });
    await onFailure(failure);
    expect(mocks.failSerpAnalysis).toHaveBeenCalledWith(mocks.database, expect.objectContaining({ id: ANALYSIS_ID }), "event-1", "JOB_RETRIES_EXHAUSTED", expect.any(String));
  });
});

describe("content gap worker", () => {
  beforeEach(() => {
    mocks.claimContentGap.mockResolvedValue({ id: REPORT_ID, version: 2, targetDomain: "myblog.com" });
    mocks.getResearchRunById.mockResolvedValue({ query: "running shoes", countryCode: "US", languageCode: "en" });
    mocks.getDomainIntersection.mockImplementation(async ({ competitorDomain }: { competitorDomain: string }) => ({
      items: [{ keyword: `${competitorDomain} keyword`, searchVolume: 100, cpc: 1.5, keywordDifficulty: 20, competitorRank: 3 }],
    }));
    mocks.completeContentGap.mockImplementation(async (_db, _report, _worker, input) => ({ keywords: input.keywords }));
  });

  it("compares the target with competitors from analyzed SERPs, one step per competitor", async () => {
    mocks.listRunSerpDomains.mockResolvedValue([
      { domain: "runrepeat.com", rank: 1 }, { domain: "www.reddit.com", rank: 1 }, { domain: "myblog.com", rank: 2 },
    ]);
    const { input, steps } = context({ version: 1, ownerId: OWNER_ID, runId: RUN_ID, reportId: REPORT_ID });

    await expect(runGap(input)).resolves.toEqual({ status: "completed", keywords: 1 });

    expect(mocks.getOrganicSerp).not.toHaveBeenCalled();
    expect(mocks.getDomainIntersection).toHaveBeenCalledWith({
      competitorDomain: "runrepeat.com", targetDomain: "myblog.com", locationCode: 2_840, languageCode: "en", limit: 100,
    });
    expect(steps).toContain("gap-runrepeat.com");
    const [, , , stored] = mocks.completeContentGap.mock.calls[0]!;
    expect(stored).toEqual({
      competitors: ["runrepeat.com"],
      keywords: [{ keyword: "runrepeat.com keyword", searchVolume: 100, difficulty: 20, cpcMicros: 1_500_000, competitorDomain: "runrepeat.com", competitorRank: 3 }],
    });
  });

  it("falls back to the seed keyword's SERP when nothing has been analyzed", async () => {
    mocks.listRunSerpDomains.mockResolvedValue([]);
    mocks.getOrganicSerp.mockResolvedValue({ items: [{ rank: 1, domain: "solereview.com" }, { rank: 2, domain: "quora.com" }] });

    await runGap(context({ version: 1, ownerId: OWNER_ID, runId: RUN_ID, reportId: REPORT_ID }).input);

    expect(mocks.getOrganicSerp).toHaveBeenCalledWith(expect.objectContaining({ keyword: "running shoes" }));
    expect(mocks.getDomainIntersection).toHaveBeenCalledTimes(1);
    expect(mocks.getDomainIntersection).toHaveBeenCalledWith(expect.objectContaining({ competitorDomain: "solereview.com" }));
  });

  it("fails cleanly for unsupported markets", async () => {
    mocks.getProviderMarket.mockResolvedValue(null);
    await expect(runGap(context({ version: 1, ownerId: OWNER_ID, runId: RUN_ID, reportId: REPORT_ID }).input))
      .resolves.toEqual({ status: "failed" });
    expect(mocks.failContentGap).toHaveBeenCalledWith(mocks.database, expect.objectContaining({ id: REPORT_ID }), "event-1", "MARKET_NOT_SUPPORTED", expect.any(String));
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => {
  class ProviderError extends Error {
    constructor(
      public provider: string,
      public code: string,
      message: string,
      public retryable: boolean,
    ) {
      super(message);
    }
  }

  return {
    database: { kind: "database" },
    ProviderError,
    claimResearchRun: vi.fn(),
    countKeywordResults: vi.fn(),
    failResearchRunAfterExhaustion: vi.fn(),
    finishResearchRun: vi.fn(),
    getProviderMarket: vi.fn(),
    getResearchRunById: vi.fn(),
    insertKeywordResults: vi.fn(),
    listKeywordResults: vi.fn(),
    queueAiAnalysis: vi.fn(),
    requestTopSerpAnalyses: vi.fn(),
    updateResearchRunProgress: vi.fn(),
    expandWithAutocomplete: vi.fn(),
    getKeywordIdeas: vi.fn(),
    getOpenAiEnvironment: vi.fn(),
    dispatchOutboxEventNow: vi.fn(),
  };
});

vi.mock("@/server/jobs/client", () => ({
  inngest: {
    createFunction: vi.fn((opts: unknown, fn: unknown) => ({ opts, fn })),
  },
}));
vi.mock("@/server/db/client", () => ({ getDatabase: () => mocks.database }));
vi.mock("@/server/db/repositories", () => ({
  claimResearchRun: mocks.claimResearchRun,
  countKeywordResults: mocks.countKeywordResults,
  failResearchRunAfterExhaustion: mocks.failResearchRunAfterExhaustion,
  finishResearchRun: mocks.finishResearchRun,
  getProviderMarket: mocks.getProviderMarket,
  getResearchRunById: mocks.getResearchRunById,
  insertKeywordResults: mocks.insertKeywordResults,
  listKeywordResults: mocks.listKeywordResults,
  queueAiAnalysis: mocks.queueAiAnalysis,
  requestTopSerpAnalyses: mocks.requestTopSerpAnalyses,
  updateResearchRunProgress: mocks.updateResearchRunProgress,
}));
vi.mock("@/server/config/environment", () => ({
  getOpenAiEnvironment: mocks.getOpenAiEnvironment,
}));
vi.mock("@/server/providers", () => ({
  ProviderError: mocks.ProviderError,
  createDataForSeoClient: () => ({ getKeywordIdeas: mocks.getKeywordIdeas }),
}));
vi.mock("@/server/jobs/autocomplete-expansion", () => ({
  expandWithAutocomplete: mocks.expandWithAutocomplete,
}));
vi.mock("@/server/jobs/dispatch", () => ({
  dispatchOutboxEventNow: mocks.dispatchOutboxEventNow,
}));
vi.mock("@/server/logging/logger", () => ({
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() },
}));

import { processResearch } from "@/server/jobs/research";

const OWNER_ID = "10000000-0000-4000-8000-000000000001";
const RUN_ID = "30000000-0000-4000-8000-000000000001";
const ANALYSIS_ID = "40000000-0000-4000-8000-000000000001";
const SERP_ANALYSIS_ID = "50000000-0000-4000-8000-000000000001";

type Handler = (input: {
  event: { id: string; data: unknown };
  step: { run: (id: string, fn: () => unknown) => Promise<unknown> };
}) => Promise<unknown>;

const handler = (processResearch as unknown as { fn: Handler }).fn;

describe("research worker", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestTopSerpAnalyses.mockResolvedValue([{ id: SERP_ANALYSIS_ID }]);
    mocks.expandWithAutocomplete.mockResolvedValue({ queries: 50, failedQueries: 0, added: 12 });
    mocks.claimResearchRun.mockResolvedValue({
      version: 2,
      query: "technical seo",
      countryCode: "US",
      languageCode: "en",
      configuration: { keywordLimit: 100 },
    });
    mocks.getProviderMarket.mockResolvedValue({ locationCode: 2840, languageCode: "en" });
    mocks.getKeywordIdeas.mockResolvedValue({
      taskId: "provider-task-1",
      items: [{
        keyword: "technical seo",
        intent: "commercial",
        searchVolume: 900,
        cpc: 2.5,
        competition: 0.4,
        keywordDifficulty: 58,
        monthlySearches: [{ year: 2026, month: 9, searchVolume: 850 }],
      }],
    });
    mocks.updateResearchRunProgress
      .mockResolvedValueOnce({ version: 3 })
      .mockResolvedValueOnce({ version: 4 });
    mocks.insertKeywordResults.mockResolvedValue({ insertedCount: 1, duplicateCount: 0 });
    mocks.listKeywordResults.mockResolvedValue({
      items: [{
        id: 43,
        keyword: "technical seo",
        source: "seed",
        intent: "commercial",
        searchVolume: 900,
        cpcMicros: 2_500_000,
        competition: "0.4000",
        difficulty: 58,
      }],
      nextCursor: null,
    });
    mocks.countKeywordResults.mockResolvedValue(1);
    mocks.getOpenAiEnvironment.mockReturnValue({ OPENAI_MODEL: "gpt-test" });
    mocks.queueAiAnalysis.mockResolvedValue({ id: ANALYSIS_ID, status: "queued" });
    mocks.finishResearchRun.mockResolvedValue({ status: "completed", keywordCount: 1 });
    mocks.dispatchOutboxEventNow.mockResolvedValue(true);
  });

  it("persists provider results, queues analysis, and only then completes the run", async () => {
    const result = await handler(context(validEvent()));

    expect(result).toEqual({ status: "completed", keywordCount: 1, analysisId: ANALYSIS_ID });
    expect(mocks.insertKeywordResults).toHaveBeenCalledWith(
      mocks.database,
      OWNER_ID,
      RUN_ID,
      [expect.objectContaining({
        keyword: "technical seo",
        source: "seed",
        cpcMicros: 2_500_000,
        trend: [{ month: "2026-09", volume: 850 }],
      })],
    );
    expect(mocks.queueAiAnalysis).toHaveBeenCalledWith(
      mocks.database,
      OWNER_ID,
      RUN_ID,
      expect.objectContaining({ model: "gpt-test", inputHash: expect.stringMatching(/^[a-f0-9]{64}$/) }),
    );
    expect(mocks.finishResearchRun).toHaveBeenCalledWith(
      mocks.database,
      OWNER_ID,
      RUN_ID,
      4,
      "event-1",
      { status: "completed", keywordCount: 1 },
    );
    expect(mocks.dispatchOutboxEventNow).toHaveBeenCalledWith(
      OWNER_ID,
      ANALYSIS_ID,
      "analysis.requested",
    );
    expect(mocks.queueAiAnalysis.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.finishResearchRun.mock.invocationCallOrder[0]!);
    // Niche Hunter: the top opportunities are analyzed automatically after completion.
    expect(mocks.requestTopSerpAnalyses).toHaveBeenCalledWith(mocks.database, OWNER_ID, RUN_ID, 10);
    expect(mocks.dispatchOutboxEventNow).toHaveBeenCalledWith(OWNER_ID, SERP_ANALYSIS_ID, "serp.requested");
    expect(mocks.finishResearchRun.mock.invocationCallOrder[0])
      .toBeLessThan(mocks.requestTopSerpAnalyses.mock.invocationCallOrder[0]!);
  });

  it("completes an empty result without spending AI quota", async () => {
    mocks.listKeywordResults.mockResolvedValue({ items: [], nextCursor: null });
    mocks.countKeywordResults.mockResolvedValue(0);
    mocks.finishResearchRun.mockResolvedValue({ status: "completed", keywordCount: 0 });

    const result = await handler(context(validEvent()));

    expect(result).toMatchObject({ status: "completed", keywordCount: 0, analysisId: null });
    expect(mocks.getOpenAiEnvironment).not.toHaveBeenCalled();
    expect(mocks.queueAiAnalysis).not.toHaveBeenCalled();
    expect(mocks.requestTopSerpAnalyses).not.toHaveBeenCalled();
  });

  it("fails a claimed run with a safe message when the market is unsupported", async () => {
    mocks.getProviderMarket.mockResolvedValue(null);
    mocks.finishResearchRun.mockResolvedValue({ status: "failed" });

    const result = await handler(context(validEvent()));

    expect(result).toEqual({ status: "failed", reason: "market-not-supported" });
    expect(mocks.finishResearchRun).toHaveBeenCalledWith(
      mocks.database,
      OWNER_ID,
      RUN_ID,
      2,
      "event-1",
      {
        status: "failed",
        errorCode: "MARKET_NOT_SUPPORTED",
        errorMessage: "This market is not available yet.",
      },
    );
    expect(mocks.getKeywordIdeas).not.toHaveBeenCalled();
  });

  it("rejects malformed events before touching the database", async () => {
    await expect(handler(context({ ownerId: "not-a-uuid" }))).rejects.toThrow(
      "The research event payload is invalid.",
    );
    expect(mocks.claimResearchRun).not.toHaveBeenCalled();
  });
});

function validEvent() {
  return { version: 1, ownerId: OWNER_ID, runId: RUN_ID };
}

function context(data: unknown) {
  return {
    event: { id: "event-1", data },
    step: {
      run: async (_id: string, fn: () => unknown) => fn(),
    },
  };
}

describe("research worker autocomplete enrichment", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requestTopSerpAnalyses.mockResolvedValue([]);
    mocks.claimResearchRun.mockResolvedValue({ version: 2, query: "technical seo", countryCode: "US", languageCode: "en", configuration: { keywordLimit: 100 } });
    mocks.getProviderMarket.mockResolvedValue({ locationCode: 2_840, languageCode: "en" });
    mocks.getKeywordIdeas.mockResolvedValue({ taskId: "t", items: [{ keyword: "technical seo audit", searchVolume: 10, cpc: null, competition: null, competitionLevel: null, keywordDifficulty: null, intent: null, monthlySearches: [] }] });
    mocks.updateResearchRunProgress.mockResolvedValue({ version: 3 });
    mocks.insertKeywordResults.mockResolvedValue({ insertedCount: 1, duplicateCount: 0 });
    mocks.listKeywordResults.mockResolvedValue({ items: [], nextCursor: null });
    mocks.countKeywordResults.mockResolvedValue(1);
    mocks.finishResearchRun.mockResolvedValue({ status: "completed", keywordCount: 1 });
  });

  it("expands with the seed, existing ideas and market", async () => {
    mocks.expandWithAutocomplete.mockResolvedValue({ queries: 50, failedQueries: 0, added: 3 });
    await handler(context(validEvent()));
    expect(mocks.expandWithAutocomplete).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      seed: "technical seo", existingKeywords: ["technical seo audit"], locationCode: 2_840, languageCode: "en", countryCode: "US",
    }));
  });

  it("still completes the run when autocomplete fails", async () => {
    mocks.expandWithAutocomplete.mockRejectedValue(new Error("provider down"));
    await expect(handler(context(validEvent()))).resolves.toMatchObject({ status: "completed" });
    expect(mocks.finishResearchRun).toHaveBeenCalled();
  });
});

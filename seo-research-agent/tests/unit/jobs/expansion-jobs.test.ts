import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  database: { kind: "database" },
  insertKeywordResults: vi.fn(),
}));

vi.mock("@/server/jobs/client", () => ({ inngest: { createFunction: vi.fn((opts: unknown, fn: unknown) => ({ opts, fn })) } }));
vi.mock("@/server/db/client", () => ({ getDatabase: () => mocks.database }));
vi.mock("@/server/db/repositories", () => ({ insertKeywordResults: mocks.insertKeywordResults }));
vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/server/providers", () => ({ ProviderError: class extends Error {}, createOpenAiAnalysisClient: vi.fn() }));

import { expandWithAutocomplete } from "@/server/jobs/autocomplete-expansion";
import { settleWithConcurrency } from "@/server/jobs/concurrency";
import { acceptableNicheIdeas } from "@/server/jobs/daily-niches";
import type { DataForSeoClient } from "@/server/providers";

beforeEach(() => {
  vi.clearAllMocks();
  mocks.insertKeywordResults.mockImplementation(async (_db, _owner, _run, rows: unknown[]) => ({ insertedCount: rows.length }));
});

describe("concurrency helper", () => {
  it("keeps order, limits parallelism and isolates failures", async () => {
    let active = 0;
    let peak = 0;
    const results = await settleWithConcurrency([1, 2, 3, 4, 5], 2, async (value) => {
      active += 1;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setTimeout(resolve, 5));
      active -= 1;
      if (value === 3) throw new Error("boom");
      return value * 10;
    });

    expect(peak).toBe(2);
    expect(results.map((result) => (result.ok ? result.value : "failed"))).toEqual([10, 20, "failed", 40, 50]);
    expect(await settleWithConcurrency([], 4, async () => 1)).toEqual([]);
  });
});

describe("autocomplete expansion", () => {
  function client(overrides: Partial<DataForSeoClient> = {}) {
    return {
      getAutocomplete: vi.fn(async ({ keyword }: { keyword: string }) => {
        if (keyword === "running shoes z") throw new Error("provider hiccup");
        if (keyword === "running shoes f") return { cost: 0.002, suggestions: ["running shoes for flat feet", "running shoes for women"] };
        if (keyword === "how running shoes") return { cost: 0.002, suggestions: ["how running shoes should fit", "running man"] };
        return { cost: 0.002, suggestions: ["running shoes"] };
      }),
      getKeywordOverview: vi.fn(async () => ({
        cost: 0.01,
        items: [{ keyword: "running shoes for flat feet", searchVolume: 22_200, cpc: 0.98, competition: 0.4, competitionLevel: "MEDIUM", keywordDifficulty: 38, intent: "commercial" as const, monthlySearches: [] }],
      })),
      ...overrides,
    } as unknown as DataForSeoClient;
  }

  const input = {
    ownerId: "owner", runId: "run", seed: "running shoes", existingKeywords: ["running shoes", "running shoes for women"],
    locationCode: 2_840, languageCode: "en", countryCode: "US",
  };

  it("stores only new, relevant suggestions with metrics where known", async () => {
    const provider = client();
    const result = await expandWithAutocomplete(provider, input);

    expect(result).toMatchObject({ added: 2, failedQueries: 1 });
    expect(result.queries).toBeGreaterThan(40);
    expect(provider.getKeywordOverview).toHaveBeenCalledWith({
      keywords: ["running shoes for flat feet", "how running shoes should fit"], locationCode: 2_840, languageCode: "en",
    });
    const rows = mocks.insertKeywordResults.mock.calls[0]![3];
    expect(rows).toEqual([
      expect.objectContaining({ keyword: "running shoes for flat feet", source: "autocomplete", searchVolume: 22_200, difficulty: 38, cpcMicros: 980_000 }),
      expect.objectContaining({ keyword: "how running shoes should fit", source: "autocomplete", searchVolume: null, intent: "unknown" }),
    ]);
  });

  it("skips the metrics call when nothing new was suggested", async () => {
    const provider = client({ getAutocomplete: vi.fn(async () => ({ cost: 0, suggestions: ["running shoes for women"] })) } as Partial<DataForSeoClient>);
    await expect(expandWithAutocomplete(provider, input)).resolves.toMatchObject({ added: 0 });
    expect(provider.getKeywordOverview).not.toHaveBeenCalled();
    expect(mocks.insertKeywordResults).not.toHaveBeenCalled();
  });
});

describe("daily niche ideas", () => {
  const idea = (seedKeyword: string, niche = seedKeyword, problem = "a real problem") => ({ niche, seedKeyword, problem, audience: "hobbyists" });

  it("keeps specific, safe, new ideas only", () => {
    const accepted = acceptableNicheIdeas([
      idea("sourdough starter problems"),
      idea("casino bonus tips"),
      idea("aquarium"),
      idea("betta fish tank setup"),
      idea("Betta Fish Tank Setup"),
      idea("crypto tax tips"),
      idea("houseplant pest control"),
    ], ["houseplant pest control"]);

    expect(accepted.map((item) => item.seedKeyword)).toEqual(["sourdough starter problems", "betta fish tank setup"]);
  });
});

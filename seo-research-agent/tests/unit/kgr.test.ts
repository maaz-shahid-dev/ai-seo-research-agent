import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  listKeywordResultsByIds: vi.fn(),
  saveAllintitleCounts: vi.fn(),
  getProviderMarket: vi.fn(),
  getOrganicSerp: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/server/db/repositories", () => ({
  listKeywordResultsByIds: mocks.listKeywordResultsByIds,
  saveAllintitleCounts: mocks.saveAllintitleCounts,
  getProviderMarket: mocks.getProviderMarket,
}));
vi.mock("@/server/providers", () => ({ createDataForSeoClient: () => ({ getOrganicSerp: mocks.getOrganicSerp }) }));
vi.mock("@/server/logging/logger", () => ({ logger: { warn: mocks.warn, info: vi.fn(), error: vi.fn() } }));

import { allintitleQuery, isKgrCandidate, kgrRatio, kgrRating } from "@/features/research/kgr";
import type { ResearchRun } from "@/server/db/schema";
import { checkAllintitleCounts } from "@/server/research/kgr";

describe("keyword golden ratio", () => {
  it("only applies to keywords with 1–250 monthly searches", () => {
    expect(isKgrCandidate({ searchVolume: 250 })).toBe(true);
    expect(isKgrCandidate({ searchVolume: 251 })).toBe(false);
    expect(isKgrCandidate({ searchVolume: 0 })).toBe(false);
    expect(isKgrCandidate({ searchVolume: null })).toBe(false);
  });

  it("computes and rates the ratio", () => {
    expect(kgrRatio(20, 200)).toBe(0.1);
    expect(kgrRatio(null, 200)).toBeNull();
    expect(kgrRatio(5, 0)).toBeNull();
    expect(kgrRating(0.24)).toBe("great");
    expect(kgrRating(0.25)).toBe("ok");
    expect(kgrRating(1)).toBe("ok");
    expect(kgrRating(1.01)).toBe("poor");
  });

  it("builds an allintitle query that quotes can't break", () => {
    expect(allintitleQuery("  betta  tank \"setup\" ")).toBe("allintitle:betta tank setup");
  });
});

describe("allintitle checks", () => {
  const run = { id: "run-1", countryCode: "GB", languageCode: "en" } as ResearchRun;
  const keyword = (id: number, text: string, searchVolume: number | null, allintitleCount: number | null = null) =>
    ({ id, keyword: text, searchVolume, allintitleCount });
  const beforeLookups = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    beforeLookups.mockResolvedValue(undefined);
    mocks.getProviderMarket.mockResolvedValue({ locationCode: 2_826, languageCode: "en" });
    mocks.getOrganicSerp.mockImplementation(async ({ keyword: query }: { keyword: string }) => {
      if (query.includes("broken")) throw new Error("timeout");
      return { totalResults: query.length };
    });
  });

  it("looks up only unchecked low-volume keywords and stores the counts", async () => {
    mocks.listKeywordResultsByIds.mockResolvedValue([
      keyword(1, "betta tank", 120), keyword(2, "betta", 40_000), keyword(3, "betta care", 80, 7), keyword(4, "broken one", 50),
    ]);

    const result = await checkAllintitleCounts({ database: {} as never, ownerId: "u", run, keywordIds: [1, 2, 3, 4], beforeLookups });

    expect(beforeLookups).toHaveBeenCalledOnce();
    expect(mocks.getProviderMarket).toHaveBeenCalledWith({}, "dataforseo", "GB", "en");
    expect(mocks.getOrganicSerp).toHaveBeenCalledTimes(2);
    expect(mocks.getOrganicSerp).toHaveBeenCalledWith(expect.objectContaining({ keyword: "allintitle:betta tank", locationCode: 2_826 }));
    expect(mocks.saveAllintitleCounts).toHaveBeenCalledWith({}, "u", "run-1", [{ keywordResultId: 1, allintitleCount: "allintitle:betta tank".length }]);
    expect(result).toEqual({
      keywords: [{ id: 1, allintitleCount: 21 }, { id: 3, allintitleCount: 7 }, { id: 4, allintitleCount: null }],
      failed: 1,
    });
    expect(mocks.warn).toHaveBeenCalled();
  });

  it("skips paid lookups, limits and checks when everything is already checked", async () => {
    mocks.listKeywordResultsByIds.mockResolvedValue([keyword(3, "betta care", 80, 7)]);
    const result = await checkAllintitleCounts({ database: {} as never, ownerId: "u", run, keywordIds: [3], beforeLookups });
    expect(result).toEqual({ keywords: [{ id: 3, allintitleCount: 7 }], failed: 0 });
    expect(beforeLookups).not.toHaveBeenCalled();
    expect(mocks.getOrganicSerp).not.toHaveBeenCalled();
  });

  it("stops before any lookup when the limit check or market fails", async () => {
    mocks.listKeywordResultsByIds.mockResolvedValue([keyword(1, "betta tank", 120)]);
    beforeLookups.mockRejectedValueOnce(new Error("rate limited"));
    await expect(checkAllintitleCounts({ database: {} as never, ownerId: "u", run, keywordIds: [1], beforeLookups })).rejects.toThrow("rate limited");

    mocks.getProviderMarket.mockResolvedValue(null);
    await expect(checkAllintitleCounts({ database: {} as never, ownerId: "u", run, keywordIds: [1], beforeLookups })).rejects.toMatchObject({ code: "MARKET_NOT_SUPPORTED" });
    expect(mocks.getOrganicSerp).not.toHaveBeenCalled();
  });
});

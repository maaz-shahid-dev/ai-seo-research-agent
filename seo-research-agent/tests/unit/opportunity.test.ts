import { describe, expect, it } from "vitest";

import { opportunityScore, rankOpportunities } from "@/features/research/opportunity";

const input = (overrides: Partial<Parameters<typeof opportunityScore>[0]> = {}) => ({
  searchVolume: 1_000, difficulty: 30, cpcMicros: 1_500_000, nicheScore: 60, ...overrides,
});

describe("opportunity score", () => {
  it("rewards demand, low difficulty, weak SERPs and CPC", () => {
    const base = opportunityScore(input())!;
    expect(opportunityScore(input({ searchVolume: 50_000 }))).toBeGreaterThan(base);
    expect(opportunityScore(input({ difficulty: 5 }))).toBeGreaterThan(base);
    expect(opportunityScore(input({ nicheScore: 95 }))).toBeGreaterThan(base);
    expect(opportunityScore(input({ cpcMicros: 4_000_000 }))).toBeGreaterThan(base);
    expect(opportunityScore(input({ searchVolume: 1_000_000, difficulty: 0, nicheScore: 100, cpcMicros: 99_000_000 }))).toBe(100);
  });

  it("handles zero volume, missing metrics and out-of-range values", () => {
    expect(opportunityScore(input({ searchVolume: 0, difficulty: 100, nicheScore: 0, cpcMicros: 0 }))).toBe(0);
    expect(opportunityScore(input({ searchVolume: null }))).toBeNull();
    // Missing CPC and SERP data: only volume and difficulty count, rescaled.
    const partial = opportunityScore(input({ cpcMicros: null, nicheScore: null }))!;
    expect(partial).toBeGreaterThanOrEqual(0);
    expect(partial).toBeLessThanOrEqual(100);
    expect(opportunityScore(input({ difficulty: 140, nicheScore: -5 }))).toBeGreaterThanOrEqual(0);
  });
});

describe("opportunity tiers", () => {
  it("spreads tiers by percentile within the search", () => {
    const keywords = Array.from({ length: 20 }, (_, index) => ({ id: index + 1, ...input({ difficulty: 80 - index * 4 }) }));
    const tiers = [...rankOpportunities(keywords).values()].map((item) => item.tier);
    expect(tiers.filter((tier) => tier === "prime")).toHaveLength(3);
    expect(tiers.filter((tier) => tier === "solid")).toHaveLength(5);
    expect(tiers.filter((tier) => tier === "tough")).toHaveLength(7);
    expect(tiers.filter((tier) => tier === "fortress")).toHaveLength(5);
    expect(rankOpportunities(keywords).get(20)!.tier).toBe("prime");
  });

  it("gives equal scores the same tier and skips unscored keywords", () => {
    const same = Array.from({ length: 10 }, (_, index) => ({ id: index + 1, ...input() }));
    expect(new Set([...rankOpportunities(same).values()].map((item) => item.tier))).toEqual(new Set(["prime"]));
    const ranked = rankOpportunities([{ id: 1, ...input() }, { id: 2, ...input({ searchVolume: null }) }]);
    expect(ranked.has(2)).toBe(false);
    expect(ranked.get(1)!.tier).toBe("prime");
    expect(rankOpportunities([])).toEqual(new Map());
  });
});

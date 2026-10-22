import { describe, expect, it } from "vitest";

import { compareKeywordSets } from "@/features/research/compare";

const kw = (keyword: string, searchVolume: number | null, difficulty: number | null = 10) => ({ keyword, searchVolume, difficulty });

describe("compare searches", () => {
  it("splits keywords into only-A, only-B and both, sorted by volume", () => {
    const result = compareKeywordSets(
      [kw("Betta Tank", 900, 20), kw("betta food", 300), kw("betta  tank", 1)],
      [kw("betta tank", 1_200, 35), kw("betta care", 2_000), kw("betta lifespan", null)],
    );
    expect(result.both).toEqual([{ keyword: "betta tank", a: { searchVolume: 900, difficulty: 20 }, b: { searchVolume: 1_200, difficulty: 35 } }]);
    expect(result.onlyA.map((row) => row.keyword)).toEqual(["betta food"]);
    expect(result.onlyB.map((row) => row.keyword)).toEqual(["betta care", "betta lifespan"]);
  });

  it("handles empty and different-size searches", () => {
    expect(compareKeywordSets([], [])).toEqual({ onlyA: [], onlyB: [], both: [] });
    const big = Array.from({ length: 300 }, (_, index) => kw(`topic ${index}`, index));
    const result = compareKeywordSets(big, big.slice(0, 10));
    expect(result.both).toHaveLength(10);
    expect(result.onlyA).toHaveLength(290);
    expect(result.onlyB).toHaveLength(0);
  });
});

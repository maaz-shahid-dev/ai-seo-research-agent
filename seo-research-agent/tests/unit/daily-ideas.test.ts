import { describe, expect, it } from "vitest";

import { DEFAULT_IDEA_FILTERS, filterAndSortIdeas, hasLowAuthorityGap, ideaOpportunity } from "@/features/research/daily-ideas";
import type { NicheIdeaDto } from "@/features/research/types";

const idea = (id: string, overrides: Partial<NicheIdeaDto> = {}): NicheIdeaDto => ({
  id, niche: id, seedKeyword: id, problem: "p", audience: "a", nicheType: "info", countryCode: "US",
  searchVolume: 1_000, difficulty: 30, lowAuthorityCount: 2, ideaDate: "2026-10-22", reaction: null, ...overrides,
});

describe("daily idea ranking", () => {
  it("rewards beatable sites first, then demand and low difficulty", () => {
    const beatable = ideaOpportunity({ searchVolume: 1_000, difficulty: 30, lowAuthorityCount: 6 });
    const popular = ideaOpportunity({ searchVolume: 100_000, difficulty: 30, lowAuthorityCount: 0 });
    expect(beatable).toBeGreaterThan(popular);
    expect(ideaOpportunity({ searchVolume: 1_000, difficulty: 10, lowAuthorityCount: 2 }))
      .toBeGreaterThan(ideaOpportunity({ searchVolume: 1_000, difficulty: 80, lowAuthorityCount: 2 }));
    expect(ideaOpportunity({ searchVolume: null, difficulty: null, lowAuthorityCount: null })).toBeLessThan(20);
    expect(ideaOpportunity({ searchVolume: 10_000_000, difficulty: 0, lowAuthorityCount: 10 })).toBe(100);
  });

  it("needs three or more low-authority sites for the Low DR filter", () => {
    expect(hasLowAuthorityGap({ lowAuthorityCount: 3 })).toBe(true);
    expect(hasLowAuthorityGap({ lowAuthorityCount: 2 })).toBe(false);
    expect(hasLowAuthorityGap({ lowAuthorityCount: null })).toBe(false);
  });

  it("filters by type, country and low DR, and sorts without mutating", () => {
    const ideas = [
      idea("a", { nicheType: "tools", countryCode: "GB", lowAuthorityCount: 4, difficulty: 50 }),
      idea("b", { searchVolume: 9_000, difficulty: null }),
      idea("c", { countryCode: "GB", searchVolume: null, difficulty: 5, lowAuthorityCount: 3 }),
    ];
    const copy = [...ideas];

    expect(filterAndSortIdeas(ideas, { ...DEFAULT_IDEA_FILTERS, countryCode: "GB" }).map((item) => item.id)).toEqual(["a", "c"]);
    expect(filterAndSortIdeas(ideas, { ...DEFAULT_IDEA_FILTERS, nicheType: "tools" }).map((item) => item.id)).toEqual(["a"]);
    expect(filterAndSortIdeas(ideas, { ...DEFAULT_IDEA_FILTERS, lowAuthorityOnly: true }).map((item) => item.id)).toEqual(["a", "c"]);
    expect(filterAndSortIdeas(ideas, { ...DEFAULT_IDEA_FILTERS, sort: "volume" }).map((item) => item.id)).toEqual(["b", "a", "c"]);
    expect(filterAndSortIdeas(ideas, { ...DEFAULT_IDEA_FILTERS, sort: "difficulty" }).map((item) => item.id)).toEqual(["c", "a", "b"]);
    expect(ideas).toEqual(copy);
  });
});

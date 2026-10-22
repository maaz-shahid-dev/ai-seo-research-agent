import { describe, expect, it } from "vitest";

import { mergeGapKeywords, pickCompetitors, siteMetricsFor, type StoredDomainMetrics } from "@/features/research/serp";

describe("site metrics", () => {
  const now = new Date("2026-10-22T00:00:00.000Z");
  const cache = new Map<string, StoredDomainMetrics>([
    ["wikipedia.org", { domain: "wikipedia.org", authority: 97, backlinks: 10, referringDomains: 5, monthlyTraffic: 900, registeredAt: new Date("2001-01-13T00:00:00.000Z") }],
  ]);

  it("joins subdomains to their registrable domain and computes age in years", () => {
    expect(siteMetricsFor("en.wikipedia.org", cache, now)).toEqual({
      domain: "wikipedia.org", authority: 97, monthlyTraffic: 900, backlinks: 10, referringDomains: 5, domainAgeYears: 25.8,
    });
  });

  it("leaves unknown domains with null metrics", () => {
    expect(siteMetricsFor("new.blog", cache, now)).toMatchObject({ domain: "new.blog", authority: null, domainAgeYears: null });
  });
});

describe("competitor picking", () => {
  it("prefers domains that rank often and high, skipping the target, forums and portals", () => {
    const results = [
      { domain: "www.runrepeat.com", rank: 1 },
      { domain: "runrepeat.com", rank: 4 },
      { domain: "solereview.com", rank: 2 },
      { domain: "www.reddit.com", rank: 1 },
      { domain: "en.wikipedia.org", rank: 1 },
      { domain: "myblog.com", rank: 1 },
      { domain: "rei.com", rank: 9 },
      { domain: null, rank: 1 },
    ];
    expect(pickCompetitors(results, "www.myblog.com")).toEqual(["runrepeat.com", "solereview.com", "rei.com"]);
    expect(pickCompetitors(results, "myblog.com", 1)).toEqual(["runrepeat.com"]);
    expect(pickCompetitors([], "myblog.com")).toEqual([]);
  });
});

describe("gap keyword merging", () => {
  const item = (keyword: string, competitorRank: number, searchVolume: number | null, competitorDomain = "a.com") =>
    ({ keyword, competitorRank, searchVolume, difficulty: null, cpcMicros: null, competitorDomain });

  it("keeps the best competitor rank per keyword and sorts by volume", () => {
    const merged = mergeGapKeywords([
      [item("Wide feet shoes", 5, 1_000), item("drop explained", 2, null)],
      [item("wide feet shoes", 2, 1_000, "b.com"), item("heavy runners", 3, 9_900)],
    ]);
    expect(merged.map((row) => [row.keyword, row.competitorDomain, row.competitorRank])).toEqual([
      ["heavy runners", "a.com", 3],
      ["wide feet shoes", "b.com", 2],
      ["drop explained", "a.com", 2],
    ]);
  });

  it("caps the list", () => {
    expect(mergeGapKeywords([[item("a", 1, 3), item("b", 1, 2), item("c", 1, 1)]], 2)).toHaveLength(2);
  });
});

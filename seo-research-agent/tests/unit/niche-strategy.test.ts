import { describe, expect, it } from "vitest";

import { buildAutocompleteQueries, selectNewSuggestions } from "@/features/research/autocomplete";
import { buildContentPlan, coverageSize } from "@/features/research/coverage";
import { iskillsChecklist, lowestAuthoritySites, type ChecklistSite } from "@/features/research/iskills";
import { restrictedNiche } from "@/features/research/restricted";

describe("autocomplete expansion", () => {
  it("builds seed, a–z, question and modifier queries", () => {
    const queries = buildAutocompleteQueries("  Running Shoes ");
    const text = queries.map((query) => query.query);
    expect(text[0]).toBe("running shoes");
    expect(text).toContain("running shoes a");
    expect(text).toContain("running shoes z");
    expect(text).toContain("how running shoes");
    expect(text).toContain("running shoes for");
    expect(text).toContain("best running shoes");
    expect(new Set(text).size).toBe(text.length);
    expect(queries.length).toBeLessThanOrEqual(55);
    expect(buildAutocompleteQueries("  ")).toEqual([]);
  });

  it("keeps only new, relevant, bounded suggestions", () => {
    const selected = selectNewSuggestions(
      "running shoes",
      ["Running Shoes for Women", "running shoe for flat feet", "running man", "running shoes", "running shoes for women", "x".repeat(90) + " running shoes"],
      ["running shoes"],
    );
    expect(selected).toEqual(["running shoes for women", "running shoe for flat feet"]);
    expect(selectNewSuggestions("shoes", ["shoes a", "shoes b", "shoes c"], [], 2)).toEqual(["shoes a", "shoes b"]);
  });
});

describe("content plan", () => {
  const kw = (keyword: string, searchVolume: number, difficulty: number | null = 20) => ({ keyword, searchVolume, difficulty, intent: "informational" });

  it("groups keywords by their strongest topic word and labels article types", () => {
    const plan = buildContentPlan("running shoes", [
      kw("running shoes", 10_000, 70),
      kw("running shoes for flat feet", 2_000),
      kw("best flat feet running shoes", 1_000),
      kw("best running shoes for women", 3_000),
      kw("women running shoes", 900),
      kw("how to clean running shoes", 500),
      kw("how to clean white running shoes", 200),
    ]);
    const byTopic = new Map(plan.clusters.map((cluster) => [cluster.topic, cluster]));

    expect(plan.clusters[0]).toMatchObject({ articleType: "pillar", mainKeyword: "running shoes" });
    expect(byTopic.get("flat")?.keywords.map((item) => item.keyword)).toEqual(["running shoes for flat feet", "best flat feet running shoes"]);
    expect(byTopic.get("women")).toMatchObject({ totalVolume: 3_900, mainKeyword: "best running shoes for women" });
    expect(byTopic.get("clean")).toMatchObject({ articleType: "how-to" });
    expect(plan.pages).toBe(4);
    expect(plan.size).toBe("small");
  });

  it("sizes coverage", () => {
    expect(coverageSize(10)).toBe("small");
    expect(coverageSize(60)).toBe("manageable");
    expect(coverageSize(61)).toBe("large");
  });
});

describe("niches to avoid", () => {
  it.each([
    ["best betting apps", "gambling"],
    ["online casino bonus", "gambling"],
    ["windows 11 crack", "piracy"],
    ["free movies download", "downloads"],
    ["mp3 song download", "downloads"],
    ["diabetes symptoms for beginners", "health"],
    ["investing for beginners", "finance"],
    ["credit card for students", "finance"],
  ])("flags %s as %s", (text, category) => {
    expect(restrictedNiche(text)?.category).toBe(category);
  });

  it.each(["bearded dragon tank setup", "running shoes for flat feet", "sourdough starter problems", "betta fish tank"])(
    "allows %s", (text) => {
      expect(restrictedNiche(text)).toBeNull();
    },
  );
});

describe("iSkills checklist", () => {
  const site = (domain: string, authority: number | null, extra: Partial<ChecklistSite> = {}): ChecklistSite => ({
    domain, authority, monthlyTraffic: 50_000, domainAgeYears: 10, referringDomains: 50, rankingKeywords: 100,
    isHomepage: false, siteType: "other", ...extra,
  });
  const keywords = [{ keyword: "how to set up a bearded dragon tank" }, { keyword: "bearded dragon tank size" }];

  it("passes a specific niche with beatable, young, small and dedicated sites", () => {
    const result = iskillsChecklist({
      seed: "bearded dragon tank setup",
      seedVolume: 8_000,
      keywords,
      contentPages: 25,
      serp: {
        hasAiOverview: false,
        results: [
          site("tinyreptiles.com", 8, { domainAgeYears: 1, monthlyTraffic: 900, isHomepage: true }),
          site("dragoncare.blog", 15, { monthlyTraffic: 4_000 }),
          site("reptilecorner.net", 20),
          site("petco.com", 85, { referringDomains: 90_000 }),
        ],
      },
    });
    const status = Object.fromEntries(result.items.map((item) => [item.id, item.status]));

    expect(status).toMatchObject({
      avoid: "pass", specific: "pass", problem: "pass", "start-small": "pass", beatable: "pass",
      "ai-overview": "pass", young: "pass", "small-sites": "pass", dedicated: "pass", coverage: "pass",
      backlinks: "pass", volume: "pass",
    });
    expect(result.verdict).toBe("go");
    expect(result.weakestSites.map((weak) => weak.domain)).toEqual(["tinyreptiles.com", "dragoncare.blog", "reptilecorner.net"]);
  });

  it("rejects restricted and broad niches and marks unanalyzed checks unknown", () => {
    const result = iskillsChecklist({ seed: "casino", seedVolume: 500_000, keywords: [{ keyword: "casino" }], contentPages: 200, serp: null });
    const byId = Object.fromEntries(result.items.map((item) => [item.id, item]));

    expect(byId.avoid).toMatchObject({ status: "fail", detail: expect.stringContaining("gambling") });
    expect(byId.specific!.status).toBe("fail");
    expect(byId.beatable!.status).toBe("unknown");
    expect(byId["ai-overview"]!.status).toBe("unknown");
    expect(byId.coverage!.status).toBe("warn");
    expect(result.verdict).toBe("avoid");
  });

  it("warns about AI Overviews and strong page-1 competition", () => {
    const result = iskillsChecklist({
      seed: "running shoes", seedVolume: 246_000, keywords: [{ keyword: "running shoes" }], contentPages: 40,
      serp: { hasAiOverview: true, results: [site("nike.com", 95), site("runnersworld.com", 84)] },
    });
    const byId = Object.fromEntries(result.items.map((item) => [item.id, item.status]));
    expect(byId).toMatchObject({ "ai-overview": "warn", beatable: "fail", "start-small": "warn", specific: "warn" });
    expect(result.verdict).not.toBe("go");
  });

  it("finds the weakest sites with known authority", () => {
    expect(lowestAuthoritySites([{ authority: null }, { authority: 40 }, { authority: 5 }], 2)).toEqual([{ authority: 5 }, { authority: 40 }]);
  });
});

describe("autocomplete queries for topics that already have a modifier", () => {
  it("never asks for doubled modifiers", () => {
    const queries = buildAutocompleteQueries("best ai tools").map((item) => item.query);
    expect(queries).not.toContain("best best ai tools");
    expect(queries).toContain("cheap best ai tools");
    expect(buildAutocompleteQueries("garden ideas").map((item) => item.query)).not.toContain("garden ideas ideas");
  });
});

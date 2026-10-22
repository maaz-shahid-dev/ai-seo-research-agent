import { afterEach, describe, expect, it, vi } from "vitest";

import { isDemoMode, listMissingResearchKeys } from "@/server/config/environment-schema";
import { acceptableNicheIdeas } from "@/server/jobs/daily-niches";
import { createDemoDataForSeoClient, demoDomainMetrics } from "@/server/providers/demo/dataforseo";
import { createDemoOpenAiClient } from "@/server/providers/demo/openai";
import { hashString, seededRandom } from "@/server/providers/demo/random";
import { researchAnalysisSchema } from "@/server/providers/types";

vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn() } }));
vi.mock("@/server/jobs/client", () => ({ inngest: { createFunction: vi.fn((opts: unknown, fn: unknown) => ({ opts, fn })) } }));

afterEach(() => vi.unstubAllEnvs());

const market = { locationCode: 2_840, languageCode: "en" };

describe("seeded randomness", () => {
  it("is deterministic per seed and stays in range", () => {
    const a = seededRandom("x");
    const b = seededRandom("x");
    const values = Array.from({ length: 50 }, () => a.int(3, 7));
    expect(values).toEqual(Array.from({ length: 50 }, () => b.int(3, 7)));
    expect(values.every((value) => value >= 3 && value <= 7)).toBe(true);
    expect(hashString("a")).not.toBe(hashString("b"));
  });
});

describe("demo DataForSEO client", () => {
  const client = createDemoDataForSeoClient();

  it("returns the same plausible keyword ideas for the same topic", async () => {
    const first = await client.getKeywordIdeas({ keywords: ["Running Shoes"], ...market, limit: 100 });
    const second = await client.getKeywordIdeas({ keywords: ["running shoes"], ...market, limit: 100 });

    expect(first.items).toEqual(second.items);
    expect(first.items[0]!.keyword).toBe("running shoes");
    expect(first.items.length).toBeGreaterThanOrEqual(20);
    for (const item of first.items) {
      expect(item.keyword).toContain("running shoes");
      const words = item.keyword.split(" ");
      expect(words.some((word, index) => word === words[index - 1])).toBe(false);
      expect(item.searchVolume).toBeGreaterThan(0);
      expect(item.keywordDifficulty).toBeGreaterThanOrEqual(0);
      expect(item.keywordDifficulty).toBeLessThanOrEqual(100);
      expect(item.competition).toBeLessThanOrEqual(1);
      expect(item.monthlySearches).toHaveLength(12);
    }
  });

  it("builds a 10-result SERP mixing big platforms and niche sites", async () => {
    const serp = await client.getOrganicSerp({ keyword: "bearded dragon tank setup", ...market, depth: 10, device: "desktop" });
    expect(serp.items.map((item) => item.rank)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
    expect(serp.items.every((item) => item.url?.startsWith("https://") && item.domain)).toBe(true);
    expect(serp.features).toContain("organic");
  });

  it("gives stable metrics, with realistic authority for big platforms", async () => {
    const { items } = await client.getDomainMetrics({ domains: ["reddit.com", "dragonguide.com"] });
    expect(items[0]).toMatchObject({ domain: "reddit.com", authority: 91 });
    expect(items[1]).toEqual(demoDomainMetrics("dragonguide.com"));
    expect(items[1]!.authority).toBeLessThanOrEqual(70);
    expect(Date.parse(items[1]!.registeredAt!)).toBeLessThan(Date.now());
  });

  it("suggests alphabet, question and modifier completions containing the query", async () => {
    const letter = await client.getAutocomplete({ keyword: "running shoes b", ...market });
    const question = await client.getAutocomplete({ keyword: "how running shoes", ...market });
    expect(letter.suggestions.length).toBeGreaterThan(0);
    expect(letter.suggestions.every((text) => text.startsWith("running shoes b"))).toBe(true);
    expect(question.suggestions.length).toBeGreaterThan(0);
    expect(question.suggestions.every((text) => text.startsWith("how ") && text.includes("running shoes"))).toBe(true);
    const connector = await client.getAutocomplete({ keyword: "running shoes for", ...market });
    expect(connector.suggestions.every((text) => text.startsWith("running shoes for ") && !text.includes("for for"))).toBe(true);
    const doubled = await client.getAutocomplete({ keyword: "what best ai tools", ...market });
    expect(doubled.suggestions.some((text) => /best best/.test(text))).toBe(false);
    // Letters without a natural completion return nothing rather than odd phrases.
    expect((await client.getAutocomplete({ keyword: "running shoes x", ...market })).suggestions).toEqual([]);
  });

  it("returns gap keywords and keyword overviews", async () => {
    const gap = await client.getDomainIntersection({ competitorDomain: "shoeguide.com", targetDomain: "myblog.com", ...market, limit: 50 });
    const overview = await client.getKeywordOverview({ keywords: ["running shoes for flat feet"], ...market });
    expect(gap.items.length).toBeGreaterThanOrEqual(5);
    expect(gap.items.every((item) => item.competitorRank >= 1)).toBe(true);
    expect(overview.items[0]).toMatchObject({ keyword: "running shoes for flat feet", searchVolume: expect.any(Number) });
  });
});

describe("demo OpenAI client", () => {
  const client = createDemoOpenAiClient();

  it("writes a valid summary that cites only supplied evidence", async () => {
    const evidence = [
      { id: "kw_1", kind: "keyword" as const, label: "running shoes", url: null, facts: [{ label: "Monthly searches", value: "90000" }, { label: "Keyword difficulty", value: "70" }] },
      { id: "kw_2", kind: "keyword" as const, label: "running shoes for beginners", url: null, facts: [{ label: "Monthly searches", value: "9000" }, { label: "Keyword difficulty", value: "21" }] },
    ];
    const result = await client.analyze({ ownerId: "owner", seedKeyword: "running shoes", country: "United States", language: "English", evidence });

    expect(researchAnalysisSchema.safeParse(result.analysis).success).toBe(true);
    const cited = [result.analysis.summary, ...result.analysis.opportunitySignals, ...result.analysis.risks, ...result.analysis.nextSteps]
      .flatMap((statement) => statement.citationIds);
    expect(new Set(cited)).toEqual(new Set(["kw_1", "kw_2"]));
    expect(result.analysis.missingEvidence[0]).toContain("Demo data");
  });

  it("rotates safe, specific niche ideas by date and skips recent ones", async () => {
    const today = await client.generateNicheIdeas({ date: "2026-10-22", count: 12, avoid: [] });
    const tomorrow = await client.generateNicheIdeas({ date: "2026-10-23", count: 12, avoid: [] });
    expect(today.ideas).toHaveLength(12);
    expect(acceptableNicheIdeas(today.ideas, [])).toHaveLength(12);
    expect(today.ideas.map((idea) => idea.seedKeyword)).not.toEqual(tomorrow.ideas.map((idea) => idea.seedKeyword));

    const avoided = await client.generateNicheIdeas({ date: "2026-10-22", count: 12, avoid: [today.ideas[0]!.seedKeyword] });
    expect(avoided.ideas.map((idea) => idea.seedKeyword)).not.toContain(today.ideas[0]!.seedKeyword);
  });
});

describe("demo mode switch", () => {
  it("only turns on with DEMO_DATA=true and then needs no DataForSEO keys", () => {
    expect(isDemoMode({ DEMO_DATA: "true" })).toBe(true);
    expect(isDemoMode({ DEMO_DATA: "TRUE " })).toBe(true);
    expect(isDemoMode({ DEMO_DATA: "1" })).toBe(false);
    expect(isDemoMode({})).toBe(false);
    expect(listMissingResearchKeys({ NODE_ENV: "development", INNGEST_DEV: "1", DEMO_DATA: "true" })).toEqual([]);
    expect(listMissingResearchKeys({ NODE_ENV: "development", INNGEST_DEV: "1" })).toEqual(["DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"]);
  });

  it("routes provider factories to the demo clients", async () => {
    vi.stubEnv("DEMO_DATA", "true");
    vi.resetModules();
    const providers = await import("@/server/providers");
    const result = await providers.createDataForSeoClient().getKeywordIdeas({ keywords: ["test topic"], ...market, limit: 5 });
    expect(result.taskId).toMatch(/^demo-/);
    expect((await providers.createOpenAiAnalysisClient().generateNicheIdeas({ date: "2026-10-22", count: 2, avoid: [] })).ideas).toHaveLength(2);
  });
});

describe("demo daily niches by type", () => {
  it("covers every niche type each day", async () => {
    const { ideas } = await createDemoOpenAiClient().generateNicheIdeas({ date: "2026-10-22", count: 14, avoid: [] });
    expect(new Set(ideas.map((idea) => idea.nicheType))).toEqual(new Set(["info", "affiliate", "tools", "apps", "ai", "saas", "local"]));
    expect(acceptableNicheIdeas(ideas, [])).toHaveLength(14);
  });
});

import { beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  client: { getKeywordOverview: vi.fn(), getOrganicSerp: vi.fn(), getDomainMetrics: vi.fn() },
  getProviderMarket: vi.fn(),
  findStaleDomains: vi.fn(),
  getDomainMetrics: vi.fn(),
  upsertDomainMetrics: vi.fn(),
  warn: vi.fn(),
}));

vi.mock("@/server/jobs/client", () => ({ inngest: { createFunction: vi.fn() } }));
vi.mock("@/server/config/environment", () => ({ isOpenAiAvailable: () => true }));
vi.mock("@/server/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/server/db/repositories", () => ({
  getProviderMarket: mocks.getProviderMarket,
  findStaleDomains: mocks.findStaleDomains,
  getDomainMetrics: mocks.getDomainMetrics,
  upsertDomainMetrics: mocks.upsertDomainMetrics,
}));
vi.mock("@/server/logging/logger", () => ({ logger: { warn: mocks.warn, info: vi.fn(), error: vi.fn() } }));
vi.mock("@/server/providers", () => ({ createDataForSeoClient: () => mocks.client, createOpenAiAnalysisClient: vi.fn() }));

import { enrichNicheIdeas } from "@/server/jobs/daily-niches";

const idea = (seedKeyword: string, countryCode: "US" | "GB" | "PK") => ({
  niche: seedKeyword, seedKeyword, problem: "a real problem", audience: "hobbyists", nicheType: "info" as const, countryCode,
});

const AUTHORITY: Record<string, number> = { "small-a.com": 8, "small-b.com": 20, "big.com": 85 };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.getProviderMarket.mockImplementation(async (_db, _provider, countryCode: string) =>
    countryCode === "PK" ? null : { locationCode: countryCode === "US" ? 2_840 : 2_826, languageCode: "en" });
  mocks.client.getKeywordOverview.mockImplementation(async ({ keywords }: { keywords: string[] }) => ({
    cost: 0,
    items: keywords.map((keyword) => ({ keyword: keyword.toUpperCase(), searchVolume: 1_900, keywordDifficulty: 14 })),
  }));
  mocks.client.getOrganicSerp.mockResolvedValue({
    items: [{ domain: "www.small-a.com" }, { domain: "small-b.com" }, { domain: "big.com" }, { domain: null }, { domain: "unknown.com" }],
  });
  mocks.findStaleDomains.mockResolvedValue(["unknown.com"]);
  mocks.client.getDomainMetrics.mockResolvedValue({ items: [] });
  mocks.getDomainMetrics.mockImplementation(async (_db, domains: string[]) =>
    domains.filter((domain) => domain in AUTHORITY).map((domain) => ({ domain, authority: AUTHORITY[domain] })));
});

describe("daily niche metrics", () => {
  it("checks volume, difficulty and low-authority sites in each idea's own country", async () => {
    const [us, gb] = await enrichNicheIdeas([idea("betta fish tank setup", "US"), idea("cast iron rust removal", "GB")]);

    expect(us).toMatchObject({ countryCode: "US", searchVolume: 1_900, difficulty: 14, lowAuthorityCount: 2 });
    expect(gb).toMatchObject({ countryCode: "GB", lowAuthorityCount: 2 });
    expect(mocks.client.getKeywordOverview).toHaveBeenCalledWith({ keywords: ["cast iron rust removal"], locationCode: 2_826, languageCode: "en" });
    expect(mocks.client.getOrganicSerp).toHaveBeenCalledWith(expect.objectContaining({ keyword: "betta fish tank setup", locationCode: 2_840, depth: 10 }));
    expect(mocks.upsertDomainMetrics).toHaveBeenCalled();
  });

  it("keeps ideas with empty metrics when a check fails or the market is missing", async () => {
    mocks.client.getKeywordOverview.mockRejectedValue(new Error("quota"));
    mocks.client.getOrganicSerp.mockRejectedValueOnce(new Error("timeout"));

    const result = await enrichNicheIdeas([idea("betta fish tank setup", "US"), idea("cricket bat care", "PK")]);

    expect(result).toEqual([
      expect.objectContaining({ seedKeyword: "betta fish tank setup", searchVolume: null, difficulty: null, lowAuthorityCount: null }),
      expect.objectContaining({ seedKeyword: "cricket bat care", searchVolume: null, difficulty: null, lowAuthorityCount: null }),
    ]);
    expect(mocks.warn).toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from "vitest";

import { createDataForSeoClient } from "@/server/providers/dataforseo/client";
import { ProviderError } from "@/server/providers/errors";

const environment = { DATAFORSEO_LOGIN: "api-user", DATAFORSEO_PASSWORD: "api-password" };

function envelope(result: unknown, cost = 0.01, statusCode = 20_000) {
  return {
    status_code: 20_000,
    status_message: "Ok.",
    tasks_count: 1,
    tasks_error: statusCode === 20_000 ? 0 : 1,
    tasks: [{ id: "task-1", status_code: statusCode, status_message: "Ok.", cost, result: result === null ? null : [result] }],
  };
}

function routedFetch(routes: Record<string, unknown>) {
  return vi.fn<typeof fetch>(async (input) => {
    const path = new URL(String(input)).pathname;
    if (!(path in routes)) throw new Error(`Unexpected path ${path}`);
    return new Response(JSON.stringify(routes[path]), { status: 200, headers: { "content-type": "application/json" } });
  });
}

function sentBody(fetchMock: ReturnType<typeof routedFetch>, path: string) {
  const call = fetchMock.mock.calls.find(([input]) => new URL(String(input)).pathname === path)!;
  return JSON.parse(String(call[1]!.body))[0];
}

describe("DataForSEO domain metrics", () => {
  it("merges ranks and WHOIS data per domain and keeps unknown values null", async () => {
    const fetchMock = routedFetch({
      "/v3/backlinks/bulk_ranks/live": envelope({ items: [{ target: "reddit.com", rank: 91.4 }, { target: "tiny.blog", rank: 7 }] }, 0.02),
      "/v3/domain_analytics/whois/overview/live": envelope({
        items: [{
          domain: "reddit.com",
          created_datetime: "2005-04-29 17:59:19 +00:00",
          metrics: { organic: { etv: 980_000.6 } },
          backlinks_info: { backlinks: 1_200_000, referring_domains: 45_000 },
        }],
      }, 0.1),
    });
    const client = createDataForSeoClient({ fetch: fetchMock, environment });

    const result = await client.getDomainMetrics({ domains: ["Reddit.com", "tiny.blog", "reddit.com", "unseen.org"] });

    expect(result.cost).toBeCloseTo(0.12);
    expect(result.items).toEqual([
      { domain: "reddit.com", authority: 91, backlinks: 1_200_000, referringDomains: 45_000, monthlyTraffic: 980_001, registeredAt: "2005-04-29T17:59:19.000Z" },
      { domain: "tiny.blog", authority: 7, backlinks: null, referringDomains: null, monthlyTraffic: null, registeredAt: null },
      { domain: "unseen.org", authority: null, backlinks: null, referringDomains: null, monthlyTraffic: null, registeredAt: null },
    ]);
    expect(sentBody(fetchMock, "/v3/backlinks/bulk_ranks/live")).toEqual({
      targets: ["reddit.com", "tiny.blog", "unseen.org"],
      rank_scale: "one_hundred",
    });
    expect(sentBody(fetchMock, "/v3/domain_analytics/whois/overview/live")).toEqual({
      filters: [["domain", "in", ["reddit.com", "tiny.blog", "unseen.org"]]],
      limit: 3,
    });
  });

  it("treats empty provider results as unknown metrics", async () => {
    const client = createDataForSeoClient({
      environment,
      fetch: routedFetch({
        "/v3/backlinks/bulk_ranks/live": envelope(null, 0, 40_102),
        "/v3/domain_analytics/whois/overview/live": envelope(null, 0, 40_102),
      }),
    });

    const result = await client.getDomainMetrics({ domains: ["a.com"] });
    expect(result.items[0]).toMatchObject({ domain: "a.com", authority: null, monthlyTraffic: null });
  });

  it.each([[[]], [["not a domain"]], [["localhost"]], [Array.from({ length: 101 }, (_, i) => `d${i}.com`)]])(
    "rejects invalid batches without calling the provider",
    async (domains) => {
      const fetchMock = routedFetch({});
      const client = createDataForSeoClient({ fetch: fetchMock, environment });

      await expect(client.getDomainMetrics({ domains })).rejects.toMatchObject({ code: "PROVIDER_INVALID_INPUT" });
      expect(fetchMock).not.toHaveBeenCalled();
    },
  );

  it("rejects malformed provider data instead of guessing", async () => {
    const client = createDataForSeoClient({
      environment,
      fetch: routedFetch({
        "/v3/backlinks/bulk_ranks/live": envelope({ items: [{ target: "a.com", rank: -5 }] }),
        "/v3/domain_analytics/whois/overview/live": envelope({ items: [] }),
      }),
    });

    await expect(client.getDomainMetrics({ domains: ["a.com"] })).rejects.toBeInstanceOf(ProviderError);
  });
});

describe("DataForSEO domain intersection", () => {
  it("asks for keywords only the competitor ranks for and normalizes them", async () => {
    const path = "/v3/dataforseo_labs/google/domain_intersection/live";
    const fetchMock = routedFetch({
      [path]: envelope({
        items: [
          {
            keyword_data: {
              keyword: "best running shoes for wide feet",
              keyword_info: { search_volume: 18_100, cpc: 1.1 },
              keyword_properties: { keyword_difficulty: 34 },
            },
            first_domain_serp_element: { rank_group: 2 },
          },
          { keyword_data: { keyword: "no rank data" }, first_domain_serp_element: null },
        ],
      }),
    });
    const client = createDataForSeoClient({ fetch: fetchMock, environment });

    const result = await client.getDomainIntersection({
      competitorDomain: "RunRepeat.com",
      targetDomain: "myblog.com",
      locationCode: 2_840,
      languageCode: "en",
      limit: 50,
    });

    expect(result.items).toEqual([{
      keyword: "best running shoes for wide feet",
      searchVolume: 18_100,
      cpc: 1.1,
      keywordDifficulty: 34,
      competitorRank: 2,
    }]);
    expect(sentBody(fetchMock, path)).toMatchObject({
      target1: "runrepeat.com",
      target2: "myblog.com",
      intersections: false,
      location_code: 2_840,
      language_code: "en",
      limit: 50,
    });
  });
});

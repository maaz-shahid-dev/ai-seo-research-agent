import { afterEach, describe, expect, it, vi } from "vitest";
import {
  createDataForSeoClient,
  DEFAULT_DATAFORSEO_TIMEOUT_MS,
  isRetryableDataForSeoStatus,
} from "@/server/providers/dataforseo/client";
import { ProviderError } from "@/server/providers/errors";
import { normalizeLinkHttpUrl } from "@/server/providers/types";

const credentials = {
  DATAFORSEO_LOGIN: "api-user",
  DATAFORSEO_PASSWORD: "api-password",
};

describe("DataForSEO client", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it("uses environment credentials and normalizes keyword ideas without replacing nulls", async () => {
    vi.stubEnv("DATAFORSEO_LOGIN", credentials.DATAFORSEO_LOGIN);
    vi.stubEnv("DATAFORSEO_PASSWORD", credentials.DATAFORSEO_PASSWORD);
    const fixture = keywordEnvelope({
      total_count: null,
      items: [
        {
          keyword: "technical seo",
          keyword_info: {
            search_volume: null,
            cpc: 4.25,
            competition: null,
            competition_level: null,
            monthly_searches: [{ year: 2026, month: 9, search_volume: null }],
          },
          keyword_properties: { keyword_difficulty: 42 },
          search_intent_info: { main_intent: "commercial" },
        },
        {
          keyword: "seo audit",
          keyword_info: null,
          keyword_properties: null,
          search_intent_info: { main_intent: "new_future_value" },
        },
      ],
    });
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(fixture));
    const client = createDataForSeoClient({ fetch: fetchMock });

    const result = await client.getKeywordIdeas({
      keywords: [" Technical SEO "],
      locationCode: 2_840,
      languageCode: "en",
      limit: 25,
    });

    expect(result).toEqual({
      taskId: "task-1",
      cost: 0.0103,
      totalCount: null,
      outcome: "complete",
      warning: null,
      items: [
        {
          keyword: "technical seo",
          searchVolume: null,
          cpc: 4.25,
          competition: null,
          competitionLevel: null,
          keywordDifficulty: 42,
          intent: "commercial",
          monthlySearches: [{ year: 2026, month: 9, searchVolume: null }],
        },
        {
          keyword: "seo audit",
          searchVolume: null,
          cpc: null,
          competition: null,
          competitionLevel: null,
          keywordDifficulty: null,
          intent: null,
          monthlySearches: [],
        },
      ],
    });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [url, request] = fetchMock.mock.calls[0] ?? [];
    expect(url).toBe(
      "https://api.dataforseo.com/v3/dataforseo_labs/google/keyword_ideas/live",
    );
    expect(request?.method).toBe("POST");
    expect(new Headers(request?.headers).get("authorization")).toBe(
      `Basic ${Buffer.from("api-user:api-password").toString("base64")}`,
    );
    expect(JSON.parse(String(request?.body))).toEqual([
      {
        keywords: ["Technical SEO"],
        location_code: 2_840,
        language_code: "en",
        include_serp_info: false,
        limit: 25,
      },
    ]);
    expect(request?.signal).toBeInstanceOf(AbortSignal);
  });

  it("normalizes only organic SERP items and rejects unsafe result URLs", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse(
        serpEnvelope({
          keyword: "seo tools",
          datetime: "2026-10-20 12:30:15 +00:00",
          item_types: ["organic", "people_also_ask", "organic"],
          se_results_count: null,
          items: [
            {
              type: "organic",
              rank_group: 1,
              rank_absolute: 2,
              title: " First result ",
              description: null,
              url: "https://Example.com/path?q=seo",
              domain: "wrong.example",
            },
            {
              type: "organic",
              rank_group: null,
              rank_absolute: null,
              title: null,
              description: "Unsafe provider URL",
              url: "javascript:alert(1)",
              domain: "safe.example",
            },
            {
              type: "people_also_ask",
              rank_group: 1,
              title: "Ignored",
              url: "https://example.com/ignored",
            },
          ],
        }),
      ),
    );
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    const result = await client.getOrganicSerp({
      keyword: "seo tools",
      locationCode: 2_840,
      languageCode: "en",
    });

    expect(result).toEqual({
      taskId: "task-1",
      cost: 0.003,
      keyword: "seo tools",
      checkedAt: "2026-10-20T12:30:15.000Z",
      totalResults: null,
      outcome: "complete",
      warning: null,
      features: ["organic", "people_also_ask"],
      items: [
        {
          rank: 1,
          rankAbsolute: 2,
          title: "First result",
          description: null,
          url: "https://example.com/path?q=seo",
          domain: "example.com",
        },
        {
          rank: null,
          rankAbsolute: null,
          title: null,
          description: "Unsafe provider URL",
          url: null,
          domain: "safe.example",
        },
      ],
    });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    expect(JSON.parse(String(request?.body))).toEqual([
      {
        keyword: "seo tools",
        location_code: 2_840,
        language_code: "en",
        depth: 10,
        device: "desktop",
        load_async_ai_overview: false,
      },
    ]);
  });

  it("validates inputs before issuing a billable request", async () => {
    const fetchMock = vi.fn<typeof fetch>();
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(
      client.getKeywordIdeas({
        keywords: [],
        locationCode: -1,
        languageCode: "<script>",
      }),
    ).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_INVALID_INPUT",
      retryable: false,
    });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("preserves literal plus and percent characters using DataForSEO encoding rules", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse(keywordEnvelope({ total_count: 0, items: [] })),
    );
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await client.getKeywordIdeas({
      keywords: ["C++ discount 50%"],
      locationCode: 2_840,
      languageCode: "en",
    });

    const [, request] = fetchMock.mock.calls[0] ?? [];
    const body = JSON.parse(String(request?.body)) as Array<{ keywords: string[] }>;
    expect(body[0]?.keywords).toEqual(["C%2B%2B discount 50%25"]);
  });

  it.each([
    [401, false],
    [402, false],
    [429, true],
    [503, true],
  ])("classifies HTTP %i retryability without retrying", async (status, retryable) => {
    const fetchMock = vi.fn<typeof fetch>(async () => new Response(null, { status }));
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(validKeywordRequest(client)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_HTTP_ERROR",
      httpStatus: status,
      retryable,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it.each([
    [40_103, true],
    [40_202, true],
    [50_301, true],
    [40_100, false],
    [40_200, false],
    [40_501, false],
  ])("classifies internal status %i without retrying", async (status, retryable) => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      jsonResponse({
        status_code: status,
        status_message: "Provider message is not exposed",
        tasks_count: 0,
        tasks_error: 1,
        tasks: null,
      }),
    );
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(validKeywordRequest(client)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_REQUEST_FAILED",
      providerStatus: status,
      retryable,
    });
    expect(fetchMock).toHaveBeenCalledTimes(1);
  });

  it("validates task-level failures even when the envelope succeeded", async () => {
    const fixture = keywordEnvelope(null);
    fixture.tasks_error = 1;
    fixture.tasks[0].status_code = 50_401;
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(fixture));
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(validKeywordRequest(client)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_REQUEST_FAILED",
      providerStatus: 50_401,
      retryable: true,
    });
  });

  it("returns a typed empty keyword result when DataForSEO reports no results", async () => {
    const fixture = keywordEnvelope(null);
    fixture.tasks_error = 1;
    fixture.tasks[0].status_code = 40_102;
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(fixture));
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(validKeywordRequest(client)).resolves.toEqual({
      taskId: "task-1",
      cost: 0.0103,
      totalCount: 0,
      items: [],
      outcome: "empty",
      warning: null,
    });
  });

  it("returns a typed empty SERP result using the requested keyword", async () => {
    const fixture = serpEnvelope({
      keyword: "ignored provider keyword",
      datetime: null,
      item_types: null,
      se_results_count: null,
      items: null,
    });
    fixture.tasks_error = 1;
    fixture.tasks[0].status_code = 40_102;
    fixture.tasks[0].result = null;
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(fixture));
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(
      client.getOrganicSerp({
        keyword: "uncommon query",
        locationCode: 2_840,
        languageCode: "en",
      }),
    ).resolves.toEqual({
      taskId: "task-1",
      cost: 0.003,
      keyword: "uncommon query",
      checkedAt: null,
      totalResults: 0,
      features: [],
      items: [],
      outcome: "empty",
      warning: null,
    });
  });

  it("preserves partial keyword results with a sanitized warning", async () => {
    const fixture = keywordEnvelope({
      total_count: 1,
      items: [{ keyword: "partial keyword", keyword_info: null }],
    });
    fixture.tasks_error = 1;
    fixture.tasks[0].status_code = 40_106;
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(fixture));
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    const result = await validKeywordRequest(client);

    expect(result).toMatchObject({
      totalCount: 1,
      outcome: "partial",
      warning: {
        code: "DATAFORSEO_PARTIAL_RESULTS",
        message: "DataForSEO returned partial results.",
        providerStatus: 40_106,
      },
    });
    expect(result.items).toHaveLength(1);
  });

  it("preserves partial organic results with a sanitized warning", async () => {
    const fixture = serpEnvelope({
      keyword: "seo tools",
      datetime: "2026-10-20 12:30:15 +00:00",
      item_types: ["organic"],
      se_results_count: 1,
      items: [
        {
          type: "organic",
          rank_group: 1,
          rank_absolute: 1,
          title: "Partial result",
          description: null,
          url: "https://example.com/partial",
          domain: "example.com",
        },
      ],
    });
    fixture.tasks_error = 1;
    fixture.tasks[0].status_code = 40_106;
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(fixture));
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    const result = await client.getOrganicSerp({
      keyword: "seo tools",
      locationCode: 2_840,
      languageCode: "en",
    });

    expect(result.outcome).toBe("partial");
    expect(result.warning).toMatchObject({ providerStatus: 40_106 });
    expect(result.items).toHaveLength(1);
  });

  it("rejects a successful envelope that omits its result payload", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () => jsonResponse(keywordEnvelope(null)));
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(validKeywordRequest(client)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_RESPONSE_INVALID",
      retryable: false,
    });
  });

  it("rejects malformed and oversized provider responses", async () => {
    const malformed = vi.fn<typeof fetch>(async () =>
      new Response("not-json", { status: 200, headers: { "content-type": "application/json" } }),
    );
    const malformedClient = createDataForSeoClient({
      fetch: malformed,
      environment: credentials,
    });

    await expect(validKeywordRequest(malformedClient)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_RESPONSE_INVALID",
      retryable: false,
    });

    const unexpectedShape = vi.fn<typeof fetch>(async () => jsonResponse({ status_code: 20_000 }));
    const unexpectedShapeClient = createDataForSeoClient({
      fetch: unexpectedShape,
      environment: credentials,
    });
    await expect(validKeywordRequest(unexpectedShapeClient)).rejects.toMatchObject<
      Partial<ProviderError>
    >({ code: "PROVIDER_RESPONSE_INVALID" });

    const oversized = vi.fn<typeof fetch>(async () =>
      new Response("{}", { status: 200, headers: { "content-length": "9000000" } }),
    );
    const oversizedClient = createDataForSeoClient({
      fetch: oversized,
      environment: credentials,
    });

    await expect(validKeywordRequest(oversizedClient)).rejects.toMatchObject<
      Partial<ProviderError>
    >({ code: "PROVIDER_RESPONSE_INVALID", retryable: false });

    const streamedOversized = vi.fn<typeof fetch>(async () =>
      new Response(new Uint8Array(8 * 1024 * 1024 + 1), { status: 200 }),
    );
    const streamedOversizedClient = createDataForSeoClient({
      fetch: streamedOversized,
      environment: credentials,
    });
    await expect(validKeywordRequest(streamedOversizedClient)).rejects.toMatchObject<
      Partial<ProviderError>
    >({ code: "PROVIDER_RESPONSE_INVALID", retryable: false });

    const invalidUtf8 = vi.fn<typeof fetch>(async () =>
      new Response(new Uint8Array([0xc3, 0x28]), { status: 200 }),
    );
    const invalidUtf8Client = createDataForSeoClient({
      fetch: invalidUtf8,
      environment: credentials,
    });
    await expect(validKeywordRequest(invalidUtf8Client)).rejects.toMatchObject<
      Partial<ProviderError>
    >({ code: "PROVIDER_RESPONSE_INVALID", retryable: false });
  });

  it("keeps response-stream failures retryable", async () => {
    const fetchMock = vi.fn<typeof fetch>(async () =>
      new Response(
        new ReadableStream({
          start(controller) {
            controller.error(new TypeError("socket closed while reading"));
          },
        }),
        { status: 200 },
      ),
    );
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });

    await expect(validKeywordRequest(client)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_NETWORK_ERROR",
      retryable: true,
    });
  });

  it("uses a DataForSEO deadline beyond the provider's 120-second live window", () => {
    expect(DEFAULT_DATAFORSEO_TIMEOUT_MS).toBeGreaterThan(120_000);
    expect(() =>
      createDataForSeoClient({
        environment: credentials,
        timeoutMs: DEFAULT_DATAFORSEO_TIMEOUT_MS,
      }),
    ).not.toThrow();
  });

  it("classifies network failures and enforces a request timeout", async () => {
    const networkFetch = vi.fn<typeof fetch>(async () => {
      throw new TypeError("connection reset");
    });
    const networkClient = createDataForSeoClient({
      fetch: networkFetch,
      environment: credentials,
    });

    await expect(validKeywordRequest(networkClient)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_NETWORK_ERROR",
      retryable: true,
    });
    expect(networkFetch).toHaveBeenCalledTimes(1);

    const timeoutFetch = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          init?.signal?.addEventListener(
            "abort",
            () => reject(init.signal?.reason ?? new DOMException("Aborted", "AbortError")),
            { once: true },
          );
        }),
    );
    const timeoutClient = createDataForSeoClient({
      fetch: timeoutFetch,
      environment: credentials,
      timeoutMs: 5,
    });

    await expect(validKeywordRequest(timeoutClient)).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_TIMEOUT",
      retryable: true,
    });
    expect(timeoutFetch).toHaveBeenCalledTimes(1);
  });

  it("honors caller cancellation", async () => {
    const fetchMock = vi.fn<typeof fetch>(async (_input, init) => {
      if (init?.signal?.aborted) {
        throw init.signal.reason ?? new DOMException("Aborted", "AbortError");
      }
      throw new Error("Expected an aborted signal");
    });
    const client = createDataForSeoClient({ fetch: fetchMock, environment: credentials });
    const controller = new AbortController();
    controller.abort(new DOMException("Cancelled", "AbortError"));

    await expect(
      client.getKeywordIdeas(
        { keywords: ["seo tools"], locationCode: 2_840, languageCode: "en" },
        { signal: controller.signal },
      ),
    ).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_ABORTED",
      retryable: false,
    });
  });

  it("keeps caller cancellation authoritative when transport rejection is delayed", async () => {
    const fetchMock = vi.fn<typeof fetch>(
      async (_input, init) =>
        new Promise<Response>((_resolve, reject) => {
          const rejectLater = () => {
            setTimeout(
              () => reject(init?.signal?.reason ?? new DOMException("Aborted", "AbortError")),
              15,
            );
          };

          if (init?.signal?.aborted) {
            rejectLater();
            return;
          }
          init?.signal?.addEventListener("abort", rejectLater, { once: true });
        }),
    );
    const client = createDataForSeoClient({
      fetch: fetchMock,
      environment: credentials,
      timeoutMs: 5,
    });
    const controller = new AbortController();
    const pending = validKeywordRequestWithSignal(client, controller.signal);

    controller.abort(new DOMException("Cancelled", "AbortError"));

    await expect(pending).rejects.toMatchObject<Partial<ProviderError>>({
      code: "PROVIDER_ABORTED",
      retryable: false,
    });
  });

  it("rejects ambiguous Basic-auth logins", () => {
    expect(() =>
      createDataForSeoClient({
        environment: { DATAFORSEO_LOGIN: "name:extra", DATAFORSEO_PASSWORD: "secret" },
      }),
    ).toThrowError(ProviderError);
  });
});

describe("provider normalization helpers", () => {
  it.each([
    ["https://example.com/a", "https://example.com/a"],
    ["http://example.com", "http://example.com/"],
    ["javascript:alert(1)", null],
    ["data:text/html,test", null],
    ["https://user:password@example.com", null],
    ["not a url", null],
    [null, null],
  ])("normalizes safe URL %j", (input, expected) => {
    expect(normalizeLinkHttpUrl(input)).toBe(expected);
  });

  it("maintains an explicit internal retry allowlist", () => {
    expect(isRetryableDataForSeoStatus(50_303)).toBe(true);
    expect(isRetryableDataForSeoStatus(50_100)).toBe(false);
  });
});

function validKeywordRequest(client: ReturnType<typeof createDataForSeoClient>) {
  return client.getKeywordIdeas({
    keywords: ["seo tools"],
    locationCode: 2_840,
    languageCode: "en",
  });
}

function validKeywordRequestWithSignal(
  client: ReturnType<typeof createDataForSeoClient>,
  signal: AbortSignal,
) {
  return client.getKeywordIdeas(
    {
      keywords: ["seo tools"],
      locationCode: 2_840,
      languageCode: "en",
    },
    { signal },
  );
}

function keywordEnvelope(result: Record<string, unknown> | null) {
  return {
    status_code: 20_000,
    status_message: "Ok.",
    tasks_count: 1,
    tasks_error: 0,
    tasks: [
      {
        id: "task-1",
        status_code: 20_000,
        status_message: "Ok.",
        cost: 0.0103,
        result_count: result === null ? 0 : 1,
        result: result === null ? null : [result],
      },
    ],
  };
}

function serpEnvelope(result: Record<string, unknown> | null) {
  return {
    status_code: 20_000,
    status_message: "Ok.",
    tasks_count: 1,
    tasks_error: 0,
    tasks: [
      {
        id: "task-1",
        status_code: 20_000,
        status_message: "Ok.",
        cost: 0.003,
        result_count: result === null ? 0 : 1,
        result: result === null ? null : [result],
      },
    ],
  };
}

function jsonResponse(value: unknown) {
  return Response.json(value, { status: 200 });
}

import "server-only";

import { Buffer } from "node:buffer";
import { z, type ZodType } from "zod";
import { getDataForSeoEnvironment } from "@/server/config/environment";
import {
  ProviderError,
  isAbortError,
  isRetryableHttpStatus,
} from "@/server/providers/errors";
import {
  createRequestAbortContext,
  invalidTimeoutForProvider,
} from "@/server/providers/request-context";
import {
  domainIntersectionRequestSchema,
  domainMetricsRequestSchema,
  keywordIdeasRequestSchema,
  normalizeDomain,
  normalizeLinkHttpUrl,
  organicSerpRequestSchema,
  searchIntentSchema,
  type DataForSeoResultOutcome,
  type DomainIntersectionRequest,
  type DomainIntersectionResult,
  type DomainMetricsRequest,
  type DomainMetricsResult,
  type NormalizedDomainMetrics,
  type KeywordIdeasRequest,
  type KeywordIdeasResult,
  type OrganicSerpRequest,
  type OrganicSerpResult,
  type ProviderRequestOptions,
} from "@/server/providers/types";
import {
  domainIntersectionResultSchema,
  domainRanksResultSchema,
  genericResponseSchema,
  keywordIdeasResultSchema,
  keywordIdeasResponseSchema,
  organicSerpResultSchema,
  organicSerpResponseSchema,
  whoisOverviewResultSchema,
} from "./schemas";

const DATAFORSEO_BASE_URL = "https://api.dataforseo.com";
const KEYWORD_IDEAS_PATH = "/v3/dataforseo_labs/google/keyword_ideas/live";
const ORGANIC_SERP_PATH = "/v3/serp/google/organic/live/advanced";
const DOMAIN_RANKS_PATH = "/v3/backlinks/bulk_ranks/live";
const WHOIS_OVERVIEW_PATH = "/v3/domain_analytics/whois/overview/live";
const DOMAIN_INTERSECTION_PATH = "/v3/dataforseo_labs/google/domain_intersection/live";
const MAX_RESPONSE_BYTES = 8 * 1024 * 1024;
const SUCCESS_STATUS = 20_000;
const NO_RESULTS_STATUS = 40_102;
const PARTIAL_RESULTS_STATUS = 40_106;

// Live tasks can run for 120 seconds; reserve time for transport and parsing.
export const DEFAULT_DATAFORSEO_TIMEOUT_MS = 125_000;

const retryableInternalStatuses = new Set([
  40_101,
  40_103,
  40_202,
  40_209,
  40_601,
  40_602,
  50_000,
  50_001,
  50_301,
  50_302,
  50_303,
  50_304,
  50_401,
  50_402,
]);

type DataForSeoEnvironment = ReturnType<typeof getDataForSeoEnvironment>;

export interface DataForSeoClientOptions {
  fetch?: typeof fetch;
  environment?: DataForSeoEnvironment;
  timeoutMs?: number;
}

export interface DataForSeoClient {
  getKeywordIdeas(
    request: KeywordIdeasRequest,
    options?: ProviderRequestOptions,
  ): Promise<KeywordIdeasResult>;
  getOrganicSerp(
    request: OrganicSerpRequest,
    options?: ProviderRequestOptions,
  ): Promise<OrganicSerpResult>;
  /** Authority, backlinks, referring domains, traffic and registration date per domain. */
  getDomainMetrics(
    request: DomainMetricsRequest,
    options?: ProviderRequestOptions,
  ): Promise<DomainMetricsResult>;
  /** Keywords the competitor ranks for where the target domain does not. */
  getDomainIntersection(
    request: DomainIntersectionRequest,
    options?: ProviderRequestOptions,
  ): Promise<DomainIntersectionResult>;
}

export function createDataForSeoClient(options: DataForSeoClientOptions = {}): DataForSeoClient {
  const environment = options.environment ?? getDataForSeoEnvironment();
  if (environment.DATAFORSEO_LOGIN.includes(":")) {
    throw new ProviderError(
      "dataforseo",
      "PROVIDER_INVALID_INPUT",
      "The DataForSEO login cannot contain a colon.",
      false,
    );
  }

  const fetchImplementation = options.fetch ?? globalThis.fetch;
  const timeoutMs = invalidTimeoutForProvider(
    "dataforseo",
    options.timeoutMs ?? DEFAULT_DATAFORSEO_TIMEOUT_MS,
  );
  const authorization = `Basic ${Buffer.from(
    `${environment.DATAFORSEO_LOGIN}:${environment.DATAFORSEO_PASSWORD}`,
    "utf8",
  ).toString("base64")}`;

  const post = async <Schema extends ZodType>(
    path: string,
    body: unknown,
    schema: Schema,
    requestOptions: ProviderRequestOptions,
  ): Promise<z.infer<Schema>> => {
    const abortContext = createRequestAbortContext(timeoutMs, requestOptions.signal);

    try {
      const response = await fetchImplementation(`${DATAFORSEO_BASE_URL}${path}`, {
        method: "POST",
        headers: {
          accept: "application/json",
          authorization,
          "content-type": "application/json; charset=utf-8",
        },
        body: JSON.stringify([body]),
        cache: "no-store",
        signal: abortContext.signal,
      });

      if (!response.ok) {
        throw new ProviderError(
          "dataforseo",
          "PROVIDER_HTTP_ERROR",
          "DataForSEO rejected the request.",
          isRetryableHttpStatus(response.status),
          { httpStatus: response.status },
        );
      }

      const contentLength = Number(response.headers.get("content-length"));
      if (Number.isFinite(contentLength) && contentLength > MAX_RESPONSE_BYTES) {
        throw invalidResponse("DataForSEO returned an oversized response.");
      }

      const responseText = await readBoundedResponseText(response);

      let responseBody: unknown;
      try {
        responseBody = JSON.parse(responseText) as unknown;
      } catch (error) {
        throw invalidResponse("DataForSEO returned invalid JSON.", error);
      }

      const parsed = schema.safeParse(responseBody);
      if (!parsed.success) {
        throw invalidResponse("DataForSEO returned an unexpected response shape.", parsed.error);
      }

      return parsed.data;
    } catch (error) {
      if (error instanceof ProviderError) {
        throw error;
      }

      if (abortContext.didTimeout()) {
        throw new ProviderError(
          "dataforseo",
          "PROVIDER_TIMEOUT",
          "DataForSEO did not respond before the request deadline.",
          true,
          { cause: error },
        );
      }

      if (abortContext.wasCallerAborted() || isAbortError(error)) {
        throw new ProviderError(
          "dataforseo",
          "PROVIDER_ABORTED",
          "The DataForSEO request was cancelled.",
          false,
          { cause: error },
        );
      }

      throw new ProviderError(
        "dataforseo",
        "PROVIDER_NETWORK_ERROR",
        "DataForSEO could not be reached.",
        true,
        { cause: error },
      );
    } finally {
      abortContext.cleanup();
    }
  };

  return {
    async getKeywordIdeas(request, requestOptions = {}) {
      const input = parseInput(keywordIdeasRequestSchema, request);
      const response = await post(
        KEYWORD_IDEAS_PATH,
        {
          keywords: input.keywords.map(escapeDataForSeoKeyword),
          location_code: input.locationCode,
          language_code: input.languageCode,
          include_serp_info: false,
          limit: input.limit,
        },
        keywordIdeasResponseSchema,
        requestOptions,
      );
      const { task, outcome } = taskOutcome(response);
      if (outcome === "empty") {
        return {
          taskId: task.id,
          cost: task.cost ?? null,
          totalCount: 0,
          items: [],
          ...outcomeMetadata(outcome),
        };
      }

      const result = parseResult(
        keywordIdeasResultSchema,
        task.result?.[0],
        "DataForSEO did not include valid keyword results.",
      );

      return {
        taskId: task.id,
        cost: task.cost ?? null,
        totalCount: result.total_count ?? null,
        items: (result.items ?? []).map((item) => {
          const parsedIntent = searchIntentSchema.safeParse(
            item.search_intent_info?.main_intent,
          );

          return {
            keyword: item.keyword,
            searchVolume: item.keyword_info?.search_volume ?? null,
            cpc: item.keyword_info?.cpc ?? null,
            competition: item.keyword_info?.competition ?? null,
            competitionLevel: cleanOptionalText(item.keyword_info?.competition_level),
            keywordDifficulty: item.keyword_properties?.keyword_difficulty ?? null,
            intent: parsedIntent.success ? parsedIntent.data : null,
            monthlySearches: (item.keyword_info?.monthly_searches ?? []).map((monthly) => ({
              year: monthly.year,
              month: monthly.month,
              searchVolume: monthly.search_volume ?? null,
            })),
          };
        }),
        ...outcomeMetadata(outcome),
      };
    },

    async getOrganicSerp(request, requestOptions = {}) {
      const input = parseInput(organicSerpRequestSchema, request);
      const response = await post(
        ORGANIC_SERP_PATH,
        {
          keyword: escapeDataForSeoKeyword(input.keyword),
          location_code: input.locationCode,
          language_code: input.languageCode,
          depth: input.depth,
          device: input.device,
          load_async_ai_overview: false,
        },
        organicSerpResponseSchema,
        requestOptions,
      );
      const { task, outcome } = taskOutcome(response);
      if (outcome === "empty") {
        return {
          taskId: task.id,
          cost: task.cost ?? null,
          keyword: input.keyword,
          checkedAt: null,
          totalResults: 0,
          features: [],
          items: [],
          ...outcomeMetadata(outcome),
        };
      }

      const result = parseResult(
        organicSerpResultSchema,
        task.result?.[0],
        "DataForSEO did not include valid SERP results.",
      );

      return {
        taskId: task.id,
        cost: task.cost ?? null,
        keyword: result.keyword,
        checkedAt: normalizeProviderTimestamp(result.datetime),
        totalResults: result.se_results_count ?? null,
        features: [
          ...new Set(
            (result.item_types ?? [])
              .map((feature) => feature.trim())
              .filter((feature) => feature.length > 0),
          ),
        ],
        items: (result.items ?? [])
          .filter((item) => item.type === "organic")
          .map((item) => {
            const url = normalizeLinkHttpUrl(item.url);
            const urlDomain = url === null ? null : new URL(url).hostname.toLowerCase();

            return {
              rank: item.rank_group ?? null,
              rankAbsolute: item.rank_absolute ?? null,
              title: cleanOptionalText(item.title),
              description: cleanOptionalText(item.description),
              url,
              domain: urlDomain ?? normalizeDomain(item.domain),
            };
          }),
        ...outcomeMetadata(outcome),
      };
    },

    async getDomainMetrics(request, requestOptions = {}) {
      const { domains } = parseInput(domainMetricsRequestSchema, request);
      // One rank call and one WHOIS call cover every domain in the batch.
      const [ranksResponse, whoisResponse] = await Promise.all([
        post(DOMAIN_RANKS_PATH, { targets: domains, rank_scale: "one_hundred" }, genericResponseSchema, requestOptions),
        post(
          WHOIS_OVERVIEW_PATH,
          { filters: [["domain", "in", domains]], limit: domains.length },
          genericResponseSchema,
          requestOptions,
        ),
      ]);
      const ranks = taskOutcome(ranksResponse);
      const whois = taskOutcome(whoisResponse);
      const rankItems = ranks.outcome === "empty" ? []
        : parseResult(domainRanksResultSchema, ranks.task.result?.[0], "DataForSEO did not include valid ranks.").items ?? [];
      const whoisItems = whois.outcome === "empty" ? []
        : parseResult(whoisOverviewResultSchema, whois.task.result?.[0], "DataForSEO did not include valid WHOIS data.").items ?? [];

      const byDomain = new Map<string, NormalizedDomainMetrics>(
        domains.map((domain) => [domain, {
          domain, authority: null, backlinks: null, referringDomains: null, monthlyTraffic: null, registeredAt: null,
        }]),
      );
      for (const item of rankItems) {
        const entry = byDomain.get(normalizeDomain(item.target) ?? "");
        if (entry && item.rank != null) entry.authority = Math.min(100, Math.round(item.rank));
      }
      for (const item of whoisItems) {
        const entry = byDomain.get(normalizeDomain(item.domain) ?? "");
        if (!entry) continue;
        entry.registeredAt = normalizeProviderTimestamp(item.created_datetime);
        entry.backlinks = item.backlinks_info?.backlinks ?? null;
        entry.referringDomains = item.backlinks_info?.referring_domains ?? null;
        const traffic = item.metrics?.organic?.etv;
        entry.monthlyTraffic = traffic == null ? null : Math.round(traffic);
      }

      return {
        cost: (ranksResponse.tasks?.[0]?.cost ?? 0) + (whoisResponse.tasks?.[0]?.cost ?? 0),
        items: [...byDomain.values()],
      };
    },

    async getDomainIntersection(request, requestOptions = {}) {
      const input = parseInput(domainIntersectionRequestSchema, request);
      const response = await post(
        DOMAIN_INTERSECTION_PATH,
        {
          target1: input.competitorDomain,
          target2: input.targetDomain,
          // false = keywords target1 ranks for and target2 does not.
          intersections: false,
          location_code: input.locationCode,
          language_code: input.languageCode,
          item_types: ["organic"],
          limit: input.limit,
          order_by: ["keyword_data.keyword_info.search_volume,desc"],
        },
        genericResponseSchema,
        requestOptions,
      );
      const { task, outcome } = taskOutcome(response);
      if (outcome === "empty") return { cost: task.cost ?? null, items: [] };

      const result = parseResult(domainIntersectionResultSchema, task.result?.[0], "DataForSEO did not include valid gap keywords.");
      return {
        cost: task.cost ?? null,
        items: (result.items ?? []).flatMap((item) => {
          const rank = item.first_domain_serp_element?.rank_group;
          if (rank == null || rank < 1) return [];
          return [{
            keyword: item.keyword_data.keyword,
            searchVolume: item.keyword_data.keyword_info?.search_volume ?? null,
            cpc: item.keyword_data.keyword_info?.cpc ?? null,
            keywordDifficulty: item.keyword_data.keyword_properties?.keyword_difficulty ?? null,
            competitorRank: rank,
          }];
        }),
      };
    },
  };
}

export function isRetryableDataForSeoStatus(status: number) {
  return retryableInternalStatuses.has(status);
}

function parseInput<Schema extends ZodType>(schema: Schema, input: unknown): z.output<Schema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw new ProviderError(
      "dataforseo",
      "PROVIDER_INVALID_INPUT",
      "The DataForSEO request is invalid.",
      false,
      { cause: parsed.error },
    );
  }

  return parsed.data;
}

function parseResult<Schema extends ZodType>(
  schema: Schema,
  input: unknown,
  message: string,
): z.output<Schema> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    throw invalidResponse(message, parsed.error);
  }

  return parsed.data;
}

function taskOutcome<
  Envelope extends {
    status_code: number;
    tasks_count: number;
    tasks_error: number;
    tasks: Array<{ id: string; status_code: number; status_message: string }> | null;
  },
>(response: Envelope): {
  task: NonNullable<Envelope["tasks"]>[number];
  outcome: "complete" | "empty" | "partial";
} {
  if (response.status_code !== SUCCESS_STATUS) {
    throw internalFailure(response.status_code);
  }

  const tasks = response.tasks;
  const task = tasks?.[0];
  if (!tasks || !task || response.tasks_count !== tasks.length) {
    throw invalidResponse("DataForSEO returned inconsistent task metadata.");
  }

  if (task.status_code === NO_RESULTS_STATUS) {
    return { task, outcome: "empty" };
  }

  if (task.status_code === PARTIAL_RESULTS_STATUS) {
    return { task, outcome: "partial" };
  }

  if (response.tasks_error > 0 && task.status_code === SUCCESS_STATUS) {
    throw invalidResponse("DataForSEO returned inconsistent task error metadata.");
  }

  if (task.status_code !== SUCCESS_STATUS) {
    throw internalFailure(task.status_code);
  }

  return { task, outcome: "complete" };
}

function outcomeMetadata(
  outcome: "complete" | "empty" | "partial",
): DataForSeoResultOutcome {
  if (outcome === "partial") {
    return {
      outcome,
      warning: {
        code: "DATAFORSEO_PARTIAL_RESULTS",
        message: "DataForSEO returned partial results.",
        providerStatus: PARTIAL_RESULTS_STATUS,
      },
    };
  }

  return { outcome, warning: null };
}

function internalFailure(status: number) {
  return new ProviderError(
    "dataforseo",
    "PROVIDER_REQUEST_FAILED",
    "DataForSEO could not complete the request.",
    isRetryableDataForSeoStatus(status),
    { providerStatus: status },
  );
}

function invalidResponse(message: string, cause?: unknown) {
  return new ProviderError(
    "dataforseo",
    "PROVIDER_RESPONSE_INVALID",
    message,
    false,
    { cause },
  );
}

function cleanOptionalText(value: string | null | undefined) {
  if (typeof value !== "string") {
    return null;
  }

  const cleaned = value.trim();
  return cleaned.length > 0 ? cleaned : null;
}

async function readBoundedResponseText(response: Response) {
  if (response.body === null) {
    return "";
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { fatal: true });
  let byteLength = 0;
  let output = "";

  while (true) {
    const chunk = await reader.read();
    if (chunk.done) {
      try {
        output += decoder.decode();
        return output;
      } catch (error) {
        throw invalidResponse("DataForSEO returned invalid UTF-8.", error);
      }
    }

    byteLength += chunk.value.byteLength;
    if (byteLength > MAX_RESPONSE_BYTES) {
      await reader.cancel("Response exceeded the configured size limit").catch(() => undefined);
      throw invalidResponse("DataForSEO returned an oversized response.");
    }

    try {
      output += decoder.decode(chunk.value, { stream: true });
    } catch (error) {
      await reader.cancel("Response was not valid UTF-8").catch(() => undefined);
      throw invalidResponse("DataForSEO returned invalid UTF-8.", error);
    }
  }
}

function escapeDataForSeoKeyword(keyword: string) {
  return keyword.replaceAll("%", "%25").replaceAll("+", "%2B");
}

function normalizeProviderTimestamp(value: string | null | undefined) {
  const cleaned = cleanOptionalText(value);
  if (cleaned === null) {
    return null;
  }

  const isoLike = cleaned.replace(
    /^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2}) ([+-]\d{2}:\d{2})$/,
    "$1T$2$3",
  );
  const timestamp = Date.parse(isoLike);
  return Number.isNaN(timestamp) ? null : new Date(timestamp).toISOString();
}

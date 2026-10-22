import "server-only";

import { buildAutocompleteQueries, normalizePhrase, selectNewSuggestions } from "@/features/research/autocomplete";
import { getDatabase } from "@/server/db/client";
import { insertKeywordResults } from "@/server/db/repositories";
import type { DataForSeoClient } from "@/server/providers";

import { settleWithConcurrency } from "./concurrency";
import { keywordWithoutMetrics, toKeywordResultInput } from "./keyword-mapping";

const PARALLEL_AUTOCOMPLETE_CALLS = 8;
const MAX_NEW_KEYWORDS = 200;

type ExpansionInput = {
  ownerId: string;
  runId: string;
  seed: string;
  existingKeywords: readonly string[];
  locationCode: number;
  languageCode: string;
  countryCode: string;
};

/**
 * Collects Google Autocomplete suggestions for the seed (seed + a–z, question
 * words, modifiers), keeps new relevant ones, adds their metrics, and stores
 * them as "autocomplete" keywords. Individual failed lookups are skipped.
 */
export async function expandWithAutocomplete(client: DataForSeoClient, input: ExpansionInput) {
  const queries = buildAutocompleteQueries(input.seed);
  const settled = await settleWithConcurrency(queries, PARALLEL_AUTOCOMPLETE_CALLS, (query) =>
    client.getAutocomplete({ keyword: query.query, locationCode: input.locationCode, languageCode: input.languageCode }));
  const suggestions = settled.flatMap((result) => (result.ok ? result.value.suggestions : []));
  const fresh = selectNewSuggestions(input.seed, suggestions, input.existingKeywords, MAX_NEW_KEYWORDS);
  const failedQueries = settled.filter((result) => !result.ok).length;
  if (fresh.length === 0) return { queries: queries.length, failedQueries, added: 0 };

  const overview = await client.getKeywordOverview({
    keywords: fresh,
    locationCode: input.locationCode,
    languageCode: input.languageCode,
  });
  const metrics = new Map(overview.items.map((item) => [normalizePhrase(item.keyword), item]));
  const { insertedCount } = await insertKeywordResults(
    getDatabase(),
    input.ownerId,
    input.runId,
    fresh.map((keyword) => toKeywordResultInput(metrics.get(keyword) ?? keywordWithoutMetrics(keyword), {
      source: "autocomplete",
      providerRequestId: null,
      countryCode: input.countryCode,
      languageCode: input.languageCode,
    })),
  );
  return { queries: queries.length, failedQueries, added: insertedCount };
}

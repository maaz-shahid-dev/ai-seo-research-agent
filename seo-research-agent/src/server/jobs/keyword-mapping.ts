import "server-only";

import type { KeywordResultInput } from "@/server/db/repositories";
import type { NormalizedKeywordIdea } from "@/server/providers";

/** Converts provider keyword data into a stored keyword row (CPC in micros, trend as "YYYY-MM"). */
export function toKeywordResultInput(
  item: NormalizedKeywordIdea,
  context: {
    source: KeywordResultInput["source"];
    providerRequestId: string | null;
    countryCode: string;
    languageCode: string;
  },
): KeywordResultInput {
  return {
    keyword: item.keyword,
    source: context.source,
    provider: "dataforseo",
    providerRequestId: context.providerRequestId,
    retrievedAt: new Date(),
    intent: item.intent ?? "unknown",
    countryCode: context.countryCode,
    languageCode: context.languageCode,
    searchVolume: item.searchVolume,
    cpcMicros: item.cpc === null ? null : Math.max(0, Math.round(item.cpc * 1_000_000)),
    competition: item.competition,
    difficulty: item.keywordDifficulty,
    trend: item.monthlySearches.map((point) => ({
      month: `${point.year}-${String(point.month).padStart(2, "0")}`,
      volume: point.searchVolume ?? 0,
    })),
  };
}

/** A keyword the provider has no metrics for yet (e.g. a brand-new autocomplete suggestion). */
export function keywordWithoutMetrics(keyword: string): NormalizedKeywordIdea {
  return {
    keyword,
    searchVolume: null,
    cpc: null,
    competition: null,
    competitionLevel: null,
    keywordDifficulty: null,
    intent: null,
    monthlySearches: [],
  };
}

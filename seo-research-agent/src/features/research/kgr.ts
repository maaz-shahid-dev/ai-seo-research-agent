/**
 * Keyword Golden Ratio: allintitle results ÷ monthly searches, for keywords
 * with 250 or fewer searches a month. Under 0.25 a new site can often rank
 * within weeks; 0.25–1 is possible; above 1 is crowded.
 */
export const KGR_MAX_VOLUME = 250;
/** Allintitle lookups per request; each one is a paid live SERP check. */
export const KGR_BATCH_SIZE = 10;

export type KgrRating = "great" | "ok" | "poor";

export function isKgrCandidate(keyword: { searchVolume: number | null }) {
  return keyword.searchVolume !== null && keyword.searchVolume > 0 && keyword.searchVolume <= KGR_MAX_VOLUME;
}

export function kgrRatio(allintitleCount: number | null, searchVolume: number | null) {
  if (allintitleCount === null || searchVolume === null || searchVolume <= 0) return null;
  return Math.round((allintitleCount / searchVolume) * 100) / 100;
}

export function kgrRating(ratio: number): KgrRating {
  return ratio < 0.25 ? "great" : ratio <= 1 ? "ok" : "poor";
}

/** The query whose result count KGR needs. Quotes are dropped so they can't change the operator. */
export function allintitleQuery(keyword: string) {
  return `allintitle:${keyword.replace(/["“”]/g, " ").replace(/\s+/g, " ").trim()}`;
}

/**
 * Opportunity score (0–100) for one keyword, then a tier by percentile within
 * the search so the tiers always spread out instead of everything being "Prime".
 *
 *   0.30 × volume (log scale) + 0.30 × (100 − KD) + 0.25 × SERP weakness + 0.15 × CPC
 *
 * A missing metric is left out and the remaining weights are rescaled; a
 * keyword with no volume data gets no score.
 */

export type OpportunityTier = "prime" | "solid" | "tough" | "fortress";
export type Opportunity = { score: number; tier: OpportunityTier };

export type OpportunityInput = {
  searchVolume: number | null;
  difficulty: number | null;
  cpcMicros: number | null;
  /** SERP weakness 0–100 (share of beatable sites); null until the SERP is analyzed. */
  nicheScore: number | null;
};

export const TIER_LABELS: Record<OpportunityTier, string> = {
  prime: "Prime",
  solid: "Solid",
  tough: "Tough",
  fortress: "Fortress",
};

/** Each tier ends where this share of the ranked list is above it. */
const TIER_CUTOFFS: ReadonlyArray<[OpportunityTier, number]> = [
  ["prime", 0.15],
  ["solid", 0.4],
  ["tough", 0.75],
  ["fortress", 1],
];

const VOLUME_CEILING = 100_000;
const CPC_CEILING_USD = 5;

export function opportunityScore(input: OpportunityInput): number | null {
  if (input.searchVolume === null || input.searchVolume < 0) return null;
  const parts: Array<[number, number | null]> = [
    [0.3, Math.min(100, (Math.log10(input.searchVolume + 1) / Math.log10(VOLUME_CEILING + 1)) * 100)],
    [0.3, input.difficulty === null ? null : 100 - clamp(input.difficulty)],
    [0.25, input.nicheScore === null ? null : clamp(input.nicheScore)],
    [0.15, input.cpcMicros === null ? null : Math.min(100, (input.cpcMicros / 1_000_000 / CPC_CEILING_USD) * 100)],
  ];
  let total = 0;
  let weights = 0;
  for (const [weight, value] of parts) {
    if (value === null) continue;
    total += weight * value;
    weights += weight;
  }
  return Math.round(total / weights);
}

/**
 * Scores every keyword and assigns tiers by rank. Equal scores always share
 * a tier (the tier of the first keyword with that score).
 */
export function rankOpportunities<T extends OpportunityInput & { id: number }>(keywords: readonly T[]): Map<number, Opportunity> {
  const scored = keywords
    .map((keyword) => ({ id: keyword.id, score: opportunityScore(keyword) }))
    .filter((item): item is { id: number; score: number } => item.score !== null)
    .sort((a, b) => b.score - a.score);

  const result = new Map<number, Opportunity>();
  let previous: Opportunity | null = null;
  scored.forEach((item, index) => {
    const tier = previous && previous.score === item.score ? previous.tier : tierAt(index, scored.length);
    previous = { score: item.score, tier };
    result.set(item.id, previous);
  });
  return result;
}

function tierAt(index: number, count: number): OpportunityTier {
  // Share of keywords ranked above this one, so the best keyword is always Prime.
  const above = index / count;
  return TIER_CUTOFFS.find(([, cutoff]) => above < cutoff)![0];
}

function clamp(value: number) {
  return Math.min(100, Math.max(0, value));
}

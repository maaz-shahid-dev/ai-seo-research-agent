import type { ResearchSnapshot } from '@/types/seo';

export interface ResearchQuery {
  projectId: string;
  seedKeyword: string;
  country: string;
  language: string;
}

export function normalizeSeedKeyword(value: string): string {
  return value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en');
}

/** Find an exact bundled snapshot; never substitute evidence from another query. */
export function findDemoSnapshot(
  snapshots: readonly ResearchSnapshot[],
  query: ResearchQuery
): ResearchSnapshot | null {
  const normalizedSeed = normalizeSeedKeyword(query.seedKeyword);

  return snapshots.find((snapshot) =>
    snapshot.project_id === query.projectId &&
    normalizeSeedKeyword(snapshot.seed_keyword) === normalizedSeed &&
    snapshot.country.toUpperCase() === query.country.toUpperCase() &&
    snapshot.language.toLowerCase() === query.language.toLowerCase()
  ) ?? null;
}

/** Clone arrays so session interactions cannot mutate the fixture module. */
export function cloneResearchSnapshot(snapshot: ResearchSnapshot): ResearchSnapshot {
  return {
    ...snapshot,
    keywords: snapshot.keywords.map((keyword) => ({
      ...keyword,
      trend: keyword.trend ? [...keyword.trend] : undefined,
    })),
    serp_results: Object.fromEntries(
      Object.entries(snapshot.serp_results).map(([keyword, results]) => [
        keyword,
        results.map((result) => ({ ...result })),
      ])
    ),
    analysis: {
      ...snapshot.analysis,
      opportunity_signals: [...snapshot.analysis.opportunity_signals],
      risks: [...snapshot.analysis.risks],
      missing_evidence: [...snapshot.analysis.missing_evidence],
      next_steps: [...snapshot.analysis.next_steps],
    },
    market_comparisons: snapshot.market_comparisons.map((comparison) => ({
      ...comparison,
    })),
  };
}

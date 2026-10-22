import { ISKILLS_BEATABLE_AUTHORITY_MAX } from "./iskills";
import type { NicheType } from "./niche-types";
import type { NicheIdeaDto } from "./types";

/** iSkills rule of thumb: three or more beatable sites on page 1. */
export const LOW_AUTHORITY_SITES_TARGET = 3;
export { ISKILLS_BEATABLE_AUTHORITY_MAX };

export type IdeaSort = "opportunity" | "volume" | "difficulty";

export type IdeaFilters = {
  nicheType: NicheType | "all";
  countryCode: string;
  /** Only ideas with enough low-authority sites in the top 10. */
  lowAuthorityOnly: boolean;
  sort: IdeaSort;
};

export const DEFAULT_IDEA_FILTERS: IdeaFilters = { nicheType: "all", countryCode: "all", lowAuthorityOnly: false, sort: "opportunity" };

type IdeaMetrics = Pick<NicheIdeaDto, "searchVolume" | "difficulty" | "lowAuthorityCount">;

export function hasLowAuthorityGap(idea: Pick<NicheIdeaDto, "lowAuthorityCount">) {
  return (idea.lowAuthorityCount ?? 0) >= LOW_AUTHORITY_SITES_TARGET;
}

/**
 * 0–100: beatable sites on page 1 matter most, then demand, then low
 * difficulty. Unchecked metrics count as weak, never as strong.
 */
export function ideaOpportunity(idea: IdeaMetrics) {
  const sites = Math.min(idea.lowAuthorityCount ?? 0, 10) / 10;
  const demand = Math.min(Math.log10((idea.searchVolume ?? 0) + 1) / 5, 1);
  const ease = (100 - (idea.difficulty ?? 60)) / 100;
  return Math.round(sites * 50 + demand * 30 + ease * 20);
}

const SORT_KEYS: Record<IdeaSort, (idea: IdeaMetrics) => number> = {
  opportunity: (idea) => -ideaOpportunity(idea),
  volume: (idea) => -(idea.searchVolume ?? -1),
  difficulty: (idea) => idea.difficulty ?? 101,
};

export function filterAndSortIdeas<T extends NicheIdeaDto>(ideas: readonly T[], filters: IdeaFilters): T[] {
  const kept = ideas.filter((idea) =>
    (filters.nicheType === "all" || idea.nicheType === filters.nicheType) &&
    (filters.countryCode === "all" || idea.countryCode === filters.countryCode) &&
    (!filters.lowAuthorityOnly || hasLowAuthorityGap(idea)));
  const key = SORT_KEYS[filters.sort];
  return [...kept].sort((a, b) => key(a) - key(b));
}

import { ISKILLS_BEATABLE_AUTHORITY_MAX } from "./iskills";
import type { SiteType } from "./niche";

export type AuthorityBucket = { label: string; min: number; max: number; count: number; easy: boolean };

const BUCKETS: ReadonlyArray<[number, number]> = [[0, 20], [21, 40], [41, 60], [61, 80], [81, 100]];

export const SITE_TYPE_LABELS: Record<SiteType, string> = {
  forum: "Forums",
  qa: "Q&A sites",
  social: "Social",
  video: "Video",
  "blog-platform": "Blog platforms",
  other: "Websites",
};

/** How many top-10 results fall in each authority band; unknown authority is counted separately. */
export function authorityBuckets(results: ReadonlyArray<{ authority: number | null }>) {
  const buckets: AuthorityBucket[] = BUCKETS.map(([min, max]) => ({
    label: `${min}–${max}`,
    min,
    max,
    count: results.filter((result) => result.authority !== null && result.authority >= min && result.authority <= max).length,
    easy: max <= ISKILLS_BEATABLE_AUTHORITY_MAX,
  }));
  return { buckets, unknown: results.filter((result) => result.authority === null).length };
}

/** Result counts by kind of site, largest first. */
export function siteTypeBreakdown(results: ReadonlyArray<{ siteType: SiteType }>) {
  const counts = new Map<SiteType, number>();
  for (const result of results) counts.set(result.siteType, (counts.get(result.siteType) ?? 0) + 1);
  return [...counts.entries()]
    .map(([type, count]) => ({ type, label: SITE_TYPE_LABELS[type], count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

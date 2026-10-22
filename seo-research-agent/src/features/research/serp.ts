import { registrableDomain } from "./domains";
import { classifySite, type SerpSiteMetrics } from "./niche";

const YEAR_MS = 365.25 * 24 * 60 * 60_000;

/** Cached metrics as stored for a registrable domain. */
export type StoredDomainMetrics = {
  domain: string;
  authority: number | null;
  backlinks: number | null;
  referringDomains: number | null;
  monthlyTraffic: number | null;
  registeredAt: Date | null;
};

/** Joins a result's hostname to the metrics cached for its registrable domain. */
export function siteMetricsFor(
  hostname: string,
  metricsByDomain: ReadonlyMap<string, StoredDomainMetrics>,
  now = new Date(),
): SerpSiteMetrics & { backlinks: number | null; referringDomains: number | null } {
  const domain = registrableDomain(hostname) ?? hostname;
  const metrics = metricsByDomain.get(domain);
  return {
    domain,
    authority: metrics?.authority ?? null,
    monthlyTraffic: metrics?.monthlyTraffic ?? null,
    backlinks: metrics?.backlinks ?? null,
    referringDomains: metrics?.referringDomains ?? null,
    domainAgeYears: metrics?.registeredAt
      ? Math.max(0, Math.round(((now.getTime() - metrics.registeredAt.getTime()) / YEAR_MS) * 10) / 10)
      : null,
  };
}

/** Sites that rank for almost everything make poor content-gap competitors. */
const GENERIC_PLATFORMS = new Set([
  "wikipedia.org", "amazon.com", "ebay.com", "walmart.com", "etsy.com", "google.com", "apple.com", "microsoft.com",
]);

/**
 * Picks the domains that rank most often and highest across a run's SERPs,
 * skipping the user's own site, forums, social/video sites and big portals.
 */
export function pickCompetitors(
  results: readonly { domain: string | null; rank: number }[],
  targetDomain: string,
  limit = 3,
) {
  const target = registrableDomain(targetDomain);
  const scores = new Map<string, number>();
  for (const { domain: host, rank } of results) {
    const domain = host ? registrableDomain(host) : null;
    if (!domain || domain === target || GENERIC_PLATFORMS.has(domain) || classifySite(domain) !== "other") continue;
    scores.set(domain, (scores.get(domain) ?? 0) + Math.max(11 - rank, 1));
  }
  return [...scores.entries()]
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit)
    .map(([domain]) => domain);
}

export type GapKeyword = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpcMicros: number | null;
  competitorDomain: string;
  competitorRank: number;
};

/** One row per keyword (best competitor rank wins), highest volume first. */
export function mergeGapKeywords(lists: readonly GapKeyword[][], limit = 200) {
  const byKeyword = new Map<string, GapKeyword>();
  for (const item of lists.flat()) {
    const key = item.keyword.trim().toLowerCase();
    const existing = byKeyword.get(key);
    if (!existing || item.competitorRank < existing.competitorRank) byKeyword.set(key, item);
  }
  return [...byKeyword.values()]
    .sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1) || a.keyword.localeCompare(b.keyword))
    .slice(0, limit);
}

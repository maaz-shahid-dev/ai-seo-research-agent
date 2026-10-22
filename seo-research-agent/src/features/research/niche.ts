/**
 * Niche Hunter rules shared by the UI and the SERP worker. A "weak spot" is a
 * top-10 result a new site could realistically outrank.
 */

export type SiteType = "forum" | "qa" | "social" | "video" | "blog-platform" | "other";

export type WeakSpot = "forum" | "qa" | "social" | "low-authority" | "new-site" | "low-traffic";

export const LOW_AUTHORITY_MAX = 20;
export const NEW_SITE_MAX_YEARS = 2;
export const LOW_TRAFFIC_MAX = 1_000;
const POINTS_PER_WEAK_RESULT = 20;
const SERP_DEPTH = 10;

const KNOWN_SITES: Record<string, SiteType> = {
  "reddit.com": "forum",
  "tripadvisor.com": "forum",
  "warriorforum.com": "forum",
  "quora.com": "qa",
  "stackexchange.com": "qa",
  "stackoverflow.com": "qa",
  "answers.com": "qa",
  "facebook.com": "social",
  "instagram.com": "social",
  "linkedin.com": "social",
  "pinterest.com": "social",
  "tiktok.com": "social",
  "x.com": "social",
  "twitter.com": "social",
  "youtube.com": "video",
  "vimeo.com": "video",
  "medium.com": "blog-platform",
  "substack.com": "blog-platform",
  "blogspot.com": "blog-platform",
  "wordpress.com": "blog-platform",
  "tumblr.com": "blog-platform",
};

const WEAK_SITE_TYPES: ReadonlySet<SiteType> = new Set(["forum", "qa", "social"]);

/** Classifies a domain, including subdomains such as `old.reddit.com`. */
export function classifySite(domain: string): SiteType {
  const labels = domain.trim().toLowerCase().replace(/^www\./, "").split(".");
  for (let start = 0; start < labels.length - 1; start += 1) {
    const type = KNOWN_SITES[labels.slice(start).join(".")];
    if (type) return type;
  }
  if (labels.some((label) => label === "forum" || label === "forums" || label === "community")) return "forum";
  return "other";
}

export type SerpSiteMetrics = {
  domain: string;
  authority: number | null;
  monthlyTraffic: number | null;
  domainAgeYears: number | null;
};

/** Every reason a result is beatable; missing metrics never count as weak. */
export function findWeakSpots(result: SerpSiteMetrics): WeakSpot[] {
  const spots: WeakSpot[] = [];
  const type = classifySite(result.domain);
  if (WEAK_SITE_TYPES.has(type)) spots.push(type as WeakSpot);
  if (result.authority !== null && result.authority <= LOW_AUTHORITY_MAX) spots.push("low-authority");
  if (result.domainAgeYears !== null && result.domainAgeYears < NEW_SITE_MAX_YEARS) spots.push("new-site");
  if (result.monthlyTraffic !== null && result.monthlyTraffic < LOW_TRAFFIC_MAX) spots.push("low-traffic");
  return spots;
}

/**
 * 0–100, higher is easier: half comes from keyword difficulty, half from how
 * many top-10 results have at least one weak spot (20 points each, max 100).
 */
export function nicheScore(difficulty: number | null, results: readonly SerpSiteMetrics[]) {
  const weakResults = results.slice(0, SERP_DEPTH).filter((result) => findWeakSpots(result).length > 0).length;
  const easiness = difficulty === null ? 50 : 100 - Math.min(Math.max(difficulty, 0), 100);
  const weakness = Math.min(weakResults * POINTS_PER_WEAK_RESULT, 100);
  return Math.round(easiness / 2 + weakness / 2);
}

const QUESTION_START = /^(how|what|why|when|where|who|whom|whose|which|can|could|do|does|did|is|are|was|were|should|will|would)\b/i;

export function isQuestionKeyword(keyword: string) {
  return QUESTION_START.test(keyword.trim()) || keyword.trim().endsWith("?");
}

/** Provider competition is 0–1 (share of advertisers); shown as a level. */
export function competitionLevel(value: number | null): "Low" | "Medium" | "High" | null {
  if (value === null) return null;
  if (value < 0.34) return "Low";
  if (value < 0.67) return "Medium";
  return "High";
}

/** Monthly volumes oldest-first; months are stored as sortable "YYYY-MM". */
export function trendVolumes(trend: readonly { month: string; volume: number }[] | null) {
  return trend ? [...trend].sort((a, b) => a.month.localeCompare(b.month)).map((point) => point.volume) : [];
}

export const WEAK_SPOT_LABELS: Record<WeakSpot, string> = {
  forum: "Forum",
  qa: "Q&A",
  social: "Social",
  "low-authority": "Low authority",
  "new-site": "New site",
  "low-traffic": "Low traffic",
};

import { meaningfulWords, normalizePhrase } from "./autocomplete";
import { coverageSize } from "./coverage";
import { isQuestionKeyword } from "./niche";
import { restrictedNiche } from "./restricted";

/**
 * The iSkills niche-selection checklist: niche choice is the main success or
 * failure factor, so every rule is scored separately and explained.
 */

export type CheckStatus = "pass" | "warn" | "fail" | "unknown";

export type ChecklistItem = { id: string; label: string; status: CheckStatus; detail: string };

/** iSkills counts "DR/DA 20 or less" as realistically beatable. */
export const ISKILLS_BEATABLE_AUTHORITY_MAX = 20;
const YOUNG_SITE_MAX_YEARS = 2;
const SMALL_SITE_MAX_TRAFFIC = 10_000;
const MIN_GOOD_VOLUME = 1_000;
const MIN_OK_VOLUME = 100;

export type ChecklistSite = {
  domain: string;
  authority: number | null;
  monthlyTraffic: number | null;
  domainAgeYears: number | null;
  referringDomains: number | null;
  rankingKeywords: number | null;
  isHomepage: boolean;
  siteType: string;
};

export type ChecklistInput = {
  seed: string;
  seedVolume: number | null;
  keywords: readonly { keyword: string }[];
  contentPages: number;
  /** Page-1 results for the seed, or null while the SERP is still being analyzed. */
  serp: { hasAiOverview: boolean | null; results: readonly ChecklistSite[] } | null;
};

export function iskillsChecklist(input: ChecklistInput) {
  const items: ChecklistItem[] = [];
  const add = (id: string, label: string, status: CheckStatus, detail: string) => items.push({ id, label, status, detail });
  const results = input.serp?.results.slice(0, 10) ?? [];
  const hasSerp = input.serp !== null && results.length > 0;

  const restricted = restrictedNiche(input.seed);
  add("avoid", "Not a niche to avoid", restricted ? "fail" : "pass",
    restricted ? `${restricted.label} — avoid this niche.` : "No gambling, adult, piracy, downloads or YMYL signals.");

  const words = meaningfulWords(normalizePhrase(input.seed)).length;
  add("specific", "Specific, not broad", words >= 3 ? "pass" : words === 2 ? "warn" : "fail",
    words >= 3 ? "A specific multi-word niche." : words === 2 ? "Fairly broad — a narrower angle is safer." : "Single-word niches are too broad.");

  const problemShare = input.keywords.length
    ? input.keywords.filter(({ keyword }) => isQuestionKeyword(keyword) || /\b(fix|stop|prevent|without|for beginners|problems?|issues?)\b/i.test(keyword)).length / input.keywords.length
    : 0;
  add("problem", "Solves a specific problem", problemShare >= 0.25 ? "pass" : problemShare >= 0.1 ? "warn" : "fail",
    `${Math.round(problemShare * 100)}% of keywords are questions or problems people want solved.`);

  add("start-small", "Start micro/nano, expand later",
    input.seedVolume === null ? "unknown" : input.seedVolume <= 50_000 ? "pass" : "warn",
    input.seedVolume === null ? "Search volume unknown."
      : input.seedVolume <= 50_000 ? "Small enough to own as a micro niche." : "Big head term — start with a sub-niche and expand.");

  const beatable = results.filter((site) => site.authority !== null && site.authority <= ISKILLS_BEATABLE_AUTHORITY_MAX);
  add("beatable", `3+ beatable sites (authority ≤ ${ISKILLS_BEATABLE_AUTHORITY_MAX})`,
    !hasSerp ? "unknown" : beatable.length >= 3 ? "pass" : beatable.length > 0 ? "warn" : "fail",
    !hasSerp ? "Waiting for page 1 analysis." : `${beatable.length} of ${results.length} page-1 sites are beatable.`);

  const aiOverview = input.serp?.hasAiOverview ?? null;
  add("ai-overview", "No AI Overview (preferred)",
    aiOverview === null ? "unknown" : aiOverview ? "warn" : "pass",
    aiOverview === null ? "Not checked yet." : aiOverview
      ? "Google shows an AI Overview — check the weakest sites below still get traffic."
      : "No AI Overview on page 1.");

  const young = results.filter((site) => site.domainAgeYears !== null && site.domainAgeYears < YOUNG_SITE_MAX_YEARS);
  add("young", "Young sites ranking (strong signal)", !hasSerp ? "unknown" : young.length > 0 ? "pass" : "warn",
    !hasSerp ? "Waiting for page 1 analysis." : young.length > 0
      ? `${young.map((site) => site.domain).join(", ")} ${young.length === 1 ? "is" : "are"} under ${YOUNG_SITE_MAX_YEARS} years old.`
      : "No young sites on page 1.");

  const small = results.filter((site) => site.siteType === "other" && site.monthlyTraffic !== null && site.monthlyTraffic < SMALL_SITE_MAX_TRAFFIC);
  add("small-sites", "Smaller focused sites ranking", !hasSerp ? "unknown" : small.length > 0 ? "pass" : "warn",
    !hasSerp ? "Waiting for page 1 analysis." : small.length > 0
      ? `${small.length} site${small.length === 1 ? "" : "s"} with under ${SMALL_SITE_MAX_TRAFFIC.toLocaleString("en-US")} visits/month.`
      : "Page 1 is mostly big sites.");

  const dedicated = results.filter((site) => site.isHomepage);
  add("dedicated", "Dedicated niche sites ranking", !hasSerp ? "unknown" : dedicated.length > 0 ? "pass" : "warn",
    !hasSerp ? "Waiting for page 1 analysis." : dedicated.length > 0
      ? `${dedicated.map((site) => site.domain).join(", ")} rank with their homepage.`
      : "No dedicated sites on page 1.");

  const size = coverageSize(input.contentPages);
  add("coverage", "Manageable topical coverage", size === "large" ? "warn" : "pass",
    `About ${input.contentPages} page${input.contentPages === 1 ? "" : "s"} to cover the topic (${size}).`);

  const linkTargets = beatable.flatMap((site) => (site.referringDomains === null ? [] : [site.referringDomains]));
  const medianLinks = median(linkTargets);
  add("backlinks", "Low backlink requirement",
    medianLinks === null ? "unknown" : medianLinks <= 100 ? "pass" : medianLinks <= 1_000 ? "warn" : "fail",
    medianLinks === null ? "No backlink data for beatable sites yet."
      : `Beatable sites have about ${medianLinks.toLocaleString("en-US")} referring domains.`);

  add("volume", "Enough search volume",
    input.seedVolume === null ? "unknown" : input.seedVolume >= MIN_GOOD_VOLUME ? "pass" : input.seedVolume >= MIN_OK_VOLUME ? "warn" : "fail",
    input.seedVolume === null ? "Search volume unknown." : `${input.seedVolume.toLocaleString("en-US")} searches a month for the seed.`);

  return { items, verdict: overallVerdict(items), weakestSites: lowestAuthoritySites(results) };
}

/** Avoid if a hard rule fails; Go when nothing fails and most rules pass. */
function overallVerdict(items: readonly ChecklistItem[]) {
  if (items.find((item) => item.id === "avoid")?.status === "fail") return "avoid" as const;
  const known = items.filter((item) => item.status !== "unknown");
  const fails = known.filter((item) => item.status === "fail").length;
  const passes = known.filter((item) => item.status === "pass").length;
  if (fails === 0 && passes >= known.length * 0.6) return "go" as const;
  if (fails <= 2) return "maybe" as const;
  return "avoid" as const;
}

/** The three weakest page-1 sites — what to study when an AI Overview is present. */
export function lowestAuthoritySites<T extends { authority: number | null }>(results: readonly T[], count = 3) {
  return results
    .filter((site) => site.authority !== null)
    .sort((a, b) => a.authority! - b.authority!)
    .slice(0, count);
}

function median(values: readonly number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[middle]! : Math.round((sorted[middle - 1]! + sorted[middle]!) / 2);
}

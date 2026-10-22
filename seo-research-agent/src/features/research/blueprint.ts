import { meaningfulWords, normalizePhrase } from "./autocomplete";
import { buildContentPlan, type ArticleType, type ContentCluster, type CoverageKeyword } from "./coverage";
import { isQuestionKeyword } from "./niche";
import type { NicheType } from "./niche-types";
import { titleCase } from "@/lib/format";

export { titleCase };

/**
 * A website launch plan built programmatically from the research: domain
 * ideas, silo structure, one brief per article, a 12-week publishing
 * calendar and the launch steps for the niche type.
 */

export type BlueprintKeyword = CoverageKeyword & { nicheScore?: number | null };

export type DomainIdea = { name: string; style: "exact" | "partial" | "brandable" };

export type ContentBrief = {
  title: string;
  url: string;
  articleType: ArticleType;
  silo: string;
  targetKeyword: string;
  secondaryKeywords: string[];
  monthlyVolume: number;
  difficulty: number | null;
  wordCount: number;
  outline: string[];
  questions: string[];
  internalLinks: string[];
  quickWin: boolean;
};

export type Silo = { name: string; path: string; articles: ContentBrief[] };

export type CalendarWeek = { week: number; articles: Array<{ title: string; url: string; quickWin: boolean }> };

const CALENDAR_WEEKS = 12;
const QUICK_WIN_MAX_DIFFICULTY = 30;

const SILOS: Record<ArticleType, { name: string; path: string }> = {
  pillar: { name: "Start here", path: "" },
  "how-to": { name: "How-to guides", path: "/how-to" },
  "best-of": { name: "Best picks", path: "/best" },
  comparison: { name: "Comparisons", path: "/compare" },
  guide: { name: "Guides", path: "/guides" },
};

const WORD_COUNTS: Record<ArticleType, number> = { pillar: 3000, "best-of": 2500, comparison: 1800, "how-to": 1500, guide: 1800 };

const BRAND_SUFFIXES: Record<NicheType, string[]> = {
  info: ["wise", "nest", "path", "ly", "insider"],
  affiliate: ["picks", "rated", "pro", "review", "choice"],
  tools: ["kit", "calc", "lab", "tools", "box"],
  apps: ["play", "zone", "apps", "hub", "verse"],
  ai: ["ai", "bot", "mind", "stack", "labs"],
  saas: ["stack", "hq", "flow", "compare", "base"],
  local: ["local", "pros", "near", "direct", "now"],
};

export function buildBlueprint(seedInput: string, keywords: readonly BlueprintKeyword[], nicheType: NicheType) {
  const seed = normalizePhrase(seedInput);
  const plan = buildContentPlan(seed, keywords);
  const questions = keywords.map((item) => item.keyword).filter(isQuestionKeyword);
  const pillarUrl = `/${slugify(seed)}`;

  const briefs = plan.clusters.map((cluster) => toBrief(cluster, seed, nicheType, questions, pillarUrl));
  // Internal links: every article links to the pillar and to two siblings in its silo.
  for (const brief of briefs) {
    const siblings = briefs.filter((other) => other.silo === brief.silo && other.url !== brief.url).slice(0, 2);
    brief.internalLinks = brief.articleType === "pillar"
      ? briefs.filter((other) => other.articleType !== "pillar").slice(0, 6).map((other) => other.url)
      : [pillarUrl, ...siblings.map((other) => other.url)];
  }

  const silos: Silo[] = (Object.keys(SILOS) as ArticleType[])
    .map((type) => ({ ...SILOS[type], path: SILOS[type].path || "/", articles: briefs.filter((brief) => brief.articleType === type) }))
    .filter((silo) => silo.articles.length > 0);

  return {
    seed,
    nicheType,
    domains: domainIdeas(seed, nicheType),
    silos,
    briefs,
    calendar: publishingCalendar(briefs),
    totals: { articles: briefs.length, quickWins: briefs.filter((brief) => brief.quickWin).length, words: briefs.reduce((sum, brief) => sum + brief.wordCount, 0) },
  };
}

function toBrief(cluster: ContentCluster, seed: string, nicheType: NicheType, questions: readonly string[], pillarUrl: string): ContentBrief {
  const silo = SILOS[cluster.articleType];
  const url = cluster.articleType === "pillar" ? pillarUrl : `${silo.path}/${slugify(cluster.mainKeyword)}`;
  const topicWords = new Set(meaningfulWords(normalizePhrase(cluster.topic)));
  const related = cluster.articleType === "pillar"
    ? questions.slice(0, 6)
    : questions.filter((question) => meaningfulWords(normalizePhrase(question)).some((word) => topicWords.has(word))).slice(0, 5);
  const difficulty = cluster.averageDifficulty;

  return {
    title: articleTitle(cluster, seed),
    url,
    articleType: cluster.articleType,
    silo: silo.name,
    targetKeyword: cluster.mainKeyword,
    secondaryKeywords: cluster.keywords.slice(1, 7).map((item) => item.keyword),
    monthlyVolume: cluster.totalVolume,
    difficulty,
    // Harder keywords need more depth to compete.
    wordCount: WORD_COUNTS[cluster.articleType] + (difficulty !== null && difficulty > 50 ? 500 : 0),
    outline: outlineFor(cluster, seed, nicheType),
    questions: related,
    internalLinks: [],
    quickWin: difficulty !== null && difficulty <= QUICK_WIN_MAX_DIFFICULTY && cluster.articleType !== "pillar",
  };
}

function articleTitle(cluster: ContentCluster, seed: string) {
  const main = titleCase(cluster.mainKeyword);
  switch (cluster.articleType) {
    case "pillar": return `${titleCase(seed)}: The Complete Guide`;
    case "best-of": return `${main} (Tested & Compared)`;
    case "comparison": return `${main}: Which Is Better?`;
    case "how-to": return isQuestionKeyword(cluster.mainKeyword) ? `${main}?`.replace(/\?\?$/, "?") : `${main}: Step-by-Step`;
    default: return `${main}: What You Need to Know`;
  }
}

function outlineFor(cluster: ContentCluster, seed: string, nicheType: NicheType) {
  const subject = titleCase(cluster.articleType === "pillar" ? seed : cluster.mainKeyword);
  const typeSection: Partial<Record<NicheType, string>> = {
    tools: `Use the free ${titleCase(seed)} tool`,
    saas: "Pricing and plans compared",
    ai: "Prompt examples and setup walkthrough",
    apps: "Get it from the official app store",
    local: "Typical cost in your area",
    affiliate: "Our top picks at a glance",
  };
  const base: Record<ArticleType, string[]> = {
    pillar: [`What is ${subject}?`, "Getting started", ...cluster.keywords.slice(1, 4).map((item) => titleCase(item.keyword)), "Common mistakes", "FAQs"],
    "how-to": ["What you need", `Step-by-step: ${subject}`, "Common mistakes to avoid", "Troubleshooting", "FAQs"],
    "best-of": ["Our top picks at a glance", "How we chose", "Detailed reviews", "Buying guide: what to look for", "FAQs"],
    comparison: ["Quick verdict", "Side-by-side comparison", "Key differences", "Which one should you choose?", "FAQs"],
    guide: ["Overview", "Key things to know", "Tips from experience", "Mistakes to avoid", "FAQs"],
  };
  const extra = typeSection[nicheType];
  const outline = base[cluster.articleType];
  return extra && !outline.includes(extra) ? [outline[0]!, extra, ...outline.slice(1)] : outline;
}

/** Pillar first, then quick wins, then the rest by opportunity; 2–5 articles a week for 12 weeks. */
function publishingCalendar(briefs: readonly ContentBrief[]): CalendarWeek[] {
  const priority = (brief: ContentBrief) =>
    (brief.articleType === "pillar" ? 1e9 : 0) + (brief.quickWin ? 1e6 : 0) + (100 - (brief.difficulty ?? 50)) * Math.log10(brief.monthlyVolume + 10);
  const ordered = [...briefs].sort((a, b) => priority(b) - priority(a));
  const perWeek = Math.min(5, Math.max(2, Math.ceil(ordered.length / CALENDAR_WEEKS)));
  return Array.from({ length: CALENDAR_WEEKS }, (_, index) => ({
    week: index + 1,
    articles: ordered.slice(index * perWeek, (index + 1) * perWeek).map(({ title, url, quickWin }) => ({ title, url, quickWin })),
  })).filter((week) => week.articles.length > 0);
}

/** Exact, partial and brandable .com ideas; availability must still be checked. */
export function domainIdeas(seed: string, nicheType: NicheType): DomainIdea[] {
  const words = meaningfulWords(seed).map((word) => word.replace(/[^a-z0-9]/g, "")).filter(Boolean);
  if (words.length === 0) return [];
  const full = words.join("");
  const short = words.slice(0, 2).join("");
  const head = words[0]!;
  const ideas: DomainIdea[] = [
    { name: `${full}.com`, style: "exact" },
    { name: `${short}guide.com`, style: "partial" },
    { name: `the${short}hub.com`, style: "partial" },
    { name: `${short}hq.com`, style: "partial" },
    ...BRAND_SUFFIXES[nicheType].map((suffix) => ({ name: `${head}${suffix}.com`, style: "brandable" as const })),
  ];
  const seen = new Set<string>();
  return ideas.filter((idea) => idea.name.length <= 28 && !seen.has(idea.name) && seen.add(idea.name));
}

export type LaunchStep = { title: string; detail: string };

/** The A-to-Z steps from niche to income, tailored to the niche type. */
export function launchSteps(nicheType: NicheType): LaunchStep[] {
  const build: Record<NicheType, string> = {
    info: "Install WordPress (or a static site) with a fast, clean theme.",
    affiliate: "Install WordPress with a review-friendly theme and join the main affiliate programs.",
    tools: "Build the first tool pages (one per keyword) on a fast framework like Next.js.",
    apps: "Set up a fast mobile-first site; link only to official app stores.",
    ai: "Set up the site with a tool-directory template so every AI tool gets a page.",
    saas: "Set up comparison tables and sign up for the software affiliate programs.",
    local: "Create a Google Business Profile and one page per service and city.",
  };
  return [
    { title: "Lock the niche", detail: "Confirm the iSkills check passes and the niche isn't on the avoid list." },
    { title: "Pick a domain", detail: "Choose a short brandable or partial-match .com from the ideas below and check availability." },
    { title: "Build the site", detail: build[nicheType] },
    { title: "Create the structure", detail: "Add the pillar page and one category per silo, with the URLs from this plan." },
    { title: "Publish week by week", detail: "Follow the 12-week calendar: pillar first, then quick wins (difficulty 30 or less)." },
    { title: "Track", detail: "Connect Google Search Console and analytics; submit the sitemap." },
    { title: "Link internally", detail: "Link every article to its pillar and two related articles, as in each brief." },
    { title: "Monetize", detail: "Start with affiliate links; apply to ad networks as traffic grows (Ezoic early, Mediavine at about 50k sessions)." },
    { title: "Refresh and expand", detail: "Update posts stuck on page 2, then add the next sub-niche or the content gap keywords." },
  ];
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}


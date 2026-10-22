import "server-only";

import type { DataForSeoClient } from "@/server/providers/dataforseo/client";
import type {
  NormalizedDomainMetrics,
  NormalizedKeywordIdea,
  NormalizedOrganicResult,
  SearchIntent,
} from "@/server/providers/types";

import { hashString, seededRandom, type Random } from "./random";

/**
 * A DataForSEO stand-in for demos: realistic, deterministic data for any
 * topic, in exactly the shapes the real client returns. Never used unless
 * DEMO_DATA=true.
 */

type Template = { text: (seed: string) => string; intent: SearchIntent; share: [number, number] };

/** Topic-neutral patterns, so products, software, services and how-to topics all read naturally. */
const TEMPLATES: Template[] = [
  { text: (s) => `best ${s}`, intent: "commercial", share: [0.2, 0.45] },
  { text: (s) => `top ${s}`, intent: "commercial", share: [0.03, 0.1] },
  { text: (s) => `free ${s}`, intent: "transactional", share: [0.03, 0.12] },
  { text: (s) => `${s} for beginners`, intent: "informational", share: [0.05, 0.15] },
  { text: (s) => `how to choose ${s}`, intent: "informational", share: [0.02, 0.08] },
  { text: (s) => `how to use ${s}`, intent: "informational", share: [0.02, 0.08] },
  { text: (s) => `is ${s} worth it`, intent: "informational", share: [0.01, 0.04] },
  { text: (s) => `${s} checklist`, intent: "informational", share: [0.03, 0.12] },
  { text: (s) => `${s} mistakes to avoid`, intent: "informational", share: [0.02, 0.08] },
  { text: (s) => `${s} cost`, intent: "commercial", share: [0.01, 0.06] },
  { text: (s) => `${s} pricing`, intent: "commercial", share: [0.01, 0.05] },
  { text: (s) => `${s} reviews`, intent: "commercial", share: [0.02, 0.06] },
  { text: (s) => `${s} comparison`, intent: "commercial", share: [0.01, 0.05] },
  { text: (s) => `${s} pros and cons`, intent: "commercial", share: [0.005, 0.03] },
  { text: (s) => `${s} alternatives`, intent: "commercial", share: [0.01, 0.05] },
  { text: (s) => `${s} examples`, intent: "informational", share: [0.01, 0.05] },
  { text: (s) => `${s} explained`, intent: "informational", share: [0.005, 0.03] },
  { text: (s) => `${s} guide`, intent: "informational", share: [0.01, 0.05] },
  { text: (s) => `${s} ideas`, intent: "informational", share: [0.01, 0.05] },
  { text: (s) => `${s} tips`, intent: "informational", share: [0.005, 0.03] },
  { text: (s) => `${s} step by step`, intent: "informational", share: [0.003, 0.02] },
  { text: (s) => `${s} for small business`, intent: "commercial", share: [0.005, 0.03] },
  { text: (s) => `${s} on a budget`, intent: "commercial", share: [0.003, 0.015] },
  { text: (s) => `${s} 2026`, intent: "informational", share: [0.005, 0.03] },
];

/** Topic-neutral words for "seed + letter" autocomplete; letters without a natural fit return nothing. */
const ALPHABET_WORDS: Record<string, string[]> = {
  a: ["alternatives", "at home", "advice"], b: ["benefits", "basics", "best practices"], c: ["checklist", "cost", "comparison"],
  d: ["deals", "definition", "diy"], e: ["examples", "explained", "essentials"], f: ["for beginners", "faq", "free"],
  g: ["guide", "getting started"], h: ["how to start", "hacks"], i: ["ideas", "in 2026"], k: ["key features"],
  l: ["list", "learning path"], m: ["mistakes", "methods"], n: ["near me", "news"], o: ["online", "options", "overview"],
  p: ["price", "pros and cons", "plan"], q: ["questions"], r: ["reviews", "resources", "requirements"],
  s: ["setup", "strategies"], t: ["tips", "tools", "trends"], u: ["use cases", "updates"], v: ["vs alternatives", "videos"],
  w: ["worth it", "workflow"], y: ["yearly cost"],
};

/** Grammatical question suggestions for "question word + seed" queries. */
const QUESTION_SUGGESTIONS: Record<string, Array<(seed: string) => string>> = {
  how: [(s) => `how to use ${s}`, (s) => `how to choose ${s}`, (s) => `how to get started with ${s}`],
  what: [(s) => `what are the best ${s}`, (s) => `what to look for in ${s}`],
  why: [(s) => `why use ${s}`],
  when: [(s) => `when to use ${s}`],
  where: [(s) => `where to find ${s}`],
  which: [(s) => `which ${s} is best`],
  can: [(s) => `can beginners use ${s}`],
  is: [(s) => `is ${s} worth it`],
  should: [(s) => `should i use ${s}`],
};

/** Completions for "seed + connector" queries such as "seed for" or "seed vs". */
const CONNECTOR_SUGGESTIONS: Record<string, string[]> = {
  for: ["for beginners", "for small business", "for students"],
  vs: ["vs alternatives"],
  near: ["near me"],
  to: ["to avoid"],
  with: [],
  without: [],
};

const BIG_SITES: Array<{ domain: string; titles: (s: string) => string; path: (slug: string) => string }> = [
  { domain: "reddit.com", titles: (s) => `Best ${s}? : r/${slugify(s).replace(/-/g, "")}`, path: (slug) => `/r/${slug.replace(/-/g, "")}/comments/demo/` },
  { domain: "wikipedia.org", titles: (s) => capitalize(s), path: (slug) => `/wiki/${slug}` },
  { domain: "quora.com", titles: (s) => `What are the best ${s}?`, path: (slug) => `/What-are-the-best-${slug}` },
  { domain: "youtube.com", titles: (s) => `${capitalize(s)} — Everything You Need to Know`, path: () => "/watch?v=demo" },
  { domain: "amazon.com", titles: (s) => `Amazon.com: ${capitalize(s)}`, path: (slug) => `/s?k=${slug}` },
  { domain: "pinterest.com", titles: (s) => `${capitalize(s)} ideas`, path: (slug) => `/ideas/${slug}/` },
  { domain: "forbes.com", titles: (s) => `The Best ${capitalize(s)} Of 2026`, path: (slug) => `/vetted/${slug}/` },
  { domain: "nytimes.com", titles: (s) => `The Best ${capitalize(s)} | Wirecutter`, path: (slug) => `/wirecutter/reviews/${slug}/` },
];

const KNOWN_AUTHORITY: Record<string, number> = {
  "reddit.com": 91, "wikipedia.org": 97, "quora.com": 93, "youtube.com": 99, "amazon.com": 96,
  "pinterest.com": 94, "forbes.com": 94, "nytimes.com": 95,
};

const NICHE_SITE_PATTERNS = [
  (w: string) => `${w}guide.com`, (w: string) => `the${w}hub.com`, (w: string) => `${w}central.net`,
  (w: string) => `my${w}blog.com`, (w: string) => `${w}lab.co`, (w: string) => `${w}corner.com`,
  (w: string) => `simply${w}.com`, (w: string) => `${w}insider.org`, (w: string) => `${w}hq.com`,
];

export function createDemoDataForSeoClient(): DataForSeoClient {
  return {
    async getKeywordIdeas(request) {
      const seed = clean(request.keywords[0] ?? "");
      const items = buildKeywordIdeas(seed).slice(0, request.limit ?? 100);
      return { taskId: `demo-${hashString(seed)}`, cost: 0, totalCount: items.length, items, outcome: "complete", warning: null };
    },

    async getOrganicSerp(request) {
      const keyword = clean(request.keyword);
      const random = seededRandom(`serp:${keyword}`);
      const items = buildSerp(keyword, random).slice(0, request.depth ?? 10);
      const features = ["organic", "people_also_ask", ...(random.chance(0.4) ? ["ai_overview"] : [])];
      return {
        taskId: `demo-serp-${hashString(keyword)}`, cost: 0, keyword, checkedAt: new Date().toISOString(),
        // allintitle: queries match far fewer pages; keep counts in a realistic KGR range.
        totalResults: keyword.startsWith("allintitle:") ? random.int(2, 400) : random.int(200_000, 90_000_000),
        features, items, outcome: "complete", warning: null,
      };
    },

    async getDomainMetrics(request) {
      return { cost: 0, items: request.domains.map((domain) => demoDomainMetrics(clean(domain))) };
    },

    async getDomainIntersection(request) {
      const random = seededRandom(`gap:${request.competitorDomain}:${request.targetDomain}`);
      const topic = request.competitorDomain.split(".")[0]!.replace(/(guide|hub|central|blog|lab|corner|insider|hq|simply|my|the)/g, " ").trim() || "topic";
      const angles = ["for wide feet", "explained", "vs cheaper options", "for heavy use", "care tips", "common mistakes", "starter kit", "on a budget", "for travel", "checklist"];
      return {
        cost: 0,
        items: angles.slice(0, random.int(5, angles.length)).map((angle) => ({
          keyword: `${topic} ${angle}`,
          searchVolume: random.int(300, 18_000),
          cpc: round(random.next() * 2.5 + 0.2, 2),
          keywordDifficulty: random.int(8, 48),
          competitorRank: random.int(1, 15),
        })),
      };
    },

    async getAutocomplete(request) {
      const result = autocomplete(clean(request.keyword));
      return { ...result, suggestions: [...new Set(result.suggestions.map(collapseRepeats))] };
    },

    async getKeywordOverview(request) {
      return { cost: 0, items: request.keywords.map((keyword) => keywordMetrics(clean(keyword), "informational", [0.002, 0.03], seedVolume(keyword))) };
    },
  };
}

/** Demo autocomplete: natural completions for letter, question and connector queries. */
function autocomplete(query: string) {
  const random = seededRandom(`ac:${query}`);
  const words = query.split(" ");
  const first = words[0] ?? "";
  const last = words.at(-1) ?? "";
  const pick = (items: string[]) => items.slice(0, random.int(1, Math.max(1, items.length)));
  if (last.length === 1) {
    const base = words.slice(0, -1).join(" ");
    return { cost: 0, suggestions: pick(ALPHABET_WORDS[last] ?? []).map((word) => `${base} ${word}`) };
  }
  if (QUESTION_SUGGESTIONS[first] !== undefined || ["who", "are", "does"].includes(first)) {
    const seed = words.slice(1).join(" ");
    return { cost: 0, suggestions: pick((QUESTION_SUGGESTIONS[first] ?? []).map((build) => build(seed))) };
  }
  if (CONNECTOR_SUGGESTIONS[last] !== undefined) {
    const base = words.slice(0, -1).join(" ");
    return { cost: 0, suggestions: pick(CONNECTOR_SUGGESTIONS[last]!).map((ending) => `${base} ${ending}`) };
  }
  return { cost: 0, suggestions: pick([`${query} for beginners`, `${query} 2026`, `${query} on a budget`]) };
}

function buildKeywordIdeas(seed: string): NormalizedKeywordIdea[] {
  const base = seedVolume(seed);
  const random = seededRandom(`ideas:${seed}`);
  const seedIdea = keywordMetrics(seed, random.chance(0.6) ? "commercial" : "informational", [1, 1], base);
  const phrases = [...new Set(TEMPLATES.map((template) => collapseRepeats(template.text(seed))))].filter((phrase) => phrase !== seed);
  return [seedIdea, ...phrases.map((phrase) => {
    const template = TEMPLATES.find((item) => collapseRepeats(item.text(seed)) === phrase)!;
    return keywordMetrics(phrase, template.intent, template.share, base);
  })];
}

/** "best best ai tools" → "best ai tools". */
function collapseRepeats(phrase: string) {
  const words = phrase.split(" ");
  return words.filter((word, index) => word !== words[index - 1]).join(" ");
}

/** Seed volume between ~800 and ~300k, stable per topic; longer topics are smaller. */
function seedVolume(seed: string) {
  const random = seededRandom(`volume:${seed}`);
  const words = seed.split(" ").length;
  const ceiling = words >= 3 ? 40_000 : words === 2 ? 250_000 : 400_000;
  return Math.round(random.int(800, ceiling) / 10) * 10;
}

function keywordMetrics(keyword: string, intent: SearchIntent, share: [number, number], base: number): NormalizedKeywordIdea {
  const random = seededRandom(`kw:${keyword}`);
  const volume = Math.max(10, Math.round((base * (share[0] + random.next() * (share[1] - share[0]))) / 10) * 10);
  // Bigger terms tend to be harder.
  const difficulty = Math.min(95, Math.max(3, Math.round(Math.log10(volume + 10) * 14 + random.int(-12, 14))));
  const competition = round(Math.min(1, random.next() * 0.6 + (intent === "transactional" ? 0.4 : 0.1)), 2);
  const now = new Date();
  return {
    keyword,
    searchVolume: volume,
    cpc: round(random.next() * 3 + (intent === "informational" ? 0.1 : 0.6), 2),
    competition,
    competitionLevel: competition < 0.34 ? "LOW" : competition < 0.67 ? "MEDIUM" : "HIGH",
    keywordDifficulty: difficulty,
    intent,
    monthlySearches: Array.from({ length: 12 }, (_, offset) => {
      const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - 11 + offset, 1));
      const seasonal = 1 + 0.3 * Math.sin((date.getUTCMonth() + (hashString(keyword) % 12)) / 1.9);
      return { year: date.getUTCFullYear(), month: date.getUTCMonth() + 1, searchVolume: Math.round(volume * seasonal) };
    }),
  };
}

/** Top 10: a topic-dependent mix of big platforms and small niche sites. */
function buildSerp(keyword: string, random: Random): NormalizedOrganicResult[] {
  const slug = slugify(keyword);
  const words = keyword.split(" ").filter((word) => word.length > 2);
  const nicheCount = random.int(1, 5);
  const big = [...BIG_SITES].sort(() => random.next() - 0.5).slice(0, 10 - nicheCount);
  const niche = Array.from({ length: nicheCount }, (_, index) => {
    const word = (words[index % Math.max(words.length, 1)] ?? "niche").replace(/[^a-z0-9]/g, "");
    const domain = NICHE_SITE_PATTERNS[(hashString(keyword) + index) % NICHE_SITE_PATTERNS.length]!(word);
    const homepage = index === 0 && random.chance(0.6);
    return { domain, title: homepage ? `${capitalize(keyword)} — Guides & Reviews` : `${capitalize(keyword)}: A Practical Guide`, path: homepage ? "/" : `/${slug}/` };
  });
  const mixed = [
    ...big.map((site) => ({ domain: site.domain, title: site.titles(keyword), path: site.path(slug) })),
    ...niche,
  ].sort(() => random.next() - 0.5);
  return mixed.map((site, index) => ({
    rank: index + 1,
    rankAbsolute: index + 1,
    title: site.title,
    description: `${capitalize(keyword)} explained with tips, comparisons and answers to common questions.`,
    url: `https://${site.domain === "wikipedia.org" ? "en.wikipedia.org" : `www.${site.domain}`}${site.path}`,
    domain: site.domain === "wikipedia.org" ? "en.wikipedia.org" : `www.${site.domain}`,
  }));
}

/** Stable metrics per domain; well-known platforms get realistic authority. */
export function demoDomainMetrics(domain: string): NormalizedDomainMetrics {
  const random = seededRandom(`domain:${domain}`);
  const known = KNOWN_AUTHORITY[domain];
  const authority = known ?? Math.min(70, Math.round(random.next() ** 1.6 * 60) + 3);
  const traffic = Math.round(10 ** (authority / 16 + random.next()));
  const age = known ? random.int(15, 25) : round(random.next() ** 1.4 * 14 + 0.4, 1);
  // Anchored to midnight UTC so repeated calls return the same date.
  const today = new Date();
  const midnight = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  const registeredAt = new Date(midnight - Math.round(age * 365.25) * 86_400_000).toISOString();
  return {
    domain,
    authority,
    backlinks: Math.round(traffic * (random.next() * 4 + 1)),
    referringDomains: Math.round(Math.sqrt(traffic) * (random.next() * 3 + 1)),
    monthlyTraffic: traffic,
    rankingKeywords: Math.round(traffic / (random.next() * 20 + 8)),
    registeredAt,
  };
}

function clean(value: string) {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

function slugify(value: string) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
}

function capitalize(value: string) {
  return value.replace(/\b\w/g, (letter) => letter.toUpperCase());
}

function round(value: number, digits: number) {
  const factor = 10 ** digits;
  return Math.round(value * factor) / factor;
}

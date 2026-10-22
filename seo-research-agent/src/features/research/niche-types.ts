import { isQuestionKeyword } from "./niche";

/**
 * Niche types decide how a site makes money and what content it needs, so the
 * whole launch plan adapts to the type detected for the searched topic.
 */

export const NICHE_TYPES = ["info", "affiliate", "tools", "apps", "ai", "saas", "local"] as const;
export type NicheType = (typeof NICHE_TYPES)[number];

export type NicheTypeProfile = {
  label: string;
  summary: string;
  /** Display-ad revenue per 1,000 pageviews used for the revenue estimate. */
  rpmUsd: number;
  monetization: string[];
  contentFormats: string[];
  strategy: string[];
  cautions: string[];
};

export const NICHE_TYPE_PROFILES: Record<NicheType, NicheTypeProfile> = {
  info: {
    label: "Info blogging",
    summary: "Informational content — how-tos, guides and explainers that answer real questions.",
    rpmUsd: 20,
    monetization: ["Display ads (Ezoic, Mediavine, Raptive)", "Affiliate links later", "Email list and digital products"],
    contentFormats: ["How-to guides", "Problem/solution posts", "Beginner explainers", "Checklists"],
    strategy: ["Answer every question cluster with its own article", "Build one pillar per sub-topic and link everything to it", "Refresh posts that reach page 2"],
    cautions: ["Watch for AI Overviews eating clicks on simple questions"],
  },
  affiliate: {
    label: "Affiliate / product reviews",
    summary: "Commercial content — best-of lists, reviews and comparisons that earn commissions.",
    rpmUsd: 25,
    monetization: ["Amazon Associates and brand affiliate programs", "Display ads on informational posts", "Sponsored reviews"],
    contentFormats: ["Best X for Y lists", "Single product reviews", "X vs Y comparisons", "Buying guides"],
    strategy: ["Start with long-tail 'best X for Y' keywords", "Show first-hand testing, photos and pros/cons (E-E-A-T)", "Support money pages with informational posts"],
    cautions: ["Big review sites dominate head terms", "Thin reviews without real experience rarely rank"],
  },
  tools: {
    label: "Online tools",
    summary: "Free tools — calculators, converters, generators — that people use and come back to.",
    rpmUsd: 12,
    monetization: ["Display ads on high-pageview tool pages", "Premium tool features", "Affiliate links next to results"],
    contentFormats: ["One tool page per keyword", "How-to-use guides", "Formula explainers", "Programmatic pages per variation"],
    strategy: ["Ship a fast, simple tool for each keyword variation", "Add a short explainer under every tool", "Scale with programmatic pages (one per unit, size or format)"],
    cautions: ["Needs development time", "Big tool sites rank fast for head terms — go specific"],
  },
  apps: {
    label: "Apps & APK",
    summary: "App content — guides, features, updates and alternatives for mobile apps and games.",
    rpmUsd: 6,
    monetization: ["Display ads", "App install / referral programs", "Game top-up affiliates"],
    contentFormats: ["App guides and tips", "Update and patch notes", "Best alternatives", "Settings and troubleshooting"],
    strategy: ["Cover new apps and updates quickly", "Own troubleshooting questions ('not working', 'how to fix')", "Link only to official stores"],
    cautions: ["Never host or link modded, cracked or pirated APK files", "Low ad rates from mobile-heavy, worldwide traffic"],
  },
  ai: {
    label: "AI tools & agents",
    summary: "AI content — tool reviews, agent tutorials, prompt libraries and comparisons.",
    rpmUsd: 18,
    monetization: ["AI tool affiliate programs (often recurring)", "Sponsored listings in a tool directory", "Display ads", "Courses and prompt packs"],
    contentFormats: ["Best AI tools for X", "Agent setup tutorials", "Prompt libraries", "Tool X vs Tool Y", "AI tool directory pages"],
    strategy: ["Publish fast on new tools and agents", "Build a directory with one page per tool", "Write hands-on tutorials with screenshots"],
    cautions: ["Fast-moving — content ages quickly", "Heavy competition from big tech blogs"],
  },
  saas: {
    label: "SaaS / software",
    summary: "Software content — best software lists, alternatives and comparisons for business buyers.",
    rpmUsd: 30,
    monetization: ["Recurring SaaS affiliate commissions (20–40%)", "Lead generation", "Sponsored placements"],
    contentFormats: ["Best X software for Y", "X alternatives", "X vs Y", "Pricing breakdowns", "Use-case guides"],
    strategy: ["Target 'alternatives' and 'vs' keywords first — buyers search them", "Niche down by audience (freelancers, small teams)", "Keep pricing tables up to date"],
    cautions: ["Software brands rank for their own terms", "B2B buyers need trustworthy, detailed content"],
  },
  local: {
    label: "Local services",
    summary: "Local service content — 'near me' searches that turn into calls and bookings.",
    rpmUsd: 10,
    monetization: ["Rank-and-rent lead generation", "Pay-per-call", "Local business directories"],
    contentFormats: ["Service + city pages", "Cost guides", "Local FAQ pages", "Google Business Profile"],
    strategy: ["One page per service per city", "Get local citations and reviews", "Cover cost and 'how to choose' questions"],
    cautions: ["Needs a Google Business Profile to win the map pack", "Rank-and-rent needs a business partner"],
  },
};

const TYPE_PATTERNS: ReadonlyArray<{ type: NicheType; pattern: RegExp }> = [
  { type: "ai", pattern: /\b(ai|gpt|chatgpt|claude|gemini|llm|agents?|prompts?|copilot|midjourney|machine learning|automation)\b/ },
  { type: "apps", pattern: /\b(apk|app|apps|android|ios|iphone app|game guide|mobile game|mod menu)\b/ },
  { type: "tools", pattern: /\b(calculator|converter|generator|checker|counter|maker|finder|estimator|template|templates|formula)\b/ },
  { type: "saas", pattern: /\b(software|saas|crm|erp|platform|plugin|extension|hosting|api|invoicing|scheduling app|project management)\b/ },
  { type: "local", pattern: /\b(near me|plumber|electrician|dentist|lawyer|roofer|locksmith|movers|cleaning service|repair service|in (new york|london|dubai|karachi|lahore|toronto|sydney))\b/ },
];

/**
 * Classifies a topic by explicit signals first (AI, apps, tools, SaaS,
 * local), then by keyword intent: mostly commercial keywords mean an
 * affiliate niche, otherwise info blogging.
 */
export function classifyNicheType(seed: string, keywords: readonly { keyword: string; intent: string }[] = []): NicheType {
  const text = seed.toLowerCase();
  const explicit = TYPE_PATTERNS.find(({ pattern }) => pattern.test(text));
  if (explicit) return explicit.type;

  if (keywords.length > 0) {
    const commercial = keywords.filter(({ keyword, intent }) =>
      intent === "commercial" || intent === "transactional" || /\b(best|review|reviews|vs|buy|cheap|top)\b/.test(keyword)).length;
    const questions = keywords.filter(({ keyword }) => isQuestionKeyword(keyword)).length;
    if (commercial / keywords.length >= 0.5 && commercial > questions) return "affiliate";
  }
  return /\b(best|review|reviews|vs|buy)\b/.test(text) ? "affiliate" : "info";
}

import { normalizePhrase } from "./autocomplete";

/**
 * Groups the keywords a search actually collected by how they extend the
 * topic, the way an autocomplete coverage map does. Nothing is invented:
 * a group only lists real keywords.
 */

export type PatternGroupId = "questions" | "modifiers" | "before" | "after";
export type PackGroupId = "saas" | "tools" | "apk" | "info" | "affiliate" | "ecommerce";

export type CoverageKeywordInput = { id: number; keyword: string; searchVolume: number | null; difficulty: number | null };

export type CoverageGroup<T> = {
  id: PatternGroupId | PackGroupId;
  label: string;
  description: string;
  keywords: T[];
  totalVolume: number;
  /** Keywords with difficulty 30 or less. */
  easyCount: number;
};

export const EASY_DIFFICULTY_MAX = 30;

const QUESTION_WORDS = new Set(["how", "what", "why", "when", "where", "which", "who", "can", "is", "are", "does", "do", "should", "will"]);
const MODIFIER_PATTERN = /\b(best|top|free|cheap|affordable|vs|versus|review|reviews|alternative|alternatives|for beginners|near me|price|pricing|cost|20\d\d)\b/;

const PATTERNS: Record<PatternGroupId, { label: string; description: string }> = {
  questions: { label: "Questions", description: "who, what, how and other questions people ask" },
  modifiers: { label: "Modifiers", description: "best, free, vs, review, price, year" },
  before: { label: "Before the topic", description: "words people type before the topic" },
  after: { label: "After the topic", description: "words people type after the topic" },
};

const PACKS: Record<PackGroupId, { label: string; description: string; pattern: RegExp }> = {
  saas: { label: "SaaS", description: "software, platforms and subscriptions", pattern: /\b(software|platform|saas|crm|subscription|integrations?|dashboard)\b/ },
  tools: { label: "Tools", description: "calculators, generators, checkers and templates", pattern: /\b(tools?|calculator|generator|checker|converter|maker|templates?|planner|tracker)\b/ },
  apk: { label: "Apps & APK", description: "apps, downloads and mobile", pattern: /\b(apk|apps?|download|android|iphone|ios|mobile)\b/ },
  info: { label: "Info", description: "guides, tips, examples and explanations", pattern: /\b(guide|tips|examples?|explained|tutorial|definition|meaning|ideas|basics|checklist|how|what|why)\b/ },
  affiliate: { label: "Affiliate", description: "reviews, comparisons and deals", pattern: /\b(best|top|reviews?|vs|alternatives?|deals?|coupon|discount|comparison|compared)\b/ },
  ecommerce: { label: "E-commerce", description: "buying, prices and stores", pattern: /\b(buy|price|pricing|cheap|shop|sale|order|delivery|cost|store|near me)\b/ },
};

/** Which pattern section a keyword belongs to, or null for the seed itself and unrelated phrasings. */
export function patternOf(seedInput: string, keywordInput: string): PatternGroupId | null {
  const seed = normalizePhrase(seedInput);
  const keyword = normalizePhrase(keywordInput);
  if (!seed || keyword === seed) return null;
  const at = ` ${keyword} `.indexOf(` ${seed} `);
  const extra = at === -1 ? keyword : `${keyword.slice(0, at)} ${keyword.slice(at + seed.length)}`.trim();
  const firstWord = keyword.split(" ")[0]!;
  if (QUESTION_WORDS.has(firstWord)) return "questions";
  if (MODIFIER_PATTERN.test(extra)) return "modifiers";
  if (at === -1) return null;
  return at === 0 ? "after" : "before";
}

export function buildCoverageGroups<T extends CoverageKeywordInput>(seed: string, keywords: readonly T[]) {
  const byPattern = new Map<PatternGroupId, T[]>();
  const byPack = new Map<PackGroupId, T[]>();
  for (const keyword of keywords) {
    const pattern = patternOf(seed, keyword.keyword);
    if (pattern) byPattern.set(pattern, [...(byPattern.get(pattern) ?? []), keyword]);
    const text = normalizePhrase(keyword.keyword);
    for (const [id, pack] of Object.entries(PACKS) as [PackGroupId, (typeof PACKS)[PackGroupId]][]) {
      if (pack.pattern.test(text)) byPack.set(id, [...(byPack.get(id) ?? []), keyword]);
    }
  }
  const patterns = (Object.keys(PATTERNS) as PatternGroupId[])
    .map((id) => toGroup(id, PATTERNS[id], byPattern.get(id) ?? []))
    .filter((group) => group.keywords.length > 0);
  const packs = (Object.keys(PACKS) as PackGroupId[])
    .map((id) => toGroup(id, PACKS[id], byPack.get(id) ?? []))
    .filter((group) => group.keywords.length > 0);
  return { patterns, packs };
}

function toGroup<T extends CoverageKeywordInput>(
  id: PatternGroupId | PackGroupId,
  meta: { label: string; description: string },
  keywords: T[],
): CoverageGroup<T> {
  const sorted = [...keywords].sort((a, b) => (b.searchVolume ?? -1) - (a.searchVolume ?? -1) || a.keyword.localeCompare(b.keyword));
  return {
    id,
    label: meta.label,
    description: meta.description,
    keywords: sorted,
    totalVolume: sorted.reduce((sum, keyword) => sum + (keyword.searchVolume ?? 0), 0),
    easyCount: sorted.filter((keyword) => keyword.difficulty !== null && keyword.difficulty <= EASY_DIFFICULTY_MAX).length,
  };
}

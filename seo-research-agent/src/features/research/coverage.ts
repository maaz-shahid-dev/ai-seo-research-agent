import { meaningfulWords, normalizePhrase } from "./autocomplete";
import { isQuestionKeyword } from "./niche";

/**
 * Builds a topical map: keywords grouped into articles. Each keyword joins the
 * topic of its most popular non-seed word, so "running shoes for flat feet"
 * and "best flat feet running shoes" share one "flat feet" article.
 */

export type CoverageKeyword = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  intent: string;
};

export type ArticleType = "pillar" | "how-to" | "best-of" | "comparison" | "guide";

export type ContentCluster = {
  topic: string;
  articleType: ArticleType;
  mainKeyword: string;
  keywords: CoverageKeyword[];
  totalVolume: number;
  averageDifficulty: number | null;
};

export type CoverageSize = "small" | "manageable" | "large";

/** Pages a solo site can realistically publish in its first months. */
export const MANAGEABLE_MAX_PAGES = 60;
const SMALL_MAX_PAGES = 10;
const IGNORED_TOPIC_WORDS = new Set([
  "best", "top", "how", "what", "why", "when", "where", "which", "who", "can", "is", "are", "does", "do", "should",
  "vs", "versus", "near", "me", "without", "good", "cheap", "buy", "free", "2024", "2025", "2026", "list", "ideas",
]);

export function buildContentPlan(seedInput: string, keywords: readonly CoverageKeyword[]) {
  const seedWords = new Set(meaningfulWords(normalizePhrase(seedInput)).flatMap((word) => [word, word.replace(/s$/, ""), `${word}s`]));
  const topicWords = keywords.map((item) =>
    meaningfulWords(normalizePhrase(item.keyword)).filter((word) => !seedWords.has(word) && !IGNORED_TOPIC_WORDS.has(word) && word.length > 2));

  // How much search demand each word carries across all keywords.
  const wordWeight = new Map<string, number>();
  keywords.forEach((item, index) => {
    for (const word of new Set(topicWords[index])) {
      wordWeight.set(word, (wordWeight.get(word) ?? 0) + (item.searchVolume ?? 0) + 1);
    }
  });

  const groups = new Map<string, CoverageKeyword[]>();
  keywords.forEach((item, index) => {
    const words = topicWords[index]!;
    const topic = words.length === 0
      ? ""
      : words.reduce((best, word) => ((wordWeight.get(word) ?? 0) > (wordWeight.get(best) ?? 0) ? word : best));
    groups.set(topic, [...(groups.get(topic) ?? []), item]);
  });

  const clusters: ContentCluster[] = [...groups.entries()].map(([topic, items]) => {
    const sorted = [...items].sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0));
    const difficulties = items.flatMap((item) => (item.difficulty === null ? [] : [item.difficulty]));
    return {
      topic: topic || normalizePhrase(seedInput),
      articleType: topic ? articleTypeFor(items) : "pillar",
      mainKeyword: sorted[0]!.keyword,
      keywords: sorted,
      totalVolume: items.reduce((sum, item) => sum + (item.searchVolume ?? 0), 0),
      averageDifficulty: difficulties.length ? Math.round(difficulties.reduce((sum, value) => sum + value, 0) / difficulties.length) : null,
    };
  });
  clusters.sort((a, b) => (a.articleType === "pillar" ? -1 : b.articleType === "pillar" ? 1 : b.totalVolume - a.totalVolume));

  return {
    clusters,
    pages: clusters.length,
    totalVolume: clusters.reduce((sum, cluster) => sum + cluster.totalVolume, 0),
    size: coverageSize(clusters.length),
  };
}

export function coverageSize(pages: number): CoverageSize {
  return pages <= SMALL_MAX_PAGES ? "small" : pages <= MANAGEABLE_MAX_PAGES ? "manageable" : "large";
}

function articleTypeFor(items: readonly CoverageKeyword[]): ArticleType {
  const text = items.map((item) => item.keyword.toLowerCase());
  const share = (test: (keyword: string) => boolean) => text.filter(test).length / text.length;
  if (share((keyword) => /\b(vs|versus|or)\b/.test(keyword)) >= 0.3) return "comparison";
  if (share((keyword) => /\b(best|top|review|reviews)\b/.test(keyword)) >= 0.3) return "best-of";
  if (share(isQuestionKeyword) >= 0.3) return "how-to";
  return "guide";
}

export const ARTICLE_TYPE_LABELS: Record<ArticleType, string> = {
  pillar: "Pillar page",
  "how-to": "How-to / Q&A",
  "best-of": "Best-of list",
  comparison: "Comparison",
  guide: "Guide",
};

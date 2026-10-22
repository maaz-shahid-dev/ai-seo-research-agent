import { buildCoverageGroups } from "./coverage-groups";
import { ARTICLE_TYPE_LABELS, buildContentPlan } from "./coverage";
import { marketFor } from "./markets";
import { rankOpportunities, TIER_LABELS } from "./opportunity";
import type { AiAnalysisDto, KeywordDto, ResearchRunDto } from "./types";

const TOP_OPPORTUNITIES = 15;
const TOP_CLUSTERS = 12;
const GROUP_EXAMPLES = 5;

export type ResearchReport = ReturnType<typeof buildResearchReport>;

/** Everything a shareable report shows, computed once from the stored research. */
export function buildResearchReport(run: ResearchRunDto, keywords: readonly KeywordDto[], analysis: AiAnalysisDto | null) {
  const opportunities = rankOpportunities(keywords);
  const rated = keywords.filter((keyword) => keyword.difficulty !== null);
  const seed = keywords.find((keyword) => keyword.source === "seed")?.keyword ?? run.query;
  const coverage = buildCoverageGroups(seed, keywords);
  const plan = buildContentPlan(seed, keywords);

  const top = [...keywords]
    .filter((keyword) => opportunities.has(keyword.id))
    .sort((a, b) => opportunities.get(b.id)!.score - opportunities.get(a.id)!.score)
    .slice(0, TOP_OPPORTUNITIES)
    .map((keyword) => ({
      keyword: keyword.keyword,
      searchVolume: keyword.searchVolume,
      difficulty: keyword.difficulty,
      score: opportunities.get(keyword.id)!.score,
      tier: TIER_LABELS[opportunities.get(keyword.id)!.tier],
    }));

  return {
    title: run.query,
    market: marketFor(run.countryCode)?.name ?? run.countryCode,
    createdAt: run.createdAt,
    stats: {
      keywords: keywords.length,
      monthlySearches: keywords.reduce((sum, keyword) => sum + (keyword.searchVolume ?? 0), 0),
      averageDifficulty: rated.length ? Math.round(rated.reduce((sum, keyword) => sum + keyword.difficulty!, 0) / rated.length) : null,
    },
    summary: analysis?.status === "completed" ? analysis.summary : null,
    nextSteps: analysis?.output?.nextSteps.map((step) => step.statement) ?? [],
    topOpportunities: top,
    coverage: [...coverage.patterns, ...coverage.packs].map((group) => ({
      label: group.label,
      count: group.keywords.length,
      easyCount: group.easyCount,
      totalVolume: group.totalVolume,
      examples: group.keywords.slice(0, GROUP_EXAMPLES).map((keyword) => keyword.keyword),
    })),
    clusters: plan.clusters.slice(0, TOP_CLUSTERS).map((cluster) => ({
      topic: cluster.topic,
      type: ARTICLE_TYPE_LABELS[cluster.articleType],
      mainKeyword: cluster.mainKeyword,
      keywords: cluster.keywords.length,
      totalVolume: cluster.totalVolume,
      averageDifficulty: cluster.averageDifficulty,
    })),
    totalClusters: plan.clusters.length,
  };
}

const numberFormat = new Intl.NumberFormat("en-US");
const dateFormat = new Intl.DateTimeFormat("en-US", { year: "numeric", month: "long", day: "numeric", timeZone: "UTC" });
const num = (value: number | null) => (value === null ? "—" : numberFormat.format(value));
/** Keeps provider text on one line and out of table syntax. */
const cell = (value: string) => value.replace(/\s+/g, " ").replace(/\|/g, "/").trim();

export function formatReportDate(iso: string) {
  return dateFormat.format(new Date(iso));
}

export function reportToMarkdown(report: ResearchReport) {
  const lines = [
    `# Niche report: ${cell(report.title)}`,
    "",
    `${report.market} · ${formatReportDate(report.createdAt)}`,
    "",
    `- Keywords: ${num(report.stats.keywords)}`,
    `- Monthly searches: ${num(report.stats.monthlySearches)}`,
    `- Average KD: ${report.stats.averageDifficulty === null ? "—" : `${report.stats.averageDifficulty} / 100`}`,
    "",
  ];
  if (report.summary) lines.push("## Summary", "", cell(report.summary), "");
  if (report.nextSteps.length) lines.push("## Next steps", "", ...report.nextSteps.map((step) => `- ${cell(step)}`), "");
  if (report.topOpportunities.length) {
    lines.push("## Top opportunities", "", "| Keyword | Opportunity | Volume | KD |", "|---|---|---:|---:|");
    for (const row of report.topOpportunities) {
      lines.push(`| ${cell(row.keyword)} | ${row.score} (${row.tier}) | ${num(row.searchVolume)} | ${num(row.difficulty)} |`);
    }
    lines.push("");
  }
  if (report.coverage.length) {
    lines.push("## Content coverage", "");
    for (const group of report.coverage) {
      lines.push(`### ${group.label} (${group.count}, ${group.easyCount} easy, ${num(group.totalVolume)} searches/mo)`, "", ...group.examples.map((example) => `- ${cell(example)}`), "");
    }
  }
  if (report.clusters.length) {
    lines.push(`## Content plan (top ${report.clusters.length} of ${report.totalClusters} pages)`, "", "| Topic | Page type | Best keyword | Keywords | Volume | Avg KD |", "|---|---|---|---:|---:|---:|");
    for (const cluster of report.clusters) {
      lines.push(`| ${cell(cluster.topic)} | ${cluster.type} | ${cell(cluster.mainKeyword)} | ${cluster.keywords} | ${num(cluster.totalVolume)} | ${num(cluster.averageDifficulty)} |`);
    }
    lines.push("");
  }
  return `${lines.join("\n").trimEnd()}\n`;
}

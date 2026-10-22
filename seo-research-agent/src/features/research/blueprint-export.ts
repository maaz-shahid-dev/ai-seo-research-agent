import { slugify, type buildBlueprint, type LaunchStep } from "./blueprint";
import { ARTICLE_TYPE_LABELS } from "./coverage";
import { NICHE_TYPE_PROFILES } from "./niche-types";

type Blueprint = ReturnType<typeof buildBlueprint>;

const numberFormat = new Intl.NumberFormat("en-US");

/** Keeps provider text on one line so it can't break the Markdown structure. */
function inline(value: string) {
  return value.replace(/\s+/g, " ").trim();
}

/** The whole launch plan as one Markdown document, ready to share or paste into a doc. */
export function blueprintToMarkdown(blueprint: Blueprint, steps: readonly LaunchStep[], completed: ReadonlySet<string> = new Set()) {
  const lines: string[] = [
    `# Launch plan: ${inline(blueprint.seed)}`,
    "",
    `- Niche type: ${NICHE_TYPE_PROFILES[blueprint.nicheType].label}`,
    `- Articles: ${numberFormat.format(blueprint.totals.articles)} (${numberFormat.format(blueprint.totals.quickWins)} quick wins)`,
    `- Words to write: ${numberFormat.format(blueprint.totals.words)}`,
    "",
    "## Launch steps",
    "",
    ...steps.map((step) => `- [${completed.has(step.title) ? "x" : " "}] **${inline(step.title)}**: ${inline(step.detail)}`),
    "",
    "## Domain name ideas",
    "",
    ...blueprint.domains.map((domain) => `- ${domain.name} (${domain.style})`),
    "",
    "## Site structure",
    "",
  ];
  for (const silo of blueprint.silos) {
    lines.push(`### ${inline(silo.name)} (${silo.path})`, "", ...silo.articles.map((article) => `- ${article.url}: ${inline(article.title)}`), "");
  }
  lines.push("## 12-week publishing calendar", "");
  for (const week of blueprint.calendar) {
    lines.push(`### Week ${week.week}`, "", ...week.articles.map((article) => `- ${inline(article.title)}${article.quickWin ? " (quick win)" : ""}`), "");
  }
  lines.push("## Content briefs", "");
  blueprint.briefs.forEach((brief, index) => {
    lines.push(
      `### ${index + 1}. ${inline(brief.title)}`,
      "",
      `- URL: ${brief.url}`,
      `- Type: ${ARTICLE_TYPE_LABELS[brief.articleType]}${brief.quickWin ? " · quick win" : ""}`,
      `- Target keyword: ${inline(brief.targetKeyword)}`,
      `- Secondary keywords: ${brief.secondaryKeywords.map(inline).join(", ") || "none"}`,
      `- Monthly searches: ${numberFormat.format(brief.monthlyVolume)} · difficulty: ${brief.difficulty ?? "unknown"} · ~${numberFormat.format(brief.wordCount)} words`,
      `- Internal links: ${brief.internalLinks.join(", ") || "none"}`,
      "",
      "Outline:",
      "",
      ...brief.outline.map((heading, position) => `${position + 1}. ${inline(heading)}`),
      "",
    );
    if (brief.questions.length > 0) lines.push("Questions to answer:", "", ...brief.questions.map((question) => `- ${inline(question)}`), "");
  });
  return `${lines.join("\n").trimEnd()}\n`;
}

export function launchPlanFileName(seed: string) {
  return `${slugify(seed) || "niche"}-launch-plan.md`;
}

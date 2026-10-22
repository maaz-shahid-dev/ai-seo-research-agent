import "server-only";

import { meaningfulWords, normalizePhrase } from "@/features/research/autocomplete";
import { restrictedNiche } from "@/features/research/restricted";
import { listMissingEnvironmentKeys } from "@/server/config/environment-schema";
import { getDatabase } from "@/server/db/client";
import { insertNicheIdeas, listLatestNicheIdeas, listRecentNicheSeeds } from "@/server/db/repositories";
import { logger } from "@/server/logging/logger";
import { createOpenAiAnalysisClient, type NicheIdea } from "@/server/providers";

import { inngest } from "./client";
import { withProviderErrors } from "./provider-errors";

const IDEAS_PER_DAY = 12;
const NO_REPEAT_DAYS = 30;

/** Every morning (UTC): fresh, specific niche ideas that pass the avoid list. */
export const generateDailyNiches = inngest.createFunction(
  {
    id: "generate-daily-niches-v1",
    name: "Generate daily niche ideas",
    triggers: [{ cron: "0 5 * * *" }],
    singleton: { mode: "skip" },
    retries: 3,
  },
  async ({ step }) => {
    const today = new Date().toISOString().slice(0, 10);
    if (listMissingEnvironmentKeys(process.env, ["OPENAI_API_KEY", "OPENAI_MODEL"]).length > 0) {
      logger.warn("Daily niches skipped: OpenAI is not configured");
      return { status: "skipped", reason: "openai-not-configured" };
    }

    const existing = await step.run("check-today", async () => (await listLatestNicheIdeas(getDatabase())).date);
    if (existing === today) return { status: "skipped", reason: "already-generated" };

    const avoid = await step.run("recent-seeds", () =>
      listRecentNicheSeeds(getDatabase(), daysAgo(today, NO_REPEAT_DAYS)));

    const ideas = await step.run("generate-ideas", () =>
      withProviderErrors(() => createOpenAiAnalysisClient().generateNicheIdeas({ date: today, count: IDEAS_PER_DAY, avoid })));

    const accepted = acceptableNicheIdeas(ideas.ideas, avoid);
    await step.run("store-ideas", () => insertNicheIdeas(getDatabase(), today, accepted));
    return { status: "completed", stored: accepted.length, rejected: ideas.ideas.length - accepted.length };
  },
);

/** Drops restricted, too-broad or repeated ideas, whatever the model returned. */
export function acceptableNicheIdeas(ideas: readonly NicheIdea[], recentSeeds: readonly string[]) {
  const seen = new Set(recentSeeds.map(normalizePhrase));
  return ideas.filter((idea) => {
    const seed = normalizePhrase(idea.seedKeyword);
    if (!seed || seen.has(seed)) return false;
    if (meaningfulWords(seed).length < 2) return false;
    if (restrictedNiche(`${idea.niche} ${idea.seedKeyword} ${idea.problem}`)) return false;
    seen.add(seed);
    return true;
  });
}

function daysAgo(isoDate: string, days: number) {
  return new Date(Date.parse(`${isoDate}T00:00:00Z`) - days * 86_400_000).toISOString().slice(0, 10);
}

import "server-only";

import { meaningfulWords, normalizePhrase } from "@/features/research/autocomplete";
import { registrableDomain } from "@/features/research/domains";
import { ISKILLS_BEATABLE_AUTHORITY_MAX } from "@/features/research/iskills";
import { MARKET_LANGUAGE } from "@/features/research/markets";
import { restrictedNiche } from "@/features/research/restricted";
import { isOpenAiAvailable } from "@/server/config/environment";
import { getDatabase } from "@/server/db/client";
import {
  findStaleDomains,
  getDomainMetrics,
  getProviderMarket,
  insertNicheIdeas,
  listLatestNicheIdeas,
  listRecentNicheSeeds,
  upsertDomainMetrics,
  type NicheIdeaInput,
} from "@/server/db/repositories";
import { logger } from "@/server/logging/logger";
import { createDataForSeoClient, createOpenAiAnalysisClient, type NicheIdea } from "@/server/providers";

import { inngest } from "./client";
import { settleWithConcurrency } from "./concurrency";
import { withProviderErrors } from "./provider-errors";

const IDEAS_PER_DAY = 12;
const NO_REPEAT_DAYS = 30;
const PARALLEL_SERP_CHECKS = 4;

/** Every morning (UTC): fresh, specific niche ideas that pass the avoid list. */
export const generateDailyNiches = inngest.createFunction(
  {
    id: "generate-daily-niches-v1",
    name: "Generate daily niche ideas",
    triggers: [{ cron: "0 5 * * *" }],
    singleton: { mode: "skip" },
    retries: 3,
  },
  async ({ step }) => step.run("ensure-todays-ideas", () => withProviderErrors(() => ensureTodaysNicheIdeas())),
);

/**
 * Generates today's ideas once. Safe to call from the cron and from the
 * Daily niches page: an existing day is left alone and the unique index
 * drops duplicates if two calls race.
 */
export async function ensureTodaysNicheIdeas(today = new Date().toISOString().slice(0, 10)) {
  if (!isOpenAiAvailable()) {
    logger.warn("Daily niches skipped: OpenAI is not configured");
    return { status: "skipped" as const, reason: "openai-not-configured" };
  }
  const database = getDatabase();
  if ((await listLatestNicheIdeas(database)).date === today) {
    return { status: "skipped" as const, reason: "already-generated" };
  }

  const avoid = await listRecentNicheSeeds(database, daysAgo(today, NO_REPEAT_DAYS));
  const generated = await createOpenAiAnalysisClient().generateNicheIdeas({ date: today, count: IDEAS_PER_DAY, avoid });
  const accepted = acceptableNicheIdeas(generated.ideas, avoid);
  await insertNicheIdeas(database, today, await enrichNicheIdeas(accepted));
  return { status: "completed" as const, stored: accepted.length, rejected: generated.ideas.length - accepted.length };
}

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

type IdeaMetrics = { searchVolume: number | null; difficulty: number | null; lowAuthorityCount: number | null };

/**
 * Pre-checks each idea in its own country: volume and difficulty for the
 * seed, and how many of its top-10 sites have authority of 20 or less. A
 * failed check leaves that idea's metrics empty instead of dropping it.
 */
export async function enrichNicheIdeas(ideas: readonly NicheIdea[]): Promise<NicheIdeaInput[]> {
  const client = createDataForSeoClient();
  const database = getDatabase();
  const metrics = new Map<string, IdeaMetrics>();
  const markets = new Map<string, { locationCode: number; languageCode: string } | null>();

  for (const countryCode of new Set(ideas.map((idea) => idea.countryCode))) {
    const market = await getProviderMarket(database, "dataforseo", countryCode, MARKET_LANGUAGE);
    markets.set(countryCode, market);
    if (!market) continue;
    const seeds = ideas.filter((idea) => idea.countryCode === countryCode).map((idea) => idea.seedKeyword);
    try {
      const overview = await client.getKeywordOverview({ keywords: seeds, locationCode: market.locationCode, languageCode: market.languageCode });
      for (const item of overview.items) {
        metrics.set(`${countryCode}:${normalizePhrase(item.keyword)}`, { searchVolume: item.searchVolume, difficulty: item.keywordDifficulty, lowAuthorityCount: null });
      }
    } catch (error) {
      logger.warn({ error, countryCode }, "Niche idea volume check failed");
    }
  }

  const serpChecks = await settleWithConcurrency(ideas, PARALLEL_SERP_CHECKS, async (idea) => {
    const market = markets.get(idea.countryCode);
    if (!market) return null;
    const serp = await client.getOrganicSerp({ keyword: idea.seedKeyword, locationCode: market.locationCode, languageCode: market.languageCode, depth: 10, device: "desktop" });
    const domains = [...new Set(serp.items.slice(0, 10).flatMap((item) => (item.domain ? registrableDomain(item.domain) ?? [] : [])))];
    const stale = await findStaleDomains(database, domains);
    if (stale.length > 0) await upsertDomainMetrics(database, (await client.getDomainMetrics({ domains: stale })).items);
    const cached = new Map((await getDomainMetrics(database, domains)).map((row) => [row.domain, row.authority]));
    return serp.items.slice(0, 10).filter((item) => {
      const authority = item.domain ? cached.get(registrableDomain(item.domain) ?? "") : null;
      return authority !== null && authority !== undefined && authority <= ISKILLS_BEATABLE_AUTHORITY_MAX;
    }).length;
  });

  return ideas.map((idea, index) => {
    const known = metrics.get(`${idea.countryCode}:${normalizePhrase(idea.seedKeyword)}`);
    const check = serpChecks[index]!;
    if (!check.ok) logger.warn({ error: check.error, seed: idea.seedKeyword }, "Niche idea SERP check failed");
    return {
      ...idea,
      searchVolume: known?.searchVolume ?? null,
      difficulty: known?.difficulty ?? null,
      lowAuthorityCount: check.ok ? check.value : null,
    };
  });
}

import "server-only";

import { allintitleQuery, isKgrCandidate } from "@/features/research/kgr";
import type { DatabaseClient } from "@/server/db/client";
import { getProviderMarket, listKeywordResultsByIds, saveAllintitleCounts } from "@/server/db/repositories";
import type { ResearchRun } from "@/server/db/schema";
import { AppError } from "@/server/http/errors";
import { settleWithConcurrency } from "@/server/jobs/concurrency";
import { logger } from "@/server/logging/logger";
import { createDataForSeoClient } from "@/server/providers";

const PARALLEL_LOOKUPS = 4;

type KgrCheckInput = {
  database: DatabaseClient;
  ownerId: string;
  run: ResearchRun;
  keywordIds: readonly number[];
  /** Runs only when at least one paid lookup is needed (configuration and rate-limit checks). */
  beforeLookups: () => Promise<void>;
};

/**
 * Fills in allintitle counts for the run's low-volume keywords. Keywords
 * already checked are not looked up again; a failed lookup stays empty so
 * it can be retried.
 */
export async function checkAllintitleCounts({ database, ownerId, run, keywordIds, beforeLookups }: KgrCheckInput) {
  const keywords = (await listKeywordResultsByIds(database, ownerId, run.id, keywordIds)).filter(isKgrCandidate);
  const pending = keywords.filter((keyword) => keyword.allintitleCount === null);
  if (pending.length === 0) return { keywords: keywords.map(toCount), failed: 0 };

  await beforeLookups();
  const market = await getProviderMarket(database, "dataforseo", run.countryCode, run.languageCode);
  if (!market) throw new AppError("This market is not available yet.", "MARKET_NOT_SUPPORTED", 422, false);

  const client = createDataForSeoClient();
  const lookups = await settleWithConcurrency(pending, PARALLEL_LOOKUPS, async (keyword) => {
    const serp = await client.getOrganicSerp({
      keyword: allintitleQuery(keyword.keyword),
      locationCode: market.locationCode,
      languageCode: market.languageCode,
      depth: 10,
      device: "desktop",
    });
    if (serp.totalResults === null) throw new Error("The provider returned no result count.");
    return { keywordResultId: keyword.id, allintitleCount: serp.totalResults };
  });

  const counts = lookups.flatMap((lookup) => (lookup.ok ? [lookup.value] : []));
  const failed = lookups.length - counts.length;
  if (failed > 0) {
    logger.warn({ runId: run.id, failed, errors: lookups.flatMap((lookup) => (lookup.ok ? [] : [lookup.error])) }, "Some allintitle lookups failed");
  }
  await saveAllintitleCounts(database, ownerId, run.id, counts);

  const byId = new Map(counts.map((count) => [count.keywordResultId, count.allintitleCount]));
  return {
    keywords: keywords.map((keyword) => ({ id: keyword.id, allintitleCount: keyword.allintitleCount ?? byId.get(keyword.id) ?? null })),
    failed,
  };
}

function toCount(keyword: { id: number; allintitleCount: number | null }) {
  return { id: keyword.id, allintitleCount: keyword.allintitleCount };
}

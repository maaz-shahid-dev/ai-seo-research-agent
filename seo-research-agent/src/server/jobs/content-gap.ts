import "server-only";

import { NonRetriableError } from "inngest";

import { mergeGapKeywords, pickCompetitors, type GapKeyword } from "@/features/research/serp";
import { getDatabase } from "@/server/db/client";
import {
  claimContentGap,
  completeContentGap,
  failContentGap,
  getContentGapById,
  getProviderMarket,
  getResearchRunById,
  listRunSerpDomains,
} from "@/server/db/repositories";
import { logger } from "@/server/logging/logger";
import { createDataForSeoClient } from "@/server/providers";

import { inngest } from "./client";
import { CONTENT_GAP_REQUESTED_EVENT, contentGapRequestedEventSchema } from "./events";
import { withProviderErrors } from "./provider-errors";

const COMPETITOR_COUNT = 3;
const KEYWORDS_PER_COMPETITOR = 100;
const FAILURE_MESSAGE = "Content gap analysis could not be completed. Try again.";

/**
 * Picks the run's strongest organic competitors (from analyzed SERPs, or the
 * seed keyword's SERP when none exist yet) and lists keywords they rank for
 * that the project's website does not.
 */
export const processContentGap = inngest.createFunction(
  {
    id: "process-content-gap-v1",
    name: "Find content gaps",
    triggers: [{ event: CONTENT_GAP_REQUESTED_EVENT }],
    concurrency: [{ limit: 10 }, { limit: 1, key: "event.data.ownerId" }],
    retries: 3,
    timeouts: { finish: "10m" },
    onFailure: async ({ event }) => {
      const original = event.data.event;
      const payload = contentGapRequestedEventSchema.safeParse(original.data);
      if (!payload.success) return;
      const workerId = original.id ?? `content-gap:${payload.data.reportId}`;
      const report = await getContentGapById(getDatabase(), payload.data.ownerId, payload.data.reportId);
      if (!report || report.status !== "running" || report.leaseOwner !== workerId) return;

      await failContentGap(getDatabase(), report, workerId, "JOB_RETRIES_EXHAUSTED", FAILURE_MESSAGE);
      logger.error({ ...payload.data }, "Content gap job exhausted retries");
    },
  },
  async ({ event, step }) => {
    const payload = contentGapRequestedEventSchema.safeParse(event.data);
    if (!payload.success) throw new NonRetriableError("The content gap event payload is invalid.");
    const { ownerId, runId, reportId } = payload.data;
    const workerId = event.id ?? `content-gap:${reportId}`;

    const claimed = await step.run("claim-report", async () => {
      const report = await claimContentGap(getDatabase(), ownerId, reportId, workerId);
      const run = report ? await getResearchRunById(getDatabase(), ownerId, runId) : null;
      if (!report || !run) return { claimed: false as const };
      return {
        claimed: true as const,
        report: { id: report.id, ownerId, version: report.version, targetDomain: report.targetDomain },
        run: { query: run.query, countryCode: run.countryCode, languageCode: run.languageCode },
      };
    });
    if (!claimed.claimed) return { status: "skipped" };
    const { report, run } = claimed;

    const market = await step.run("resolve-market", () =>
      getProviderMarket(getDatabase(), "dataforseo", run.countryCode, run.languageCode));
    if (!market) {
      await step.run("fail-unsupported-market", () =>
        failContentGap(getDatabase(), report, workerId, "MARKET_NOT_SUPPORTED", "This market is not available yet."));
      return { status: "failed" };
    }

    const competitors = await step.run("pick-competitors", async () => {
      const analyzed = await listRunSerpDomains(getDatabase(), ownerId, runId);
      if (analyzed.length > 0) return pickCompetitors(analyzed, report.targetDomain, COMPETITOR_COUNT);

      const serp = await withProviderErrors(() => createDataForSeoClient().getOrganicSerp({
        keyword: run.query,
        locationCode: market.locationCode,
        languageCode: market.languageCode,
        depth: 10,
        device: "desktop",
      }));
      return pickCompetitors(
        serp.items.flatMap((item) => (item.rank === null ? [] : [{ domain: item.domain, rank: item.rank }])),
        report.targetDomain,
        COMPETITOR_COUNT,
      );
    });

    const lists: GapKeyword[][] = [];
    for (const competitor of competitors) {
      // One step per competitor, so a retry never pays for completed lookups twice.
      lists.push(await step.run(`gap-${competitor}`, async () => {
        const result = await withProviderErrors(() => createDataForSeoClient().getDomainIntersection({
          competitorDomain: competitor,
          targetDomain: report.targetDomain,
          locationCode: market.locationCode,
          languageCode: market.languageCode,
          limit: KEYWORDS_PER_COMPETITOR,
        }));
        return result.items.map((item) => ({
          keyword: item.keyword,
          searchVolume: item.searchVolume,
          difficulty: item.keywordDifficulty,
          cpcMicros: item.cpc === null ? null : Math.round(item.cpc * 1_000_000),
          competitorDomain: competitor,
          competitorRank: item.competitorRank,
        }));
      }));
    }

    const completed = await step.run("complete-report", () =>
      completeContentGap(getDatabase(), report, workerId, { competitors, keywords: mergeGapKeywords(lists) }));
    return completed ? { status: "completed", keywords: completed.keywords.length } : { status: "stale-lease" };
  },
);

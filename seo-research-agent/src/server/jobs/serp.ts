import "server-only";

import { NonRetriableError } from "inngest";

import { registrableDomain } from "@/features/research/domains";
import { nicheScore } from "@/features/research/niche";
import { siteMetricsFor } from "@/features/research/serp";
import { getDatabase } from "@/server/db/client";
import {
  claimSerpAnalysis,
  completeSerpAnalysis,
  failSerpAnalysis,
  findStaleDomains,
  getDomainMetrics,
  getKeywordResult,
  getProviderMarket,
  getSerpAnalysisById,
  upsertDomainMetrics,
} from "@/server/db/repositories";
import { logger } from "@/server/logging/logger";
import { createDataForSeoClient } from "@/server/providers";

import { inngest } from "./client";
import { SERP_REQUESTED_EVENT, serpRequestedEventSchema } from "./events";
import { withProviderErrors } from "./provider-errors";

const SERP_DEPTH = 10;
const FAILURE_MESSAGE = "SERP analysis could not be completed. Try again.";

/**
 * Fetches a keyword's top 10, fills the shared domain-metrics cache for any
 * missing or expired domains, then stores the snapshot with its niche score.
 */
export const processSerpAnalysis = inngest.createFunction(
  {
    id: "process-serp-analysis-v1",
    name: "Analyze a keyword's SERP",
    triggers: [{ event: SERP_REQUESTED_EVENT }],
    concurrency: [{ limit: 20 }, { limit: 4, key: "event.data.ownerId" }],
    retries: 3,
    timeouts: { finish: "10m" },
    onFailure: async ({ event }) => {
      const original = event.data.event;
      const payload = serpRequestedEventSchema.safeParse(original.data);
      if (!payload.success) return;
      const workerId = original.id ?? `serp:${payload.data.analysisId}`;
      const analysis = await getSerpAnalysisById(getDatabase(), payload.data.ownerId, payload.data.analysisId);
      if (!analysis || analysis.status !== "running" || analysis.leaseOwner !== workerId) return;

      await failSerpAnalysis(getDatabase(), analysis, workerId, "JOB_RETRIES_EXHAUSTED", FAILURE_MESSAGE);
      logger.error({ ...payload.data }, "SERP analysis exhausted retries");
    },
  },
  async ({ event, step }) => {
    const payload = serpRequestedEventSchema.safeParse(event.data);
    if (!payload.success) throw new NonRetriableError("The SERP event payload is invalid.");
    const { ownerId, runId, analysisId } = payload.data;
    const workerId = event.id ?? `serp:${analysisId}`;

    const claimed = await step.run("claim-analysis", async () => {
      const analysis = await claimSerpAnalysis(getDatabase(), ownerId, analysisId, workerId);
      if (!analysis) return { claimed: false as const };
      const keyword = await getKeywordResult(getDatabase(), ownerId, runId, analysis.keywordResultId);
      if (!keyword) return { claimed: false as const };
      return {
        claimed: true as const,
        analysis: { id: analysis.id, ownerId, runId, keywordResultId: analysis.keywordResultId, version: analysis.version },
        keyword: { text: keyword.keyword, difficulty: keyword.difficulty, countryCode: keyword.countryCode, languageCode: keyword.languageCode },
      };
    });
    if (!claimed.claimed) return { status: "skipped" };
    const { analysis, keyword } = claimed;

    const market = await step.run("resolve-market", () =>
      getProviderMarket(getDatabase(), "dataforseo", keyword.countryCode, keyword.languageCode));
    if (!market) {
      await step.run("fail-unsupported-market", () =>
        failSerpAnalysis(getDatabase(), analysis, workerId, "MARKET_NOT_SUPPORTED", "This market is not available yet."));
      return { status: "failed" };
    }

    const serp = await step.run("fetch-serp", () =>
      withProviderErrors(() => createDataForSeoClient().getOrganicSerp({
        keyword: keyword.text,
        locationCode: market.locationCode,
        languageCode: market.languageCode,
        depth: SERP_DEPTH,
        device: "desktop",
      })));

    const results = serp.items
      .filter((item) => item.rank !== null && item.domain !== null)
      .slice(0, SERP_DEPTH)
      .map((item) => ({ rank: item.rank!, title: item.title, url: item.url, domain: item.domain, description: item.description }));
    const domains = [...new Set(results.flatMap((result) => registrableDomain(result.domain!) ?? []))];

    await step.run("refresh-domain-metrics", async () => {
      const stale = await findStaleDomains(getDatabase(), domains);
      if (stale.length === 0) return { fetched: 0 };
      const metrics = await withProviderErrors(() => createDataForSeoClient().getDomainMetrics({ domains: stale }));
      await upsertDomainMetrics(getDatabase(), metrics.items);
      return { fetched: stale.length };
    });

    const completed = await step.run("complete-analysis", async () => {
      const cached = await getDomainMetrics(getDatabase(), domains);
      const metricsByDomain = new Map(cached.map((row) => [row.domain, row]));
      const score = nicheScore(
        keyword.difficulty,
        results.map((result) => siteMetricsFor(result.domain!, metricsByDomain)),
      );
      const done = await completeSerpAnalysis(getDatabase(), analysis, workerId, {
        keyword: keyword.text,
        countryCode: keyword.countryCode,
        languageCode: keyword.languageCode,
        device: "desktop",
        providerRequestId: serp.taskId,
        results,
        nicheScore: score,
        hasAiOverview: serp.features.includes("ai_overview"),
      });
      return done ? { nicheScore: done.nicheScore } : null;
    });

    return completed ? { status: "completed", ...completed } : { status: "stale-lease" };
  },
);


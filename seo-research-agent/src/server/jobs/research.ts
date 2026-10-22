import "server-only";

import { NonRetriableError } from "inngest";

import {
  AI_ANALYSIS_PROMPT_VERSION,
  AI_ANALYSIS_SCHEMA_VERSION,
  buildKeywordEvidence,
  createAnalysisInputHash,
} from "@/features/research/analysis-evidence";
import {
  claimResearchRun,
  countKeywordResults,
  failResearchRunAfterExhaustion,
  finishResearchRun,
  getProviderMarket,
  getResearchRunById,
  insertKeywordResults,
  listKeywordResults,
  queueAiAnalysis,
  requestTopSerpAnalyses,
  updateResearchRunProgress,
} from "@/server/db/repositories";
import { getOpenAiEnvironment } from "@/server/config/environment";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/server/logging/logger";
import { createDataForSeoClient } from "@/server/providers";

import { inngest } from "./client";
import { dispatchOutboxEventNow } from "./dispatch";
import { expandWithAutocomplete } from "./autocomplete-expansion";
import { toKeywordResultInput } from "./keyword-mapping";
import { withProviderErrors } from "./provider-errors";
import {
  ANALYSIS_REQUESTED_EVENT,
  RESEARCH_REQUESTED_EVENT,
  researchRequestedEventSchema,
  SERP_REQUESTED_EVENT,
} from "./events";

const AUTO_SERP_KEYWORDS = 10;

export const processResearch = inngest.createFunction(
  {
    id: "process-research-v1",
    name: "Process keyword research",
    triggers: [{ event: RESEARCH_REQUESTED_EVENT }],
    idempotency: "event.data.runId",
    concurrency: [
      { limit: 25 },
      { limit: 3, key: "event.data.ownerId" },
    ],
    retries: 4,
    timeouts: { finish: "15m" },
    onFailure: async ({ event }) => {
      const payload = researchRequestedEventSchema.safeParse(event.data.event.data);
      if (!payload.success) return;

      const database = getDatabase();
      const run = await getResearchRunById(database, payload.data.ownerId, payload.data.runId);
      if (!run || (run.status !== "queued" && run.status !== "running")) return;

      await failResearchRunAfterExhaustion(
        database,
        payload.data.ownerId,
        payload.data.runId,
        run.version,
        "JOB_RETRIES_EXHAUSTED",
        "Research could not be completed. Try again.",
      );
      logger.error(
        { ownerId: payload.data.ownerId, runId: payload.data.runId },
        "Research job exhausted retries",
      );
    },
  },
  async ({ event, step }) => {
    const payload = researchRequestedEventSchema.safeParse(event.data);
    if (!payload.success) {
      throw new NonRetriableError("The research event payload is invalid.");
    }
    const { ownerId, runId } = payload.data;
    const workerId = event.id ?? `research:${runId}`;

    const claimed = await step.run("claim-run", async () => {
      const run = await claimResearchRun(getDatabase(), ownerId, runId, workerId);
      if (!run) {
        const existing = await getResearchRunById(getDatabase(), ownerId, runId);
        return existing
          ? { claimed: false as const, status: existing.status }
          : { claimed: false as const, status: "missing" as const };
      }
      return {
        claimed: true as const,
        version: run.version,
        query: run.query,
        countryCode: run.countryCode,
        languageCode: run.languageCode,
        keywordLimit: run.configuration.keywordLimit,
      };
    });

    if (!claimed.claimed) return claimed;

    const market = await step.run("resolve-market", () =>
      getProviderMarket(
        getDatabase(),
        "dataforseo",
        claimed.countryCode,
        claimed.languageCode,
      ),
    );
    if (!market) {
      const failed = await step.run("fail-unsupported-market", () =>
        finishResearchRun(getDatabase(), ownerId, runId, claimed.version, workerId, {
          status: "failed",
          errorCode: "MARKET_NOT_SUPPORTED",
          errorMessage: "This market is not available yet.",
        }),
      );
      return failed
        ? { status: "failed", reason: "market-not-supported" }
        : { status: "cancelled-or-stale" };
    }

    const keywordResult = await step.run("fetch-keyword-ideas", () =>
      withProviderErrors(() => createDataForSeoClient().getKeywordIdeas({
        keywords: [claimed.query],
        locationCode: market.locationCode,
        languageCode: market.languageCode,
        limit: claimed.keywordLimit,
      })));

    const fetched = await step.run("record-fetch-progress", () =>
      updateResearchRunProgress(
        getDatabase(),
        ownerId,
        runId,
        claimed.version,
        workerId,
        60,
      ),
    );
    if (!fetched) return { status: "cancelled-or-stale" };

    await step.run("store-keywords", () =>
      insertKeywordResults(
        getDatabase(),
        ownerId,
        runId,
        keywordResult.items.map((item) => toKeywordResultInput(item, {
          source: normalizeKeyword(item.keyword) === normalizeKeyword(claimed.query) ? "seed" : "related",
          providerRequestId: keywordResult.taskId,
          countryCode: claimed.countryCode,
          languageCode: claimed.languageCode,
        })),
      ),
    );

    // Google Autocomplete "alphabet soup" adds long-tail ideas for content coverage.
    // It is enrichment: if it fails, the run still completes with keyword ideas.
    await step.run("expand-with-autocomplete", async () => {
      try {
        return await expandWithAutocomplete(createDataForSeoClient(), {
          ownerId,
          runId,
          seed: claimed.query,
          existingKeywords: keywordResult.items.map((item) => item.keyword),
          locationCode: market.locationCode,
          languageCode: market.languageCode,
          countryCode: claimed.countryCode,
        });
      } catch (error) {
        logger.warn({ error, ownerId, runId }, "Autocomplete expansion failed; continuing without it");
        return { added: 0 };
      }
    });

    const stored = await step.run("record-store-progress", () =>
      updateResearchRunProgress(
        getDatabase(),
        ownerId,
        runId,
        fetched.version,
        workerId,
        90,
      ),
    );
    if (!stored) return { status: "cancelled-or-stale" };

    const analysisInput = await step.run("prepare-analysis", async () => {
      const [keywordPage, keywordCount] = await Promise.all([
        listKeywordResults(getDatabase(), ownerId, runId, { limit: 40 }),
        countKeywordResults(getDatabase(), ownerId, runId),
      ]);
      const evidence = buildKeywordEvidence(keywordPage.items);
      if (evidence.length === 0) return { keywordCount, analysis: null };

      const { OPENAI_MODEL: model } = getOpenAiEnvironment();
      return {
        keywordCount,
        analysis: {
          model,
          inputHash: createAnalysisInputHash({
            seedKeyword: claimed.query,
            countryCode: claimed.countryCode,
            languageCode: claimed.languageCode,
            model,
            promptVersion: AI_ANALYSIS_PROMPT_VERSION,
            schemaVersion: AI_ANALYSIS_SCHEMA_VERSION,
            evidence,
          }),
        },
      };
    });

    const queuedAnalysis = analysisInput.analysis
      ? await step.run("queue-analysis", async () => {
          const analysis = await queueAiAnalysis(
            getDatabase(),
            ownerId,
            runId,
            analysisInput.analysis!,
          );
          if (!analysis) throw new Error("The AI analysis could not be queued.");
          return analysis;
        })
      : null;

    const completed = await step.run("complete-run", () =>
      finishResearchRun(getDatabase(), ownerId, runId, stored.version, workerId, {
        status: "completed",
        keywordCount: analysisInput.keywordCount,
      }),
    );
    if (!completed) return { status: "cancelled-or-stale" };

    if (queuedAnalysis) {
      await step.run("dispatch-analysis", () =>
        dispatchOutboxEventNow(ownerId, queuedAnalysis.id, ANALYSIS_REQUESTED_EVENT),
      );
    }

    // Niche Hunter: analyze the best opportunities automatically; others load on click.
    if (analysisInput.keywordCount > 0) {
      await step.run("queue-top-serps", async () => {
        const analyses = await requestTopSerpAnalyses(getDatabase(), ownerId, runId, AUTO_SERP_KEYWORDS);
        await Promise.all(analyses.map((analysis) =>
          dispatchOutboxEventNow(ownerId, analysis.id, SERP_REQUESTED_EVENT)));
        return analyses.length;
      });
    }

    return {
      status: "completed",
      keywordCount: completed.keywordCount,
      analysisId: queuedAnalysis?.id ?? null,
    };
  },
);

function normalizeKeyword(value: string) {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

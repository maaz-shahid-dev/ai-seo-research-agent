import "server-only";

import { NonRetriableError } from "inngest";

import {
  buildKeywordEvidence,
  collectAnalysisCitationIds,
  createAnalysisInputHash,
  createKeywordEvidenceId,
} from "@/features/research/analysis-evidence";
import { getDatabase } from "@/server/db/client";
import {
  claimAiAnalysis,
  completeAiAnalysis,
  failAiAnalysis,
  getAiAnalysisById,
} from "@/server/db/repositories/ai-analyses";
import {
  getResearchRunById,
  listKeywordResults,
} from "@/server/db/repositories";
import { logger } from "@/server/logging/logger";
import { createOpenAiAnalysisClient, ProviderError } from "@/server/providers";

import { inngest } from "./client";
import {
  ANALYSIS_REQUESTED_EVENT,
  analysisRequestedEventSchema,
} from "./events";

const ANALYSIS_FAILURE_MESSAGE = "AI insights could not be generated. Your keyword results are still available.";

export const processAiAnalysis = inngest.createFunction(
  {
    id: "process-ai-analysis-v1",
    name: "Generate research insights",
    triggers: [{ event: ANALYSIS_REQUESTED_EVENT }],
    idempotency: "event.data.analysisId",
    concurrency: [
      { limit: 10 },
      { limit: 1, key: "event.data.ownerId" },
    ],
    retries: 3,
    timeouts: { finish: "10m" },
    onFailure: async ({ event }) => {
      const originalEvent = event.data.event;
      const payload = analysisRequestedEventSchema.safeParse(originalEvent.data);
      if (!payload.success) return;

      const workerId = originalEvent.id ?? `analysis:${payload.data.analysisId}`;
      const database = getDatabase();
      const analysis = await getAiAnalysisById(
        database,
        payload.data.ownerId,
        payload.data.runId,
        payload.data.analysisId,
      );
      if (
        !analysis ||
        analysis.status !== "running" ||
        analysis.leaseOwner !== workerId
      ) {
        return;
      }

      await failAiAnalysis(
        database,
        payload.data.ownerId,
        payload.data.runId,
        payload.data.analysisId,
        analysis.version,
        workerId,
        "JOB_RETRIES_EXHAUSTED",
        ANALYSIS_FAILURE_MESSAGE,
      );
      logger.error(
        {
          ownerId: payload.data.ownerId,
          runId: payload.data.runId,
          analysisId: payload.data.analysisId,
        },
        "AI analysis job exhausted retries",
      );
    },
  },
  async ({ event, step }) => {
    const payload = analysisRequestedEventSchema.safeParse(event.data);
    if (!payload.success) {
      throw new NonRetriableError("The analysis event payload is invalid.");
    }

    const { ownerId, runId, analysisId } = payload.data;
    const workerId = event.id ?? `analysis:${analysisId}`;
    const claimed = await step.run("claim-analysis", async () => {
      const analysis = await claimAiAnalysis(
        getDatabase(),
        ownerId,
        runId,
        analysisId,
        workerId,
      );
      if (analysis) return { claimed: true as const, analysis };

      const existing = await getAiAnalysisById(
        getDatabase(),
        ownerId,
        runId,
        analysisId,
      );
      return {
        claimed: false as const,
        status: existing?.status ?? "missing",
      };
    });
    if (!claimed.claimed) return claimed;

    const context = await step.run("load-analysis-evidence", async () => {
      const run = await getResearchRunById(getDatabase(), ownerId, runId);
      if (!run) return { state: "unavailable" as const, reason: "missing-run" as const };
      if (run.status === "queued" || run.status === "running") {
        // Throw inside the step so Inngest does not memoize a temporary state.
        throw new Error("The research run is not ready for analysis yet.");
      }
      if (run.status !== "completed") {
        return { state: "unavailable" as const, reason: "terminal-run" as const };
      }

      const keywordPage = await listKeywordResults(getDatabase(), ownerId, runId, { limit: 40 });
      const evidence = buildKeywordEvidence(keywordPage.items);
      if (evidence.length === 0) {
        return { state: "unavailable" as const, reason: "empty-evidence" as const };
      }

      const expectedHash = createAnalysisInputHash({
        seedKeyword: run.query,
        countryCode: run.countryCode,
        languageCode: run.languageCode,
        model: claimed.analysis.model,
        promptVersion: claimed.analysis.promptVersion,
        schemaVersion: claimed.analysis.schemaVersion,
        evidence,
      });
      if (expectedHash !== claimed.analysis.inputHash) {
        return { state: "unavailable" as const, reason: "input-changed" as const };
      }

      return {
        state: "ready" as const,
        seedKeyword: run.query,
        countryCode: run.countryCode,
        languageCode: run.languageCode,
        evidence,
        keywords: keywordPage.items.map((keyword) => ({
          id: keyword.id,
          keyword: keyword.keyword,
        })),
      };
    });

    if (context.state === "unavailable") {
      const errorCode = context.reason === "empty-evidence"
        ? "ANALYSIS_EVIDENCE_UNAVAILABLE"
        : context.reason === "input-changed"
          ? "ANALYSIS_INPUT_CHANGED"
          : "ANALYSIS_RESEARCH_UNAVAILABLE";
      const failed = await step.run("fail-unavailable-analysis", () =>
        failAiAnalysis(
          getDatabase(),
          ownerId,
          runId,
          analysisId,
          claimed.analysis.version,
          workerId,
          errorCode,
          ANALYSIS_FAILURE_MESSAGE,
        ),
      );
      return failed
        ? { status: "failed", reason: context.reason }
        : { status: "cancelled-or-stale" };
    }

    const providerResult = await step.run("request-openai-analysis", async () => {
      const startedAt = Date.now();
      try {
        const result = await createOpenAiAnalysisClient().analyze({
          ownerId,
          seedKeyword: context.seedKeyword,
          country: context.countryCode,
          language: context.languageCode,
          evidence: context.evidence,
        });
        return {
          outcome: "completed" as const,
          analysis: result.analysis,
          latencyMs: Math.max(0, Date.now() - startedAt),
        };
      } catch (error) {
        if (error instanceof ProviderError && !error.retryable) {
          return { outcome: "failed" as const, errorCode: error.code };
        }
        throw error;
      }
    });

    if (providerResult.outcome === "failed") {
      const failed = await step.run("fail-provider-analysis", () =>
        failAiAnalysis(
          getDatabase(),
          ownerId,
          runId,
          analysisId,
          claimed.analysis.version,
          workerId,
          providerResult.errorCode,
          ANALYSIS_FAILURE_MESSAGE,
        ),
      );
      return failed
        ? { status: "failed", reason: providerResult.errorCode }
        : { status: "cancelled-or-stale" };
    }

    const keywordByEvidenceId = new Map(
      context.keywords.map((keyword) => [createKeywordEvidenceId(keyword.id), keyword]),
    );
    const evidenceById = new Map(context.evidence.map((evidence) => [evidence.id, evidence]));
    const citations = collectAnalysisCitationIds(providerResult.analysis).map((citationId) => {
      const keyword = keywordByEvidenceId.get(citationId);
      const evidence = evidenceById.get(citationId);
      if (!keyword || !evidence) {
        throw new NonRetriableError("The analysis referenced unavailable evidence.");
      }
      return {
        keywordResultId: keyword.id,
        title: keyword.keyword,
        excerpt: evidence.facts.map((fact) => `${fact.label}: ${fact.value}`).join("; "),
      };
    });

    const completed = await step.run("store-ai-analysis", () =>
      completeAiAnalysis(
        getDatabase(),
        ownerId,
        runId,
        analysisId,
        claimed.analysis.version,
        workerId,
        {
          output: providerResult.analysis,
          citations,
          latencyMs: providerResult.latencyMs,
        },
      ),
    );
    return completed
      ? { status: "completed", analysisId: completed.id }
      : { status: "cancelled-or-stale" };
  },
);

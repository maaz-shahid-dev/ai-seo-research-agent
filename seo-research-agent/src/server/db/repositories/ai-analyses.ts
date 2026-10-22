import "server-only";

import { randomUUID } from "node:crypto";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";
import { z } from "zod";

import {
  AI_ANALYSIS_PROMPT_VERSION,
  AI_ANALYSIS_PROVIDER,
  AI_ANALYSIS_SCHEMA_VERSION,
  AI_ANALYSIS_TYPE,
} from "@/features/research/analysis-evidence";
import {
  normalizeLinkHttpUrl,
  researchAnalysisSchema,
  type ResearchAnalysis,
} from "@/server/providers/types";

import type { DatabaseClient } from "../client";
import { aiAnalyses, aiCitations, jobOutbox, keywordResults, researchRuns } from "../schema";

const ANALYSIS_REQUESTED_EVENT = "analysis.requested";
const DEFAULT_LEASE_DURATION_MS = 5 * 60_000;

const queueInputSchema = z
  .object({
    model: z.string().trim().min(1).max(120),
    inputHash: z.string().regex(/^[a-f0-9]{64}$/),
    promptVersion: z.string().trim().min(1).max(40).default(AI_ANALYSIS_PROMPT_VERSION),
    schemaVersion: z.number().int().min(1).max(32_767).default(AI_ANALYSIS_SCHEMA_VERSION),
  })
  .strict();

export type QueueAiAnalysisInput = z.input<typeof queueInputSchema>;

export type AiAnalysisCitationInput = {
  keywordResultId: number;
  url?: string | null;
  title?: string | null;
  excerpt?: string | null;
};

export type CompleteAiAnalysisInput = {
  output: ResearchAnalysis;
  citations: readonly AiAnalysisCitationInput[];
  latencyMs?: number | null;
  inputTokens?: number | null;
  outputTokens?: number | null;
};

/** Creates an idempotent analysis and its durable dispatch event in one statement. */
export async function queueAiAnalysis(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  input: QueueAiAnalysisInput,
) {
  const values = queueInputSchema.parse(input);
  const analysisId = randomUUID();

  await database.execute(sql`
    with inserted_analysis as (
      insert into ${aiAnalyses} (
        "id", "owner_id", "run_id", "type", "provider", "model",
        "prompt_version", "schema_version", "input_hash"
      )
      select
        ${analysisId}, ${ownerId}, ${researchRuns.id}, ${AI_ANALYSIS_TYPE},
        ${AI_ANALYSIS_PROVIDER}, ${values.model}, ${values.promptVersion},
        ${values.schemaVersion}, ${values.inputHash}
      from ${researchRuns}
      where ${researchRuns.id} = ${runId}
        and ${researchRuns.ownerId} = ${ownerId}
      on conflict ("run_id", "type", "input_hash", "model", "prompt_version")
        do nothing
      returning "id"
    ), selected_analysis as (
      select "id" from inserted_analysis
      union all
      select ${aiAnalyses.id}
      from ${aiAnalyses}
      where ${aiAnalyses.ownerId} = ${ownerId}
        and ${aiAnalyses.runId} = ${runId}
        and ${aiAnalyses.type} = ${AI_ANALYSIS_TYPE}
        and ${aiAnalyses.inputHash} = ${values.inputHash}
        and ${aiAnalyses.model} = ${values.model}
        and ${aiAnalyses.promptVersion} = ${values.promptVersion}
        and ${aiAnalyses.schemaVersion} = ${values.schemaVersion}
      limit 1
    ), inserted_event as (
      insert into ${jobOutbox} (
        "owner_id", "aggregate_type", "aggregate_id", "event_type",
        "idempotency_key", "payload"
      )
      select
        ${ownerId}, 'ai_analysis', selected_analysis."id", ${ANALYSIS_REQUESTED_EVENT},
        'analysis:' || selected_analysis."id"::text,
        jsonb_build_object(
          'version', 1,
          'ownerId', ${ownerId}::uuid,
          'runId', ${runId}::uuid,
          'analysisId', selected_analysis."id"
        )
      from selected_analysis
      on conflict ("owner_id", "event_type", "idempotency_key") do nothing
      returning "id"
    )
    select "id" from selected_analysis
  `);

  return getAiAnalysisByIdentity(database, ownerId, runId, {
    inputHash: values.inputHash,
    model: values.model,
    promptVersion: values.promptVersion,
    schemaVersion: values.schemaVersion,
  });
}

export async function getAiAnalysisById(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  analysisId: string,
) {
  const [analysis] = await database
    .select()
    .from(aiAnalyses)
    .where(
      and(
        eq(aiAnalyses.id, analysisId),
        eq(aiAnalyses.ownerId, ownerId),
        eq(aiAnalyses.runId, runId),
      ),
    )
    .limit(1);
  return analysis ?? null;
}

export async function getLatestAiAnalysisForRun(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
) {
  const [analysis] = await database
    .select()
    .from(aiAnalyses)
    .where(
      and(
        eq(aiAnalyses.ownerId, ownerId),
        eq(aiAnalyses.runId, runId),
        eq(aiAnalyses.type, AI_ANALYSIS_TYPE),
      ),
    )
    .orderBy(desc(aiAnalyses.createdAt), desc(aiAnalyses.id))
    .limit(1);
  return analysis ?? null;
}

export async function claimAiAnalysis(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  analysisId: string,
  workerIdInput: string,
  leaseDurationMs = DEFAULT_LEASE_DURATION_MS,
) {
  const workerId = normalizeWorkerId(workerIdInput);
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + boundedLeaseDuration(leaseDurationMs));
  const [analysis] = await database
    .update(aiAnalyses)
    .set({
      status: "running",
      startedAt: sql<Date>`coalesce(${aiAnalyses.startedAt}, ${now})`,
      finishedAt: null,
      leaseOwner: workerId,
      leaseExpiresAt,
      version: sql`${aiAnalyses.version} + 1`,
      errorCode: null,
      errorMessage: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(aiAnalyses.id, analysisId),
        eq(aiAnalyses.ownerId, ownerId),
        eq(aiAnalyses.runId, runId),
        or(
          eq(aiAnalyses.status, "queued"),
          and(
            eq(aiAnalyses.status, "running"),
            or(
              eq(aiAnalyses.leaseOwner, workerId),
              lt(aiAnalyses.leaseExpiresAt, now),
            ),
          ),
        ),
      ),
    )
    .returning();
  return analysis ?? null;
}

/** Completes the CAS update and all citation inserts atomically. */
export async function completeAiAnalysis(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  analysisId: string,
  expectedVersion: number,
  workerIdInput: string,
  input: CompleteAiAnalysisInput,
) {
  const workerId = normalizeWorkerId(workerIdInput);
  const output = researchAnalysisSchema.parse(input.output);
  const citations = normalizeCitations(input.citations);
  const latencyMs = optionalNonNegativeInteger(input.latencyMs, "latencyMs");
  const inputTokens = optionalNonNegativeInteger(input.inputTokens, "inputTokens");
  const outputTokens = optionalNonNegativeInteger(input.outputTokens, "outputTokens");
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new TypeError("Analysis version must be a positive integer.");
  }

  const now = new Date();
  await database.execute(sql`
    with input_citations as (
      select *
      from jsonb_to_recordset(${JSON.stringify(citations)}::jsonb) as citation(
        "position" smallint,
        "keyword_result_id" bigint,
        "url" text,
        "title" text,
        "excerpt" text
      )
    ), validated_citations as (
      select citation.*
      from input_citations citation
      inner join ${keywordResults}
        on ${keywordResults.id} = citation."keyword_result_id"
       and ${keywordResults.ownerId} = ${ownerId}
       and ${keywordResults.runId} = ${runId}
    ), completed_analysis as (
      update ${aiAnalyses}
      set
        "status" = 'completed',
        "summary" = ${output.summary.statement},
        "output" = ${JSON.stringify(output)}::jsonb,
        "latency_ms" = ${latencyMs},
        "input_tokens" = ${inputTokens},
        "output_tokens" = ${outputTokens},
        "error_code" = null,
        "error_message" = null,
        "finished_at" = ${now},
        "lease_owner" = null,
        "lease_expires_at" = null,
        "version" = "version" + 1,
        "updated_at" = ${now}
      where ${aiAnalyses.id} = ${analysisId}
        and ${aiAnalyses.ownerId} = ${ownerId}
        and ${aiAnalyses.runId} = ${runId}
        and ${aiAnalyses.status} = 'running'
        and ${aiAnalyses.version} = ${expectedVersion}
        and ${aiAnalyses.leaseOwner} = ${workerId}
        and (select count(*) from input_citations) =
            (select count(*) from validated_citations)
      returning "id", "owner_id", "run_id"
    ), inserted_citations as (
      insert into ${aiCitations} (
        "owner_id", "run_id", "analysis_id", "keyword_result_id",
        "position", "url", "title", "excerpt"
      )
      select
        completed_analysis."owner_id",
        completed_analysis."run_id",
        completed_analysis."id",
        citation."keyword_result_id",
        citation."position",
        citation."url",
        citation."title",
        citation."excerpt"
      from completed_analysis
      cross join validated_citations citation
      order by citation."position"
      returning "id"
    )
    select count(*) from inserted_citations
  `);

  const completed = await getAiAnalysisById(database, ownerId, runId, analysisId);
  return completed?.status === "completed" ? completed : null;
}

export async function failAiAnalysis(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  analysisId: string,
  expectedVersion: number,
  workerIdInput: string,
  errorCodeInput: string,
  errorMessageInput: string,
) {
  const workerId = normalizeWorkerId(workerIdInput);
  const errorCode = normalizeBoundedText(errorCodeInput, 80, "Analysis error code");
  const errorMessage = normalizeBoundedText(errorMessageInput, 500, "Analysis error message");
  if (!Number.isSafeInteger(expectedVersion) || expectedVersion < 1) {
    throw new TypeError("Analysis version must be a positive integer.");
  }

  const now = new Date();
  const [analysis] = await database
    .update(aiAnalyses)
    .set({
      status: "failed",
      output: null,
      summary: null,
      errorCode,
      errorMessage,
      finishedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      version: sql`${aiAnalyses.version} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(aiAnalyses.id, analysisId),
        eq(aiAnalyses.ownerId, ownerId),
        eq(aiAnalyses.runId, runId),
        eq(aiAnalyses.status, "running"),
        eq(aiAnalyses.version, expectedVersion),
        eq(aiAnalyses.leaseOwner, workerId),
      ),
    )
    .returning();
  return analysis ?? null;
}

async function getAiAnalysisByIdentity(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  identity: {
    inputHash: string;
    model: string;
    promptVersion: string;
    schemaVersion: number;
  },
) {
  const [analysis] = await database
    .select()
    .from(aiAnalyses)
    .where(
      and(
        eq(aiAnalyses.ownerId, ownerId),
        eq(aiAnalyses.runId, runId),
        eq(aiAnalyses.type, AI_ANALYSIS_TYPE),
        eq(aiAnalyses.inputHash, identity.inputHash),
        eq(aiAnalyses.model, identity.model),
        eq(aiAnalyses.promptVersion, identity.promptVersion),
        eq(aiAnalyses.schemaVersion, identity.schemaVersion),
      ),
    )
    .limit(1);
  return analysis ?? null;
}

function normalizeCitations(input: readonly AiAnalysisCitationInput[]) {
  if (input.length < 1 || input.length > 40) {
    throw new RangeError("An analysis must cite between one and 40 keyword results.");
  }

  const seen = new Set<number>();
  return input.map((citation, index) => {
    if (
      !Number.isSafeInteger(citation.keywordResultId) ||
      citation.keywordResultId < 1 ||
      seen.has(citation.keywordResultId)
    ) {
      throw new TypeError("Analysis citations require unique positive keyword result IDs.");
    }
    seen.add(citation.keywordResultId);

    return {
      position: index + 1,
      keyword_result_id: citation.keywordResultId,
      url: normalizeCitationUrl(citation.url),
      title: optionalBoundedText(citation.title, 500),
      excerpt: optionalBoundedText(citation.excerpt, 1_000),
    };
  });
}

function optionalNonNegativeInteger(value: number | null | undefined, name: string) {
  if (value === null || value === undefined) return null;
  if (!Number.isSafeInteger(value) || value < 0) {
    throw new TypeError(`${name} must be a non-negative integer.`);
  }
  return value;
}

function normalizeWorkerId(value: string) {
  return normalizeBoundedText(value, 160, "Analysis worker ID");
}

function normalizeBoundedText(value: string, maximum: number, label: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 1) throw new TypeError(`${label} is required.`);
  return [...normalized].slice(0, maximum).join("");
}

function optionalBoundedText(value: string | null | undefined, maximum: number) {
  if (value === null || value === undefined) return null;
  const normalized = value.trim().replace(/\s+/g, " ");
  return normalized.length === 0 ? null : [...normalized].slice(0, maximum).join("");
}

function normalizeCitationUrl(value: string | null | undefined) {
  if (value === null || value === undefined) return null;
  const normalized = normalizeLinkHttpUrl(value);
  if (normalized === null) {
    throw new TypeError("Analysis citation URLs must use HTTP or HTTPS.");
  }
  return normalized;
}

function boundedLeaseDuration(value: number) {
  if (!Number.isFinite(value)) return DEFAULT_LEASE_DURATION_MS;
  return Math.min(Math.max(Math.trunc(value), 30_000), 15 * 60_000);
}

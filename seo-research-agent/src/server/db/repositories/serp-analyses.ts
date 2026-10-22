import "server-only";

import { createHash } from "node:crypto";
import { and, asc, desc, eq, inArray, lt, or, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { jobOutbox, keywordResults, serpAnalyses, serpResults, serpSnapshots } from "../schema";
import { assertVersion, leaseExpiry, normalizeBoundedText, normalizeWorkerId } from "./leases";

export const SERP_REQUESTED_EVENT = "serp.requested";
const MAX_KEYWORDS_PER_REQUEST = 100;
const SNAPSHOT_TTL_MS = 30 * 24 * 60 * 60_000;

/**
 * Queues SERP analyses for keywords in a run, together with their dispatch
 * events, in one statement. Existing analyses are left alone unless they
 * failed, in which case they are re-queued under a new version.
 */
export async function requestSerpAnalyses(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  keywordResultIds: readonly number[],
) {
  const ids = [...new Set(keywordResultIds)].filter((id) => Number.isSafeInteger(id) && id > 0);
  if (ids.length === 0) return;
  if (ids.length > MAX_KEYWORDS_PER_REQUEST) throw new RangeError("Too many keywords in one SERP request.");

  await database.execute(sql`
    with target_keywords as (
      select ${keywordResults.id} as "id"
      from ${keywordResults}
      where ${keywordResults.ownerId} = ${ownerId}
        and ${keywordResults.runId} = ${runId}
        and ${keywordResults.id} = any(${`{${ids.join(",")}}`}::bigint[])
    ), queued as (
      insert into ${serpAnalyses} ("owner_id", "run_id", "keyword_result_id")
      select ${ownerId}, ${runId}, target_keywords."id" from target_keywords
      on conflict ("owner_id", "keyword_result_id") do update
        set "status" = 'queued',
            "error_code" = null,
            "error_message" = null,
            "finished_at" = null,
            "version" = ${serpAnalyses.version} + 1,
            "updated_at" = now()
        where ${serpAnalyses.status} = 'failed'
      returning "id", "version"
    ), inserted_events as (
      insert into ${jobOutbox} (
        "owner_id", "aggregate_type", "aggregate_id", "event_type", "idempotency_key", "payload"
      )
      select
        ${ownerId}, 'serp_analysis', queued."id", ${SERP_REQUESTED_EVENT},
        'serp:' || queued."id"::text || ':' || queued."version"::text,
        jsonb_build_object('version', 1, 'ownerId', ${ownerId}::uuid, 'runId', ${runId}::uuid, 'analysisId', queued."id")
      from queued
      on conflict ("owner_id", "event_type", "idempotency_key") do nothing
    )
    select count(*) from queued
  `);
}

/** Queues the run's best opportunities: high volume and low difficulty first. */
export async function requestTopSerpAnalyses(database: DatabaseClient, ownerId: string, runId: string, limit = 10) {
  const top = await database
    .select({ id: keywordResults.id })
    .from(keywordResults)
    .where(and(eq(keywordResults.ownerId, ownerId), eq(keywordResults.runId, runId)))
    .orderBy(
      desc(sql`coalesce(${keywordResults.searchVolume}, 0) * (100 - coalesce(${keywordResults.difficulty}, 50))`),
      asc(keywordResults.id),
    )
    .limit(Math.min(Math.max(limit, 1), 25));
  const ids = top.map((row) => row.id);
  await requestSerpAnalyses(database, ownerId, runId, ids);
  return listSerpAnalysesForKeywords(database, ownerId, runId, ids);
}

export async function getSerpAnalysisById(database: DatabaseClient, ownerId: string, analysisId: string) {
  const [analysis] = await database
    .select()
    .from(serpAnalyses)
    .where(and(eq(serpAnalyses.id, analysisId), eq(serpAnalyses.ownerId, ownerId)))
    .limit(1);
  return analysis ?? null;
}

export async function getSerpAnalysisForKeyword(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  keywordResultId: number,
) {
  const [analysis] = await database
    .select()
    .from(serpAnalyses)
    .where(and(
      eq(serpAnalyses.ownerId, ownerId),
      eq(serpAnalyses.runId, runId),
      eq(serpAnalyses.keywordResultId, keywordResultId),
    ))
    .limit(1);
  return analysis ?? null;
}

/** Organic results of a stored snapshot, best rank first. */
export async function listSerpResults(database: DatabaseClient, ownerId: string, snapshotId: string) {
  return database
    .select()
    .from(serpResults)
    .where(and(eq(serpResults.ownerId, ownerId), eq(serpResults.snapshotId, snapshotId), eq(serpResults.resultType, "organic")))
    .orderBy(asc(serpResults.rank));
}

/** Niche scores of a run's completed analyses, keyed by keyword id. */
export async function listNicheScores(database: DatabaseClient, ownerId: string, runId: string) {
  const rows = await database
    .select({ keywordResultId: serpAnalyses.keywordResultId, nicheScore: serpAnalyses.nicheScore })
    .from(serpAnalyses)
    .where(and(eq(serpAnalyses.ownerId, ownerId), eq(serpAnalyses.runId, runId), eq(serpAnalyses.status, "completed")));
  return new Map(rows.flatMap((row) => (row.nicheScore === null ? [] : [[row.keywordResultId, row.nicheScore] as const])));
}

/** All organic results across a run's completed analyses (for picking competitors). */
export async function listRunSerpDomains(database: DatabaseClient, ownerId: string, runId: string) {
  return database
    .select({ domain: serpResults.domain, rank: serpResults.rank })
    .from(serpResults)
    .innerJoin(serpAnalyses, and(eq(serpAnalyses.snapshotId, serpResults.snapshotId), eq(serpAnalyses.ownerId, serpResults.ownerId)))
    .where(and(eq(serpAnalyses.ownerId, ownerId), eq(serpAnalyses.runId, runId), eq(serpResults.resultType, "organic")));
}

export async function claimSerpAnalysis(database: DatabaseClient, ownerId: string, analysisId: string, workerIdInput: string) {
  const workerId = normalizeWorkerId(workerIdInput);
  const now = new Date();
  const [analysis] = await database
    .update(serpAnalyses)
    .set({
      status: "running",
      leaseOwner: workerId,
      leaseExpiresAt: leaseExpiry(now),
      version: sql`${serpAnalyses.version} + 1`,
      errorCode: null,
      errorMessage: null,
      finishedAt: null,
      updatedAt: now,
    })
    .where(and(
      eq(serpAnalyses.id, analysisId),
      eq(serpAnalyses.ownerId, ownerId),
      or(
        eq(serpAnalyses.status, "queued"),
        and(eq(serpAnalyses.status, "running"), or(eq(serpAnalyses.leaseOwner, workerId), lt(serpAnalyses.leaseExpiresAt, now))),
      ),
    ))
    .returning();
  return analysis ?? null;
}

export type SerpResultInput = { rank: number; title: string | null; url: string | null; domain: string | null; description: string | null };

export type CompleteSerpAnalysisInput = {
  keyword: string;
  countryCode: string;
  languageCode: string;
  device: "desktop" | "mobile";
  providerRequestId: string | null;
  results: readonly SerpResultInput[];
  nicheScore: number;
  hasAiOverview: boolean;
};

/**
 * Stores the snapshot and its results and completes the analysis in one
 * statement; nothing is written unless the caller still holds the lease.
 */
export async function completeSerpAnalysis(
  database: DatabaseClient,
  analysis: { id: string; ownerId: string; runId: string; keywordResultId: number; version: number },
  workerIdInput: string,
  input: CompleteSerpAnalysisInput,
) {
  const workerId = normalizeWorkerId(workerIdInput);
  assertVersion(analysis.version);
  const results = input.results
    .filter((result) => result.rank > 0 && (result.title || result.url))
    .slice(0, 100)
    .map((result) => ({
      rank: result.rank,
      title: result.title?.slice(0, 500) ?? null,
      url: result.url,
      domain: result.domain?.trim().toLowerCase() ?? null,
      description: result.description,
    }));
  const contentHash = createHash("sha256").update(JSON.stringify([input.keyword, results])).digest("hex");
  const now = new Date();
  const expiresAt = new Date(now.getTime() + SNAPSHOT_TTL_MS);
  const nicheScore = Math.min(Math.max(Math.round(input.nicheScore), 0), 100);

  await database.execute(sql`
    with owned as (
      select ${serpAnalyses.id} from ${serpAnalyses}
      where ${serpAnalyses.id} = ${analysis.id}
        and ${serpAnalyses.ownerId} = ${analysis.ownerId}
        and ${serpAnalyses.status} = 'running'
        and ${serpAnalyses.version} = ${analysis.version}
        and ${serpAnalyses.leaseOwner} = ${workerId}
    ), snapshot as (
      insert into ${serpSnapshots} (
        "owner_id", "run_id", "keyword_result_id", "keyword", "country_code", "language_code",
        "device", "provider", "provider_request_id", "content_hash", "fetched_at", "expires_at"
      )
      select ${analysis.ownerId}, ${analysis.runId}, ${analysis.keywordResultId}, ${input.keyword},
        ${input.countryCode}, ${input.languageCode}, ${input.device}, 'dataforseo',
        ${input.providerRequestId}, ${contentHash}, ${now}, ${expiresAt}
      from owned
      on conflict ("run_id", "country_code", "language_code", "device", "content_hash")
        do update set "fetched_at" = excluded."fetched_at", "expires_at" = excluded."expires_at"
      returning "id"
    ), inserted_results as (
      insert into ${serpResults} (
        "owner_id", "run_id", "snapshot_id", "rank", "result_type", "title", "url", "domain", "description"
      )
      select ${analysis.ownerId}, ${analysis.runId}, snapshot."id", item."rank", 'organic',
        item."title", item."url", item."domain", item."description"
      from snapshot
      cross join jsonb_to_recordset(${JSON.stringify(results)}::jsonb) as item(
        "rank" smallint, "title" text, "url" text, "domain" text, "description" text
      )
      on conflict ("snapshot_id", "result_type", "page", "rank") do nothing
    )
    update ${serpAnalyses}
    set "status" = 'completed',
        "snapshot_id" = (select "id" from snapshot),
        "niche_score" = ${nicheScore},
        "has_ai_overview" = ${input.hasAiOverview},
        "lease_owner" = null,
        "lease_expires_at" = null,
        "finished_at" = ${now},
        "version" = "version" + 1,
        "updated_at" = ${now}
    where "id" in (select "id" from owned)
  `);

  const completed = await getSerpAnalysisById(database, analysis.ownerId, analysis.id);
  return completed?.status === "completed" ? completed : null;
}

export async function failSerpAnalysis(
  database: DatabaseClient,
  analysis: { id: string; ownerId: string; version: number },
  workerIdInput: string,
  errorCode: string,
  errorMessage: string,
) {
  const workerId = normalizeWorkerId(workerIdInput);
  assertVersion(analysis.version);
  const now = new Date();
  const [failed] = await database
    .update(serpAnalyses)
    .set({
      status: "failed",
      errorCode: normalizeBoundedText(errorCode, 80, "Error code"),
      errorMessage: normalizeBoundedText(errorMessage, 500, "Error message"),
      leaseOwner: null,
      leaseExpiresAt: null,
      finishedAt: now,
      version: sql`${serpAnalyses.version} + 1`,
      updatedAt: now,
    })
    .where(and(
      eq(serpAnalyses.id, analysis.id),
      eq(serpAnalyses.ownerId, analysis.ownerId),
      eq(serpAnalyses.status, "running"),
      eq(serpAnalyses.version, analysis.version),
      eq(serpAnalyses.leaseOwner, workerId),
    ))
    .returning();
  return failed ?? null;
}

/** Analyses for specific keywords in a run (used after requesting them). */
export async function listSerpAnalysesForKeywords(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  keywordResultIds: readonly number[],
) {
  if (keywordResultIds.length === 0) return [];
  return database
    .select()
    .from(serpAnalyses)
    .where(and(
      eq(serpAnalyses.ownerId, ownerId),
      eq(serpAnalyses.runId, runId),
      inArray(serpAnalyses.keywordResultId, [...keywordResultIds]),
    ));
}

/** SERP analyses of a run that are still queued or running. */
export async function countPendingSerpAnalyses(database: DatabaseClient, ownerId: string, runId: string) {
  const [row] = await database
    .select({ count: sql<number>`count(*)::int` })
    .from(serpAnalyses)
    .where(and(
      eq(serpAnalyses.ownerId, ownerId),
      eq(serpAnalyses.runId, runId),
      inArray(serpAnalyses.status, ["queued", "running"]),
    ));
  return Number(row?.count ?? 0);
}

import "server-only";

import { and, eq, lt, or, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { contentGapReports, jobOutbox, researchRuns } from "../schema";
import { assertVersion, leaseExpiry, normalizeBoundedText, normalizeWorkerId } from "./leases";

export const CONTENT_GAP_REQUESTED_EVENT = "content-gap.requested";
const MAX_GAP_KEYWORDS = 200;

export type ContentGapKeywordInput = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpcMicros: number | null;
  competitorDomain: string;
  competitorRank: number;
};

/**
 * Queues a report for a completed run and target domain with its dispatch
 * event in one statement. Failed reports are re-queued; others are reused.
 */
export async function requestContentGap(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  targetDomainInput: string,
) {
  const targetDomain = targetDomainInput.trim().toLowerCase();
  await database.execute(sql`
    with queued as (
      insert into ${contentGapReports} ("owner_id", "run_id", "target_domain")
      select ${ownerId}, ${researchRuns.id}, ${targetDomain}
      from ${researchRuns}
      where ${researchRuns.id} = ${runId}
        and ${researchRuns.ownerId} = ${ownerId}
        and ${researchRuns.status} = 'completed'
      on conflict ("owner_id", "run_id", "target_domain") do update
        set "status" = 'queued',
            "error_code" = null,
            "error_message" = null,
            "finished_at" = null,
            "version" = ${contentGapReports.version} + 1,
            "updated_at" = now()
        where ${contentGapReports.status} = 'failed'
      returning "id", "version"
    ), inserted_events as (
      insert into ${jobOutbox} (
        "owner_id", "aggregate_type", "aggregate_id", "event_type", "idempotency_key", "payload"
      )
      select
        ${ownerId}, 'content_gap', queued."id", ${CONTENT_GAP_REQUESTED_EVENT},
        'content-gap:' || queued."id"::text || ':' || queued."version"::text,
        jsonb_build_object('version', 1, 'ownerId', ${ownerId}::uuid, 'runId', ${runId}::uuid, 'reportId', queued."id")
      from queued
      on conflict ("owner_id", "event_type", "idempotency_key") do nothing
    )
    select count(*) from queued
  `);
  return getContentGap(database, ownerId, runId, targetDomain);
}

export async function getContentGap(database: DatabaseClient, ownerId: string, runId: string, targetDomain: string) {
  const [report] = await database
    .select()
    .from(contentGapReports)
    .where(and(
      eq(contentGapReports.ownerId, ownerId),
      eq(contentGapReports.runId, runId),
      eq(contentGapReports.targetDomain, targetDomain.trim().toLowerCase()),
    ))
    .limit(1);
  return report ?? null;
}

export async function getContentGapById(database: DatabaseClient, ownerId: string, reportId: string) {
  const [report] = await database
    .select()
    .from(contentGapReports)
    .where(and(eq(contentGapReports.id, reportId), eq(contentGapReports.ownerId, ownerId)))
    .limit(1);
  return report ?? null;
}

export async function claimContentGap(database: DatabaseClient, ownerId: string, reportId: string, workerIdInput: string) {
  const workerId = normalizeWorkerId(workerIdInput);
  const now = new Date();
  const [report] = await database
    .update(contentGapReports)
    .set({
      status: "running",
      leaseOwner: workerId,
      leaseExpiresAt: leaseExpiry(now),
      version: sql`${contentGapReports.version} + 1`,
      errorCode: null,
      errorMessage: null,
      finishedAt: null,
      updatedAt: now,
    })
    .where(and(
      eq(contentGapReports.id, reportId),
      eq(contentGapReports.ownerId, ownerId),
      or(
        eq(contentGapReports.status, "queued"),
        and(eq(contentGapReports.status, "running"), or(eq(contentGapReports.leaseOwner, workerId), lt(contentGapReports.leaseExpiresAt, now))),
      ),
    ))
    .returning();
  return report ?? null;
}

export async function completeContentGap(
  database: DatabaseClient,
  report: { id: string; ownerId: string; version: number },
  workerIdInput: string,
  input: { competitors: readonly string[]; keywords: readonly ContentGapKeywordInput[] },
) {
  const workerId = normalizeWorkerId(workerIdInput);
  assertVersion(report.version);
  const now = new Date();
  const [completed] = await database
    .update(contentGapReports)
    .set({
      status: "completed",
      competitors: input.competitors.slice(0, 10),
      keywords: input.keywords.slice(0, MAX_GAP_KEYWORDS),
      leaseOwner: null,
      leaseExpiresAt: null,
      finishedAt: now,
      version: sql`${contentGapReports.version} + 1`,
      updatedAt: now,
    })
    .where(and(
      eq(contentGapReports.id, report.id),
      eq(contentGapReports.ownerId, report.ownerId),
      eq(contentGapReports.status, "running"),
      eq(contentGapReports.version, report.version),
      eq(contentGapReports.leaseOwner, workerId),
    ))
    .returning();
  return completed ?? null;
}

export async function failContentGap(
  database: DatabaseClient,
  report: { id: string; ownerId: string; version: number },
  workerIdInput: string,
  errorCode: string,
  errorMessage: string,
) {
  const workerId = normalizeWorkerId(workerIdInput);
  assertVersion(report.version);
  const now = new Date();
  const [failed] = await database
    .update(contentGapReports)
    .set({
      status: "failed",
      errorCode: normalizeBoundedText(errorCode, 80, "Error code"),
      errorMessage: normalizeBoundedText(errorMessage, 500, "Error message"),
      leaseOwner: null,
      leaseExpiresAt: null,
      finishedAt: now,
      version: sql`${contentGapReports.version} + 1`,
      updatedAt: now,
    })
    .where(and(
      eq(contentGapReports.id, report.id),
      eq(contentGapReports.ownerId, report.ownerId),
      eq(contentGapReports.status, "running"),
      eq(contentGapReports.version, report.version),
      eq(contentGapReports.leaseOwner, workerId),
    ))
    .returning();
  return failed ?? null;
}

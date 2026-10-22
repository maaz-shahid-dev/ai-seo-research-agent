import "server-only";

import { createHash } from "node:crypto";
import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import { idempotencyKeySchema, researchRequestSchema } from "@/features/research/schemas";
import type { DatabaseClient } from "../client";
import { jobOutbox, researchRuns } from "../schema";
import { IdempotencyConflictError } from "./errors";

const RESEARCH_REQUESTED_EVENT = "research.requested";

export type CreateResearchRunInput = {
  projectId: string;
  idempotencyKey: string;
  query: string;
  countryCode: string;
  languageCode: string;
  device?: "desktop" | "mobile";
  keywordLimit: number;
};

export type ResearchRunCursor = {
  createdAt: Date;
  id: string;
};

/** Creates the durable run and its dispatch event in one SQL statement. */
export async function createResearchRun(
  database: DatabaseClient,
  ownerId: string,
  input: CreateResearchRunInput,
) {
  const request = researchRequestSchema.parse({
    projectId: input.projectId,
    seed: input.query,
    countryCode: input.countryCode,
    languageCode: input.languageCode,
    device: input.device,
    keywordLimit: input.keywordLimit,
  });
  const idempotencyKey = idempotencyKeySchema.parse(input.idempotencyKey);
  const canonicalRequest = {
    projectId: request.projectId,
    query: request.seed,
    countryCode: request.countryCode,
    languageCode: request.languageCode,
    device: request.device,
    keywordLimit: request.keywordLimit,
  } as const;
  const requestHash = sha256(JSON.stringify(canonicalRequest));
  const runId = deterministicUuid(ownerId, idempotencyKey);
  const configuration = { keywordLimit: request.keywordLimit };
  const payload = { version: 1, ownerId, runId };

  await database.execute(sql`
    with inserted_run as (
      insert into ${researchRuns} (
        "id", "owner_id", "project_id", "idempotency_key", "request_hash", "query",
        "country_code", "language_code", "device", "configuration"
      ) values (
        ${runId}, ${ownerId}, ${request.projectId},
        ${idempotencyKey}, ${requestHash}, ${request.seed},
        ${request.countryCode}, ${request.languageCode}, ${request.device},
        ${JSON.stringify(configuration)}::jsonb
      )
      on conflict ("owner_id", "idempotency_key") do nothing
      returning "id"
    ), target_run as (
      -- A run inserted above is invisible to reads in this same statement, so
      -- take it from RETURNING; a replay finds the existing run in the table.
      select "id" from inserted_run
      union all
      select ${researchRuns.id} from ${researchRuns}
      where ${researchRuns.ownerId} = ${ownerId}
        and ${researchRuns.idempotencyKey} = ${idempotencyKey}
        and ${researchRuns.requestHash} = ${requestHash}
    ), inserted_event as (
      insert into ${jobOutbox} (
        "owner_id", "aggregate_type", "aggregate_id", "event_type", "idempotency_key", "payload"
      )
      select
        ${ownerId}, 'research_run', target_run."id",
        ${RESEARCH_REQUESTED_EVENT}, ${idempotencyKey}, ${JSON.stringify(payload)}::jsonb
      from target_run
      on conflict ("owner_id", "event_type", "idempotency_key") do nothing
      returning "id"
    )
    select 1
  `);

  const [run] = await database
    .select()
    .from(researchRuns)
    .where(
      and(
        eq(researchRuns.ownerId, ownerId),
        eq(researchRuns.idempotencyKey, idempotencyKey),
      ),
    )
    .limit(1);

  if (!run) throw new Error("The research run could not be created.");
  if (run.requestHash !== requestHash) throw new IdempotencyConflictError();
  return run;
}

export async function getResearchRunById(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
) {
  const [run] = await database
    .select()
    .from(researchRuns)
    .where(and(eq(researchRuns.id, runId), eq(researchRuns.ownerId, ownerId)))
    .limit(1);
  return run ?? null;
}

export async function listResearchRuns(
  database: DatabaseClient,
  ownerId: string,
  options: { projectId?: string; cursor?: ResearchRunCursor; limit?: number } = {},
) {
  const limit = boundedLimit(options.limit, 25, 100);
  const conditions = [eq(researchRuns.ownerId, ownerId)];

  if (options.projectId) conditions.push(eq(researchRuns.projectId, options.projectId));
  if (options.cursor) {
    conditions.push(
      or(
        lt(researchRuns.createdAt, options.cursor.createdAt),
        and(
          eq(researchRuns.createdAt, options.cursor.createdAt),
          lt(researchRuns.id, options.cursor.id),
        ),
      )!,
    );
  }

  const rows = await database
    .select()
    .from(researchRuns)
    .where(and(...conditions))
    .orderBy(desc(researchRuns.createdAt), desc(researchRuns.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor: hasMore && last ? { createdAt: last.createdAt, id: last.id } : null,
  };
}

export async function claimResearchRun(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  workerId: string,
  leaseDurationMs = 5 * 60_000,
) {
  const now = new Date();
  const leaseExpiresAt = new Date(now.getTime() + Math.max(30_000, leaseDurationMs));
  const [run] = await database
    .update(researchRuns)
    .set({
      status: "running",
      progress: sql`greatest(${researchRuns.progress}, 1)`,
      startedAt: sql<Date>`coalesce(${researchRuns.startedAt}, ${now})`,
      leaseOwner: workerId,
      leaseExpiresAt,
      version: sql`${researchRuns.version} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(researchRuns.id, runId),
        eq(researchRuns.ownerId, ownerId),
        or(
          eq(researchRuns.status, "queued"),
          and(
            eq(researchRuns.status, "running"),
            or(
              eq(researchRuns.leaseOwner, workerId),
              lt(researchRuns.leaseExpiresAt, now),
            ),
          ),
        ),
      ),
    )
    .returning();
  return run ?? null;
}

export async function updateResearchRunProgress(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  expectedVersion: number,
  workerId: string,
  progress: number,
) {
  const boundedProgress = Math.min(Math.max(Math.trunc(progress), 1), 99);
  const [run] = await database
    .update(researchRuns)
    .set({
      progress: sql`greatest(${researchRuns.progress}, ${boundedProgress})`,
      version: sql`${researchRuns.version} + 1`,
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(researchRuns.id, runId),
        eq(researchRuns.ownerId, ownerId),
        eq(researchRuns.status, "running"),
        eq(researchRuns.version, expectedVersion),
        eq(researchRuns.leaseOwner, workerId),
      ),
    )
    .returning();
  return run ?? null;
}

export async function finishResearchRun(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  expectedVersion: number,
  workerId: string,
  result:
    | { status: "completed"; keywordCount: number }
    | { status: "failed"; errorCode: string; errorMessage: string },
) {
  const now = new Date();
  const changes = result.status === "completed"
    ? {
        status: result.status,
        progress: 100,
        keywordCount: result.keywordCount,
        errorCode: null,
        errorMessage: null,
      }
    : {
        status: result.status,
        errorCode: result.errorCode,
        errorMessage: result.errorMessage,
      };
  const [run] = await database
    .update(researchRuns)
    .set({
      ...changes,
      finishedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      version: sql`${researchRuns.version} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(researchRuns.id, runId),
        eq(researchRuns.ownerId, ownerId),
        eq(researchRuns.status, "running"),
        eq(researchRuns.version, expectedVersion),
        eq(researchRuns.leaseOwner, workerId),
      ),
    )
    .returning();
  return run ?? null;
}

export async function cancelResearchRun(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  expectedVersion: number,
) {
  const now = new Date();
  const [run] = await database
    .update(researchRuns)
    .set({
      status: "cancelled",
      finishedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      version: sql`${researchRuns.version} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(researchRuns.id, runId),
        eq(researchRuns.ownerId, ownerId),
        eq(researchRuns.version, expectedVersion),
        or(eq(researchRuns.status, "queued"), eq(researchRuns.status, "running")),
      ),
    )
    .returning();
  return run ?? null;
}

/** Marks a queued/running run terminal after the durable job exhausts retries. */
export async function failResearchRunAfterExhaustion(
  database: DatabaseClient,
  ownerId: string,
  runId: string,
  expectedVersion: number,
  errorCode: string,
  errorMessage: string,
) {
  const now = new Date();
  const [run] = await database
    .update(researchRuns)
    .set({
      status: "failed",
      errorCode: errorCode.slice(0, 80),
      errorMessage: errorMessage.slice(0, 500),
      finishedAt: now,
      leaseOwner: null,
      leaseExpiresAt: null,
      version: sql`${researchRuns.version} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(researchRuns.id, runId),
        eq(researchRuns.ownerId, ownerId),
        eq(researchRuns.version, expectedVersion),
        or(eq(researchRuns.status, "queued"), eq(researchRuns.status, "running")),
      ),
    )
    .returning();
  return run ?? null;
}

function sha256(value: string) {
  return createHash("sha256").update(value).digest("hex");
}

function deterministicUuid(ownerId: string, idempotencyKey: string) {
  const bytes = createHash("sha256")
    .update(`${ownerId}:${idempotencyKey}`)
    .digest()
    .subarray(0, 16);
  bytes[6] = (bytes[6]! & 0x0f) | 0x50;
  bytes[8] = (bytes[8]! & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  return Number.isSafeInteger(value) ? Math.min(Math.max(value!, 1), maximum) : fallback;
}

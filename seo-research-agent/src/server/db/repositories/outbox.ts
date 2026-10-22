import "server-only";

import { and, asc, eq, inArray, lt, lte, or, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { jobOutbox } from "../schema";

const CLAIMABLE_STATUSES = ["pending", "failed"] as const;

export async function claimOutboxEvents(
  database: DatabaseClient,
  workerId: string,
  options: { limit?: number; leaseDurationMs?: number } = {},
) {
  const limit = boundedLimit(options.limit, 20, 100);
  const now = new Date();
  const staleBefore = new Date(now.getTime() - Math.max(options.leaseDurationMs ?? 60_000, 30_000));
  const eligible = or(
    and(
      inArray(jobOutbox.status, [...CLAIMABLE_STATUSES]),
      lte(jobOutbox.availableAt, now),
    ),
    and(eq(jobOutbox.status, "processing"), lt(jobOutbox.lockedAt, staleBefore)),
  )!;
  const candidates = await database
    .select({ id: jobOutbox.id })
    .from(jobOutbox)
    .where(eligible)
    .orderBy(asc(jobOutbox.availableAt), asc(jobOutbox.createdAt))
    .limit(limit * 3);

  const claimed = [];
  for (const candidate of candidates) {
    const [event] = await database
      .update(jobOutbox)
      .set({
        status: "processing",
        lockedAt: now,
        lockedBy: workerId,
        attempts: sql`${jobOutbox.attempts} + 1`,
        updatedAt: now,
      })
      .where(and(eq(jobOutbox.id, candidate.id), eligible))
      .returning();

    if (event) claimed.push(event);
    if (claimed.length === limit) break;
  }

  return claimed;
}

export async function claimOutboxEventByAggregate(
  database: DatabaseClient,
  ownerId: string,
  aggregateId: string,
  eventType: string,
  workerId: string,
) {
  const now = new Date();
  const [event] = await database
    .update(jobOutbox)
    .set({
      status: "processing",
      lockedAt: now,
      lockedBy: workerId,
      attempts: sql`${jobOutbox.attempts} + 1`,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobOutbox.ownerId, ownerId),
        eq(jobOutbox.aggregateId, aggregateId),
        eq(jobOutbox.eventType, eventType),
        inArray(jobOutbox.status, [...CLAIMABLE_STATUSES]),
        lte(jobOutbox.availableAt, now),
      ),
    )
    .returning();
  return event ?? null;
}

export async function markOutboxEventPublished(
  database: DatabaseClient,
  eventId: string,
  workerId: string,
) {
  const now = new Date();
  const [event] = await database
    .update(jobOutbox)
    .set({
      status: "published",
      publishedAt: now,
      lockedAt: null,
      lockedBy: null,
      lastError: null,
      updatedAt: now,
    })
    .where(
      and(
        eq(jobOutbox.id, eventId),
        eq(jobOutbox.status, "processing"),
        eq(jobOutbox.lockedBy, workerId),
      ),
    )
    .returning();
  return event ?? null;
}

export async function markOutboxEventFailed(
  database: DatabaseClient,
  eventId: string,
  workerId: string,
  errorMessage: string,
  options: { maxAttempts?: number; retryDelayMs?: number } = {},
) {
  const now = new Date();
  const maxAttempts = options.maxAttempts ?? 8;
  const [current] = await database
    .select({ attempts: jobOutbox.attempts })
    .from(jobOutbox)
    .where(
      and(
        eq(jobOutbox.id, eventId),
        eq(jobOutbox.status, "processing"),
        eq(jobOutbox.lockedBy, workerId),
      ),
    )
    .limit(1);
  if (!current) return null;

  const dead = current.attempts >= maxAttempts;
  const retryDelayMs = Math.max(options.retryDelayMs ?? 30_000, 1_000);
  const [event] = await database
    .update(jobOutbox)
    .set({
      status: dead ? "dead" : "failed",
      availableAt: dead ? now : new Date(now.getTime() + retryDelayMs),
      lockedAt: null,
      lockedBy: null,
      lastError: errorMessage.slice(0, 1_000),
      updatedAt: now,
    })
    .where(
      and(
        eq(jobOutbox.id, eventId),
        eq(jobOutbox.status, "processing"),
        eq(jobOutbox.lockedBy, workerId),
      ),
    )
    .returning();
  return event ?? null;
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  return Number.isSafeInteger(value) ? Math.min(Math.max(value!, 1), maximum) : fallback;
}

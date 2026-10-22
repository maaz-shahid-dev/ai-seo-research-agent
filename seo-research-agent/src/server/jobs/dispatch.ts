import "server-only";

import {
  claimOutboxEventByAggregate,
  markOutboxEventFailed,
  markOutboxEventPublished,
} from "@/server/db/repositories";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/server/logging/logger";

import { inngest } from "./client";
import { ANALYSIS_REQUESTED_EVENT, RESEARCH_REQUESTED_EVENT } from "./events";

type DispatchableEvent =
  | typeof RESEARCH_REQUESTED_EVENT
  | typeof ANALYSIS_REQUESTED_EVENT;

/** Best-effort fast path; the scheduled outbox dispatcher remains the recovery path. */
export async function dispatchResearchRunNow(ownerId: string, runId: string) {
  return dispatchOutboxEventNow(ownerId, runId, RESEARCH_REQUESTED_EVENT);
}

export async function dispatchOutboxEventNow(
  ownerId: string,
  aggregateId: string,
  eventType: DispatchableEvent,
) {
  const workerId = `request:${crypto.randomUUID()}`;
  const event = await claimOutboxEventByAggregate(
    getDatabase(),
    ownerId,
    aggregateId,
    eventType,
    workerId,
  );
  if (!event) return false;

  try {
    await inngest.send({ id: event.id, name: event.eventType, data: event.payload });
    const published = await markOutboxEventPublished(getDatabase(), event.id, workerId);
    if (published) return true;

    logger.warn(
      { ownerId, aggregateId, eventType },
      "Immediate event was sent but its publish lease was no longer owned",
    );
    return false;
  } catch (error) {
    await markOutboxEventFailed(
      getDatabase(),
      event.id,
      workerId,
      "Event dispatch failed",
    );
    logger.warn(
      { error, ownerId, aggregateId, eventType },
      "Immediate event dispatch failed; queued for retry",
    );
    return false;
  }
}

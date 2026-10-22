import "server-only";

import {
  claimOutboxEvents,
  markOutboxEventFailed,
  markOutboxEventPublished,
} from "@/server/db/repositories";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/server/logging/logger";

import { inngest } from "./client";

export const dispatchOutbox = inngest.createFunction(
  {
    id: "dispatch-outbox-v1",
    name: "Dispatch durable events",
    triggers: [{ cron: "*/1 * * * *" }],
    singleton: { mode: "skip" },
    retries: 3,
  },
  async ({ event, step }) => {
    const workerId = event.id ?? `dispatcher:${Date.now()}`;
    const events = await step.run("claim-events", () =>
      claimOutboxEvents(getDatabase(), workerId, { limit: 50 }),
    );

    let published = 0;
    let failed = 0;
    for (const outboxEvent of events) {
      try {
        await step.run(`send-${outboxEvent.id}`, () =>
          inngest.send({
            id: outboxEvent.id,
            name: outboxEvent.eventType,
            data: outboxEvent.payload,
          }),
        );
        const markedPublished = await step.run(`publish-${outboxEvent.id}`, () =>
          markOutboxEventPublished(getDatabase(), outboxEvent.id, workerId),
        );
        if (markedPublished) {
          published += 1;
        } else {
          failed += 1;
          logger.warn(
            { eventId: outboxEvent.id },
            "Outbox event was sent but its publish lease was no longer owned",
          );
        }
      } catch (error) {
        const released = await step.run(`release-${outboxEvent.id}`, () =>
          markOutboxEventFailed(
            getDatabase(),
            outboxEvent.id,
            workerId,
            "Event dispatch failed",
          ),
        );
        failed += 1;
        logger.error(
          { error, eventId: outboxEvent.id, released: Boolean(released) },
          "Outbox event dispatch failed",
        );
      }
    }

    return { claimed: events.length, published, failed };
  },
);

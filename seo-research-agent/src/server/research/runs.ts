import "server-only";

import { researchRunIdSchema } from "@/features/research/schemas";
import type { DatabaseClient } from "@/server/db/client";
import { getResearchRunById } from "@/server/db/repositories";
import { AppError } from "@/server/http/errors";

/** The owner's run, which must have finished successfully; 404/409 otherwise. */
export async function requireCompletedRun(database: DatabaseClient, ownerId: string, runIdInput: string) {
  const runId = researchRunIdSchema.parse(runIdInput);
  const run = await getResearchRunById(database, ownerId, runId);
  if (!run) throw new AppError("Research not found.", "NOT_FOUND", 404, false);
  if (run.status !== "completed") {
    throw new AppError("This search hasn't finished yet.", "RUN_NOT_READY", 409, false);
  }
  return run;
}

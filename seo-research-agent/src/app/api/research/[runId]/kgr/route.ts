import { z } from "zod";

import { KGR_BATCH_SIZE } from "@/features/research/kgr";
import { requireActiveUser } from "@/server/auth";
import { isResearchConfigured } from "@/server/config/environment";
import { getDatabase } from "@/server/db/client";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { enforceRateLimit } from "@/server/rate-limit/rate-limit";
import { checkAllintitleCounts } from "@/server/research/kgr";
import { requireCompletedRun } from "@/server/research/runs";
import { isSameOriginMutation } from "@/server/security/request";

// Up to 10 live lookups, four at a time.
export const maxDuration = 60;

type RouteContext = { params: Promise<{ runId: string }> };

const kgrRequestSchema = z
  .object({
    keywordIds: z
      .array(z.number().int().positive().max(Number.MAX_SAFE_INTEGER))
      .min(1)
      .max(KGR_BATCH_SIZE)
      .refine((ids) => new Set(ids).size === ids.length, "Keyword ids must be unique."),
  })
  .strict();

/** Checks allintitle counts for low-volume keywords so their Keyword Golden Ratio can be shown. */
export async function POST(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    const input = kgrRequestSchema.parse(await readBoundedJson(request, 4 * 1024));
    const database = getDatabase();
    const run = await requireCompletedRun(database, user.id, (await context.params).runId);

    const result = await checkAllintitleCounts({
      database,
      ownerId: user.id,
      run,
      keywordIds: input.keywordIds,
      // Only new lookups cost money, so only they are checked and limited.
      beforeLookups: async () => {
        if (!isResearchConfigured()) {
          throw new AppError("KGR checks aren't available yet. Try again later.", "RESEARCH_NOT_CONFIGURED", 503, false);
        }
        await enforceRateLimit("kgr", user.id);
      },
    });
    return noStore(Response.json(result));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

import { z } from "zod";

import { requireActiveUser } from "@/server/auth";
import { isResearchConfigured } from "@/server/config/environment";
import { getDatabase } from "@/server/db/client";
import {
  getKeywordResult,
  getSerpAnalysisForKeyword,
  requestSerpAnalyses,
} from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";
import { dispatchOutboxEventNow } from "@/server/jobs";
import { SERP_REQUESTED_EVENT } from "@/server/jobs/events";
import { enforceRateLimit } from "@/server/rate-limit/rate-limit";
import { requireCompletedRun } from "@/server/research/runs";
import { loadSerpAnalysisDto } from "@/server/research/serp-view";
import { isSameOriginMutation } from "@/server/security/request";

type RouteContext = { params: Promise<{ runId: string; keywordId: string }> };

const keywordIdSchema = z.coerce.number().int().positive().max(Number.MAX_SAFE_INTEGER);

/** Reads a keyword's SERP analysis. */
export async function GET(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const { runId, keywordId } = await readParams(context);
    const database = getDatabase();
    const run = await requireCompletedRun(database, user.id, runId);
    const analysis = await getSerpAnalysisForKeyword(database, user.id, run.id, keywordId);
    if (!analysis) throw new AppError("This SERP hasn't been analyzed yet.", "NOT_FOUND", 404, false);
    return noStore(Response.json({ serp: await loadSerpAnalysisDto(database, analysis) }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

/** Requests a keyword's SERP analysis; returns the existing one when present. */
export async function POST(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    const { runId, keywordId } = await readParams(context);
    const database = getDatabase();
    const run = await requireCompletedRun(database, user.id, runId);
    const keyword = await getKeywordResult(database, user.id, run.id, keywordId);
    if (!keyword) throw new AppError("Keyword not found.", "NOT_FOUND", 404, false);

    const existing = await getSerpAnalysisForKeyword(database, user.id, run.id, keyword.id);
    if (existing && existing.status !== "failed") {
      return noStore(Response.json({ serp: await loadSerpAnalysisDto(database, existing) }));
    }

    // Only new or retried lookups cost money, so only they are checked and limited.
    if (!isResearchConfigured()) {
      throw new AppError("SERP analysis isn't available yet. Try again later.", "RESEARCH_NOT_CONFIGURED", 503, false);
    }
    await enforceRateLimit("serp", user.id);
    await requestSerpAnalyses(database, user.id, run.id, [keyword.id]);
    const queued = await getSerpAnalysisForKeyword(database, user.id, run.id, keyword.id);
    if (!queued) throw new AppError("The SERP analysis could not be started.", "SERP_NOT_QUEUED", 500, true);
    await dispatchOutboxEventNow(user.id, queued.id, SERP_REQUESTED_EVENT);

    return noStore(Response.json({ serp: await loadSerpAnalysisDto(database, queued) }, { status: 202 }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

async function readParams(context: RouteContext) {
  const params = await context.params;
  return { runId: params.runId, keywordId: keywordIdSchema.parse(params.keywordId) };
}

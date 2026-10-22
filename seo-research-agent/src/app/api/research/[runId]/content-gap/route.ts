import { toContentGapDto } from "@/features/research/dto";
import { requireActiveUser } from "@/server/auth";
import { isResearchConfigured } from "@/server/config/environment";
import { getDatabase } from "@/server/db/client";
import type { DatabaseClient } from "@/server/db/client";
import { getContentGap, getProjectById, requestContentGap } from "@/server/db/repositories";
import type { ResearchRun } from "@/server/db/schema";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";
import { dispatchOutboxEventNow } from "@/server/jobs";
import { CONTENT_GAP_REQUESTED_EVENT } from "@/server/jobs/events";
import { enforceRateLimit } from "@/server/rate-limit/rate-limit";
import { requireCompletedRun } from "@/server/research/runs";
import { isSameOriginMutation } from "@/server/security/request";

type RouteContext = { params: Promise<{ runId: string }> };

/** Reads the content gap report for the project's current website. */
export async function GET(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const database = getDatabase();
    const run = await requireCompletedRun(database, user.id, (await context.params).runId);
    const targetDomain = await requireTargetDomain(database, user.id, run);
    const report = await getContentGap(database, user.id, run.id, targetDomain);
    if (!report) throw new AppError("No content gap report yet.", "NOT_FOUND", 404, false);
    return noStore(Response.json({ contentGap: toContentGapDto(report) }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

/** Requests a content gap report; returns the existing one when present. */
export async function POST(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    const database = getDatabase();
    const run = await requireCompletedRun(database, user.id, (await context.params).runId);
    const targetDomain = await requireTargetDomain(database, user.id, run);

    const existing = await getContentGap(database, user.id, run.id, targetDomain);
    if (existing && existing.status !== "failed") {
      return noStore(Response.json({ contentGap: toContentGapDto(existing) }));
    }

    if (!isResearchConfigured()) {
      throw new AppError("Content gap analysis isn't available yet. Try again later.", "RESEARCH_NOT_CONFIGURED", 503, false);
    }
    await enforceRateLimit("content-gap", user.id);
    const report = await requestContentGap(database, user.id, run.id, targetDomain);
    if (!report) throw new AppError("The content gap report could not be started.", "CONTENT_GAP_NOT_QUEUED", 500, true);
    await dispatchOutboxEventNow(user.id, report.id, CONTENT_GAP_REQUESTED_EVENT);

    return noStore(Response.json({ contentGap: toContentGapDto(report) }, { status: 202 }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

/** The website saved on the run's project; content gaps compare against it. */
async function requireTargetDomain(database: DatabaseClient, ownerId: string, run: ResearchRun) {
  const project = await getProjectById(database, ownerId, run.projectId);
  if (!project?.targetDomain) {
    throw new AppError("Add your website to this project first.", "WEBSITE_REQUIRED", 409, false);
  }
  return project.targetDomain;
}

import { researchHistoryQuerySchema, researchSubmissionSchema } from "@/features/research/schemas";
import { toResearchRunDto } from "@/features/research/dto";
import { requireActiveUser } from "@/server/auth";
import { isResearchConfigured } from "@/server/config/environment";
import { getDatabase } from "@/server/db/client";
import {
  createResearchRun,
  getProjectById,
  IdempotencyConflictError,
  listResearchRuns,
} from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { dispatchResearchRunNow } from "@/server/jobs";
import { enforceRateLimit } from "@/server/rate-limit/rate-limit";
import { isSameOriginMutation } from "@/server/security/request";

/** Lists the signed-in user's most recent runs for one project, newest first. */
export async function GET(request: Request) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const params = new URL(request.url).searchParams;
    const input = researchHistoryQuerySchema.parse({
      projectId: params.get("projectId") ?? undefined,
      limit: params.get("limit") ?? undefined,
    });
    const result = await listResearchRuns(getDatabase(), user.id, {
      projectId: input.projectId,
      limit: input.limit,
    });
    return noStore(Response.json({ runs: result.items.map(toResearchRunDto) }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    // Without a job queue and SEO provider the run could never finish.
    if (!isResearchConfigured()) {
      throw new AppError(
        "Keyword research isn't available yet. Try again later.",
        "RESEARCH_NOT_CONFIGURED",
        503,
        false,
      );
    }
    await enforceRateLimit("research", user.id);
    const input = researchSubmissionSchema.parse(await readBoundedJson(request, 16 * 1024));
    const project = await getProjectById(getDatabase(), user.id, input.projectId);
    if (!project || project.status !== "active") {
      throw new AppError("Project not found.", "NOT_FOUND", 404, false);
    }

    const run = await createResearchRun(getDatabase(), user.id, {
      projectId: input.projectId,
      idempotencyKey: input.idempotencyKey,
      query: input.seed,
      countryCode: input.countryCode,
      languageCode: input.languageCode,
      device: input.device,
      keywordLimit: input.keywordLimit,
    });
    await dispatchResearchRunNow(user.id, run.id);

    return noStore(Response.json({ run: toResearchRunDto(run) }, { status: 202 }));
  } catch (error) {
    if (error instanceof IdempotencyConflictError) {
      return noStore(
        errorResponse(
          new AppError(error.message, "IDEMPOTENCY_CONFLICT", 409, false),
          requestId,
        ),
      );
    }
    return noStore(errorResponse(error, requestId));
  }
}

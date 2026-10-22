import { researchSubmissionSchema } from "@/features/research/schemas";
import { toResearchRunDto } from "@/features/research/dto";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import {
  createResearchRun,
  getProjectById,
  IdempotencyConflictError,
} from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { dispatchResearchRunNow } from "@/server/jobs";
import { enforceRateLimit } from "@/server/rate-limit/rate-limit";
import { isSameOriginMutation } from "@/server/security/request";

export async function POST(request: Request) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
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

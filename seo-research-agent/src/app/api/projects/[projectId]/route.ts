import { projectIdSchema, updateProjectSchema } from "@/features/projects/schemas";
import { toProjectDto } from "@/features/projects/dto";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import {
  getProjectById,
  hasDatabaseErrorCode,
  updateProject,
} from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { isSameOriginMutation } from "@/server/security/request";

type RouteContext = { params: Promise<{ projectId: string }> };

export async function PATCH(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    const projectId = projectIdSchema.parse((await context.params).projectId);
    const input = updateProjectSchema.parse(await readBoundedJson(request, 8 * 1024));
    const updated = await updateProject(getDatabase(), user.id, projectId, input.version, {
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.targetDomain !== undefined ? { targetDomain: input.targetDomain } : {}),
      ...(input.countryCode !== undefined ? { defaultCountryCode: input.countryCode } : {}),
      ...(input.languageCode !== undefined ? { defaultLanguageCode: input.languageCode } : {}),
      ...(input.archived !== undefined
        ? { status: input.archived ? "archived" as const : "active" as const }
        : {}),
    });
    if (!updated) {
      const existing = await getProjectById(getDatabase(), user.id, projectId);
      if (!existing) throw new AppError("Project not found.", "NOT_FOUND", 404, false);
      throw new AppError(
        "This project changed in another session. Refresh and try again.",
        "VERSION_CONFLICT",
        409,
        false,
      );
    }
    return noStore(Response.json({ project: toProjectDto(updated) }));
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) {
      return noStore(
        errorResponse(
          new AppError("A project with this name already exists.", "PROJECT_EXISTS", 409, false),
          requestId,
        ),
      );
    }
    return noStore(errorResponse(error, requestId));
  }
}

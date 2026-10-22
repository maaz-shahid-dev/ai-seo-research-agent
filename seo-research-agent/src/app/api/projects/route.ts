import { createProjectSchema } from "@/features/projects/schemas";
import { toProjectDto } from "@/features/projects/dto";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import {
  createProject,
  hasDatabaseErrorCode,
  listProjects,
} from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { isSameOriginMutation } from "@/server/security/request";

const MAX_BODY_BYTES = 8 * 1024;

export async function GET(request: Request) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const result = await listProjects(getDatabase(), user.id, { limit: 100 });
    return noStore(Response.json({ projects: result.items.map(toProjectDto) }));
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
    const input = createProjectSchema.parse(await readBoundedJson(request, MAX_BODY_BYTES));
    const project = await createProject(getDatabase(), user.id, {
      name: input.name,
      targetDomain: input.targetDomain,
      defaultCountryCode: input.countryCode,
      defaultLanguageCode: input.languageCode,
    });
    return noStore(Response.json({ project: toProjectDto(project) }, { status: 201 }));
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

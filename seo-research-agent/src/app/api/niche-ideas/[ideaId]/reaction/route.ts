import { nicheIdeaIdSchema, nicheIdeaReactionSchema } from "@/features/research/schemas";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { setNicheIdeaReaction } from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readBoundedJson, readRequestId } from "@/server/http/request";
import { isSameOriginMutation } from "@/server/security/request";

type RouteContext = { params: Promise<{ ideaId: string }> };

/** Marks a daily idea as a favorite or dismissed for the signed-in user; null clears it. */
export async function PUT(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    const ideaId = nicheIdeaIdSchema.parse((await context.params).ideaId);
    const { status } = nicheIdeaReactionSchema.parse(await readBoundedJson(request, 1024));
    if (!(await setNicheIdeaReaction(getDatabase(), user.id, ideaId, status))) {
      throw new AppError("Idea not found.", "NOT_FOUND", 404, false);
    }
    return noStore(Response.json({ ideaId, reaction: status }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { listLatestNicheIdeas } from "@/server/db/repositories";
import { errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";

/** The latest day's niche ideas (generated each morning by a background job). */
export async function GET(request: Request) {
  const requestId = readRequestId(request);
  try {
    await requireActiveUser();
    const { date, ideas } = await listLatestNicheIdeas(getDatabase());
    return noStore(Response.json({
      date,
      ideas: ideas.map((idea) => ({
        id: idea.id,
        niche: idea.niche,
        seedKeyword: idea.seedKeyword,
        problem: idea.problem,
        audience: idea.audience,
      })),
    }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

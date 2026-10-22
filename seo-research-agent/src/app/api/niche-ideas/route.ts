import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { listLatestNicheIdeas } from "@/server/db/repositories";
import { errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";
import { ensureTodaysNicheIdeas } from "@/server/jobs/daily-niches";
import { logger } from "@/server/logging/logger";

/**
 * The latest day's niche ideas. The morning job normally creates them; the
 * first visit of a day creates them too, so nobody waits for tomorrow.
 */
export async function GET(request: Request) {
  const requestId = readRequestId(request);
  try {
    await requireActiveUser();
    try {
      await ensureTodaysNicheIdeas();
    } catch (error) {
      // Yesterday's ideas are still worth showing if today's can't be made.
      logger.warn({ error, requestId }, "Could not generate today's niche ideas");
    }
    const { date, ideas } = await listLatestNicheIdeas(getDatabase());
    return noStore(Response.json({
      date,
      ideas: ideas.map((idea) => ({
        id: idea.id,
        niche: idea.niche,
        seedKeyword: idea.seedKeyword,
        problem: idea.problem,
        audience: idea.audience,
        nicheType: idea.nicheType,
      })),
    }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

import { nicheIdeasQuerySchema } from "@/features/research/schemas";
import type { NicheIdeaDto } from "@/features/research/types";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import {
  listFavoriteNicheIdeas,
  listLatestNicheIdeas,
  listNicheIdeaDates,
  listNicheIdeaReactions,
  listNicheIdeasForDate,
} from "@/server/db/repositories";
import type { NicheIdeaRow } from "@/server/db/schema";
import { errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";
import { ensureTodaysNicheIdeas } from "@/server/jobs/daily-niches";
import { logger } from "@/server/logging/logger";

/**
 * Niche ideas for a day (the latest by default), or the user's favorites.
 * The morning job normally creates each day's ideas; the first visit of a
 * day creates them too, so nobody waits for tomorrow.
 */
export async function GET(request: Request) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const params = new URL(request.url).searchParams;
    const query = nicheIdeasQuerySchema.parse({
      date: params.get("date") ?? undefined,
      view: params.get("view") ?? undefined,
    });
    const database = getDatabase();

    let date: string | null = null;
    let ideas: NicheIdeaRow[];
    if (query.view === "favorites") {
      ideas = await listFavoriteNicheIdeas(database, user.id);
    } else if (query.date) {
      date = query.date;
      ideas = await listNicheIdeasForDate(database, query.date);
    } else {
      try {
        await ensureTodaysNicheIdeas();
      } catch (error) {
        // Yesterday's ideas are still worth showing if today's can't be made.
        logger.warn({ error, requestId }, "Could not generate today's niche ideas");
      }
      ({ date, ideas } = await listLatestNicheIdeas(database));
    }

    const [dates, reactions] = await Promise.all([
      listNicheIdeaDates(database),
      listNicheIdeaReactions(database, user.id, ideas.map((idea) => idea.id)),
    ]);
    return noStore(Response.json({
      date,
      dates,
      ideas: ideas.map((idea): NicheIdeaDto => ({
        id: idea.id,
        niche: idea.niche,
        seedKeyword: idea.seedKeyword,
        problem: idea.problem,
        audience: idea.audience,
        nicheType: idea.nicheType,
        countryCode: idea.countryCode,
        searchVolume: idea.searchVolume,
        difficulty: idea.difficulty,
        lowAuthorityCount: idea.lowAuthorityCount,
        ideaDate: idea.ideaDate,
        reaction: reactions.get(idea.id) ?? null,
      })),
    }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

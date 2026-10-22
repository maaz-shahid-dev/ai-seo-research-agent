import "server-only";

import { and, desc, eq, gte, inArray, max, sql } from "drizzle-orm";

import type { NicheType } from "@/features/research/niche-types";

import type { DatabaseClient } from "../client";
import { nicheIdeaReactions, nicheIdeas, type NicheIdeaReactionStatus } from "../schema";

export type NicheIdeaInput = {
  niche: string;
  seedKeyword: string;
  problem: string;
  audience: string;
  nicheType: NicheType;
  countryCode: string;
  searchVolume: number | null;
  difficulty: number | null;
  lowAuthorityCount: number | null;
};

/** Stores a day's ideas; re-running the same day never duplicates a seed. */
export async function insertNicheIdeas(database: DatabaseClient, ideaDate: string, ideas: readonly NicheIdeaInput[]) {
  if (ideas.length === 0) return;
  await database
    .insert(nicheIdeas)
    .values(ideas.map((idea) => ({
      ideaDate,
      niche: idea.niche.trim().slice(0, 120),
      seedKeyword: idea.seedKeyword.trim().toLowerCase().slice(0, 120),
      problem: idea.problem.trim().slice(0, 300),
      audience: idea.audience.trim().slice(0, 160),
      nicheType: idea.nicheType,
      countryCode: idea.countryCode,
      searchVolume: idea.searchVolume,
      difficulty: idea.difficulty,
      lowAuthorityCount: idea.lowAuthorityCount,
    })))
    .onConflictDoNothing();
}

/** The most recent day's ideas (today's once the daily job has run). */
export async function listLatestNicheIdeas(database: DatabaseClient) {
  const [latest] = await database.select({ date: max(nicheIdeas.ideaDate) }).from(nicheIdeas);
  if (!latest?.date) return { date: null, ideas: [] };
  const ideas = await database
    .select()
    .from(nicheIdeas)
    .where(eq(nicheIdeas.ideaDate, latest.date))
    .orderBy(nicheIdeas.createdAt, nicheIdeas.seedKeyword);
  return { date: latest.date, ideas };
}

/** Seeds suggested since a date, so new ideas don't repeat recent ones. */
export async function listRecentNicheSeeds(database: DatabaseClient, sinceDate: string, limit = 200) {
  const rows = await database
    .select({ seedKeyword: nicheIdeas.seedKeyword })
    .from(nicheIdeas)
    .where(gte(nicheIdeas.ideaDate, sinceDate))
    .orderBy(desc(nicheIdeas.ideaDate))
    .limit(limit);
  return rows.map((row) => row.seedKeyword);
}

/** One day's ideas, in the order they were generated. */
export async function listNicheIdeasForDate(database: DatabaseClient, ideaDate: string) {
  return database
    .select()
    .from(nicheIdeas)
    .where(eq(nicheIdeas.ideaDate, ideaDate))
    .orderBy(nicheIdeas.createdAt, nicheIdeas.seedKeyword);
}

/** Days that have ideas, newest first. */
export async function listNicheIdeaDates(database: DatabaseClient, limit = 30) {
  const rows = await database
    .selectDistinct({ date: nicheIdeas.ideaDate })
    .from(nicheIdeas)
    .orderBy(desc(nicheIdeas.ideaDate))
    .limit(Math.min(Math.max(limit, 1), 90));
  return rows.map((row) => row.date);
}

/** The user's favorite/dismissed status for these ideas. */
export async function listNicheIdeaReactions(database: DatabaseClient, ownerId: string, ideaIds: readonly string[]) {
  if (ideaIds.length === 0) return new Map<string, NicheIdeaReactionStatus>();
  const rows = await database
    .select({ ideaId: nicheIdeaReactions.ideaId, status: nicheIdeaReactions.status })
    .from(nicheIdeaReactions)
    .where(and(eq(nicheIdeaReactions.ownerId, ownerId), inArray(nicheIdeaReactions.ideaId, [...ideaIds])));
  return new Map(rows.map((row) => [row.ideaId, row.status]));
}

/** The user's favorite ideas from any day, most recently starred first. */
export async function listFavoriteNicheIdeas(database: DatabaseClient, ownerId: string, limit = 100) {
  const rows = await database
    .select({ idea: nicheIdeas })
    .from(nicheIdeaReactions)
    .innerJoin(nicheIdeas, eq(nicheIdeas.id, nicheIdeaReactions.ideaId))
    .where(and(eq(nicheIdeaReactions.ownerId, ownerId), eq(nicheIdeaReactions.status, "favorite")))
    .orderBy(desc(nicheIdeaReactions.updatedAt))
    .limit(Math.min(Math.max(limit, 1), 200));
  return rows.map((row) => row.idea);
}

/**
 * Sets or clears the user's status for an idea. Returns false when the idea
 * doesn't exist, so callers can answer 404.
 */
export async function setNicheIdeaReaction(
  database: DatabaseClient,
  ownerId: string,
  ideaId: string,
  status: NicheIdeaReactionStatus | null,
) {
  if (status === null) {
    await database
      .delete(nicheIdeaReactions)
      .where(and(eq(nicheIdeaReactions.ownerId, ownerId), eq(nicheIdeaReactions.ideaId, ideaId)));
    const [idea] = await database.select({ id: nicheIdeas.id }).from(nicheIdeas).where(eq(nicheIdeas.id, ideaId)).limit(1);
    return idea !== undefined;
  }
  // Insert only when the idea exists, in one statement, so a deleted idea can't be referenced.
  const saved = await database
    .insert(nicheIdeaReactions)
    .select(
      database
        .select({ ownerId: sql<string>`${ownerId}::uuid`.as("owner_id"), ideaId: nicheIdeas.id, status: sql<NicheIdeaReactionStatus>`${status}`.as("status"), updatedAt: sql<Date>`now()`.as("updated_at") })
        .from(nicheIdeas)
        .where(eq(nicheIdeas.id, ideaId)),
    )
    .onConflictDoUpdate({
      target: [nicheIdeaReactions.ownerId, nicheIdeaReactions.ideaId],
      set: { status, updatedAt: sql`now()` },
    })
    .returning({ ideaId: nicheIdeaReactions.ideaId });
  return saved.length > 0;
}

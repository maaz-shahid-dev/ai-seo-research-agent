import "server-only";

import { desc, eq, gte, max } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { nicheIdeas } from "../schema";

export type NicheIdeaInput = { niche: string; seedKeyword: string; problem: string; audience: string };

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

import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/server/db/client";
import {
  insertNicheIdeas,
  listFavoriteNicheIdeas,
  listNicheIdeaDates,
  listNicheIdeaReactions,
  listNicheIdeasForDate,
  setNicheIdeaReaction,
} from "@/server/db/repositories";
import * as schema from "@/server/db/schema";
import { createTestDatabase, PGLITE_SETUP_TIMEOUT_MS } from "../helpers/pglite";

const OWNER = "10000000-0000-4000-8000-0000000000c1";
const OTHER = "10000000-0000-4000-8000-0000000000c2";
const MISSING = "60000000-0000-4000-8000-000000000099";

const idea = (seedKeyword: string) => ({
  niche: seedKeyword, seedKeyword, problem: "p", audience: "a", nicheType: "info" as const, countryCode: "US",
  searchVolume: 100, difficulty: 10, lowAuthorityCount: 3,
});

describe("niche idea reactions and history", () => {
  let client: PGlite;
  let database: PgliteDatabase<typeof schema>;
  let repo: DatabaseClient;

  beforeAll(async () => {
    ({ client, database, repositoryDatabase: repo } = await createTestDatabase());
    await database.insert(schema.users).values([
      { id: OWNER, email: "ideas@example.test", displayName: "I", passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$a$b" },
      { id: OTHER, email: "other-ideas@example.test", displayName: "O", passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$a$b" },
    ]);
    await insertNicheIdeas(repo, "2026-10-20", [idea("betta tank setup"), idea("sourdough starter rescue")]);
    await insertNicheIdeas(repo, "2026-10-21", [idea("cast iron rust removal")]);
  }, PGLITE_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await client.close();
  });

  it("lists days newest first and a day's ideas", async () => {
    expect(await listNicheIdeaDates(repo)).toEqual(["2026-10-21", "2026-10-20"]);
    expect((await listNicheIdeasForDate(repo, "2026-10-20")).map((row) => row.seedKeyword).sort()).toEqual(["betta tank setup", "sourdough starter rescue"]);
    expect(await listNicheIdeasForDate(repo, "2026-01-01")).toEqual([]);
  });

  it("saves, changes and clears a reaction per user", async () => {
    const [betta, sourdough] = await listNicheIdeasForDate(repo, "2026-10-20");
    expect(await setNicheIdeaReaction(repo, OWNER, betta!.id, "favorite")).toBe(true);
    expect(await setNicheIdeaReaction(repo, OWNER, sourdough!.id, "dismissed")).toBe(true);
    expect(await setNicheIdeaReaction(repo, OTHER, betta!.id, "dismissed")).toBe(true);

    const mine = await listNicheIdeaReactions(repo, OWNER, [betta!.id, sourdough!.id]);
    expect(Object.fromEntries(mine)).toEqual({ [betta!.id]: "favorite", [sourdough!.id]: "dismissed" });
    expect((await listFavoriteNicheIdeas(repo, OWNER)).map((row) => row.id)).toEqual([betta!.id]);
    expect(await listFavoriteNicheIdeas(repo, OTHER)).toEqual([]);

    expect(await setNicheIdeaReaction(repo, OWNER, sourdough!.id, "favorite")).toBe(true);
    expect((await listFavoriteNicheIdeas(repo, OWNER)).map((row) => row.id)).toEqual([sourdough!.id, betta!.id]);

    expect(await setNicheIdeaReaction(repo, OWNER, betta!.id, null)).toBe(true);
    expect((await listNicheIdeaReactions(repo, OWNER, [betta!.id])).size).toBe(0);
    expect((await listNicheIdeaReactions(repo, OTHER, [betta!.id])).get(betta!.id)).toBe("dismissed");
  });

  it("refuses reactions to ideas that don't exist", async () => {
    expect(await setNicheIdeaReaction(repo, OWNER, MISSING, "favorite")).toBe(false);
    expect(await setNicheIdeaReaction(repo, OWNER, MISSING, null)).toBe(false);
    expect((await listNicheIdeaReactions(repo, OWNER, [MISSING])).size).toBe(0);
  });
});

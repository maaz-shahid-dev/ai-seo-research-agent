import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/server/db/client";
import {
  deleteResearchRun,
  listKeywordResultsByIds,
  listResearchRuns,
  requestContentGap,
  requestSerpAnalyses,
  saveAllintitleCounts,
} from "@/server/db/repositories";
import * as schema from "@/server/db/schema";
import { createTestDatabase, PGLITE_SETUP_TIMEOUT_MS } from "../helpers/pglite";

const OWNER = "10000000-0000-4000-8000-0000000000b1";
const OTHER = "10000000-0000-4000-8000-0000000000b2";

describe("research history", () => {
  let client: PGlite;
  let database: PgliteDatabase<typeof schema>;
  let repo: DatabaseClient;
  let projectId: string;

  beforeAll(async () => {
    ({ client, database, repositoryDatabase: repo } = await createTestDatabase());
    await database.insert(schema.users).values([
      { id: OWNER, email: "history@example.test", displayName: "H", passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$a$b" },
      { id: OTHER, email: "other-history@example.test", displayName: "O", passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$a$b" },
    ]);
    const [project] = await database.insert(schema.projects).values({ ownerId: OWNER, name: "History" }).returning();
    projectId = project!.id;
  }, PGLITE_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await client.close();
  });

  async function seedRun(query: string, minutesAgo: number) {
    const created = new Date(Date.now() - minutesAgo * 60_000);
    const [run] = await database.insert(schema.researchRuns).values({
      ownerId: OWNER, projectId, idempotencyKey: `history-${query.replace(/[^a-z0-9]/gi, "-")}-${minutesAgo}`.slice(0, 120),
      requestHash: "b".repeat(64), query, countryCode: "US", languageCode: "en", configuration: { keywordLimit: 100 },
      status: "completed", progress: 100, createdAt: created, startedAt: created, finishedAt: created, updatedAt: created,
    }).returning();
    return run!;
  }

  it("searches literally and paginates newest first", async () => {
    await seedRun("running shoes", 30);
    await seedRun("trail running shoes", 20);
    await seedRun("100% cotton shirts", 10);
    await seedRun("snake_case guide", 5);

    const percent = await listResearchRuns(repo, OWNER, { projectId, search: "100%" });
    expect(percent.items.map((run) => run.query)).toEqual(["100% cotton shirts"]);
    const underscore = await listResearchRuns(repo, OWNER, { projectId, search: "_" });
    expect(underscore.items.map((run) => run.query)).toEqual(["snake_case guide"]);
    const running = await listResearchRuns(repo, OWNER, { projectId, search: "RUNNING" });
    expect(running.items.map((run) => run.query)).toEqual(["trail running shoes", "running shoes"]);

    const first = await listResearchRuns(repo, OWNER, { projectId, limit: 2 });
    expect(first.items.map((run) => run.query)).toEqual(["snake_case guide", "100% cotton shirts"]);
    const second = await listResearchRuns(repo, OWNER, { projectId, limit: 2, cursor: first.nextCursor! });
    expect(second.items.map((run) => run.query)).toEqual(["trail running shoes", "running shoes"]);
    expect(second.nextCursor).toBeNull();
  });

  it("reads and stores allintitle counts only within the owner's run", async () => {
    const run = await seedRun("kgr topic", 2);
    const other = await seedRun("other topic", 3);
    const rows = await database.insert(schema.keywordResults).values(["kgr topic tips", "kgr topic guide"].map((keyword) => ({
      ownerId: OWNER, runId: run.id, keyword, normalizedKeyword: keyword, source: "related" as const, provider: "dataforseo",
      retrievedAt: new Date(), countryCode: "US", languageCode: "en", searchVolume: 90,
    }))).returning();
    const [elsewhere] = await database.insert(schema.keywordResults).values({
      ownerId: OWNER, runId: other.id, keyword: "other", normalizedKeyword: "other", source: "seed", provider: "dataforseo",
      retrievedAt: new Date(), countryCode: "US", languageCode: "en",
    }).returning();
    const ids = [rows[0]!.id, rows[1]!.id, elsewhere!.id];

    expect((await listKeywordResultsByIds(repo, OWNER, run.id, ids)).map((row) => row.id)).toEqual([rows[0]!.id, rows[1]!.id]);
    expect(await listKeywordResultsByIds(repo, OTHER, run.id, ids)).toEqual([]);
    expect(await listKeywordResultsByIds(repo, OWNER, run.id, [])).toEqual([]);

    await saveAllintitleCounts(repo, OTHER, run.id, [{ keywordResultId: rows[0]!.id, allintitleCount: 999 }]);
    await saveAllintitleCounts(repo, OWNER, run.id, [{ keywordResultId: rows[0]!.id, allintitleCount: 12 }, { keywordResultId: elsewhere!.id, allintitleCount: 5 }]);
    const stored = await listKeywordResultsByIds(repo, OWNER, run.id, ids);
    expect(stored.map((row) => row.allintitleCount)).toEqual([12, null]);
    expect(stored[0]!.allintitleCheckedAt).toBeInstanceOf(Date);
    const [untouched] = await database.select().from(schema.keywordResults).where(eq(schema.keywordResults.id, elsewhere!.id));
    expect(untouched!.allintitleCount).toBeNull();
  });

  it("deletes a run with everything collected for it, only for its owner", async () => {
    const run = await seedRun("delete me", 1);
    const [keyword] = await database.insert(schema.keywordResults).values({
      ownerId: OWNER, runId: run.id, keyword: "delete me", normalizedKeyword: "delete me", source: "seed", provider: "dataforseo",
      retrievedAt: new Date(), countryCode: "US", languageCode: "en",
    }).returning();
    await requestSerpAnalyses(repo, OWNER, run.id, [keyword!.id]);
    await requestContentGap(repo, OWNER, run.id, "mysite.com");

    expect(await deleteResearchRun(repo, OTHER, run.id)).toBe(false);
    expect(await deleteResearchRun(repo, OWNER, run.id)).toBe(true);
    expect(await deleteResearchRun(repo, OWNER, run.id)).toBe(false);

    expect(await database.select().from(schema.keywordResults).where(eq(schema.keywordResults.runId, run.id))).toHaveLength(0);
    expect(await database.select().from(schema.serpAnalyses).where(eq(schema.serpAnalyses.runId, run.id))).toHaveLength(0);
    expect(await database.select().from(schema.contentGapReports).where(eq(schema.contentGapReports.runId, run.id))).toHaveLength(0);
  });
});

import type { PGlite } from "@electric-sql/pglite";
import { eq } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/server/db/client";
import {
  claimContentGap,
  claimSerpAnalysis,
  completeContentGap,
  completeSerpAnalysis,
  failContentGap,
  failSerpAnalysis,
  findStaleDomains,
  getContentGap,
  getDomainMetrics,
  getSerpAnalysisForKeyword,
  listNicheScores,
  listRunSerpDomains,
  listSerpResults,
  requestContentGap,
  requestSerpAnalyses,
  requestTopSerpAnalyses,
  upsertDomainMetrics,
} from "@/server/db/repositories";
import * as schema from "@/server/db/schema";
import { createTestDatabase, PGLITE_SETUP_TIMEOUT_MS } from "../helpers/pglite";

const OWNER = "10000000-0000-4000-8000-0000000000a1";
const OTHER_OWNER = "10000000-0000-4000-8000-0000000000a2";
const WORKER = "worker-1";

describe("Niche Hunter repositories", () => {
  let client: PGlite;
  let database: PgliteDatabase<typeof schema>;
  let repo: DatabaseClient;
  let runId: string;
  let otherRunId: string;
  const keywordIds: number[] = [];

  beforeAll(async () => {
    ({ client, database, repositoryDatabase: repo } = await createTestDatabase());
    await database.insert(schema.users).values([
      { id: OWNER, email: "owner@example.test", displayName: "Owner", passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$a$b" },
      { id: OTHER_OWNER, email: "other@example.test", displayName: "Other", passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$a$b" },
    ]);
    runId = await seedRun(OWNER, "running shoes");
    otherRunId = await seedRun(OTHER_OWNER, "other");
    const volumes: Array<[string, number, number]> = [
      ["running shoes", 246_000, 78],
      ["running shoes for beginners", 14_800, 29],
      ["how to choose running shoes", 9_900, 22],
    ];
    for (const [keyword, searchVolume, difficulty] of volumes) {
      const [row] = await database.insert(schema.keywordResults).values({
        ownerId: OWNER, runId, keyword, normalizedKeyword: keyword, source: "related", provider: "dataforseo",
        retrievedAt: new Date(), countryCode: "US", languageCode: "en", searchVolume, difficulty,
      }).returning();
      keywordIds.push(row!.id);
    }
  }, PGLITE_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await client.close();
  });

  async function seedRun(ownerId: string, query: string) {
    const [project] = await database.insert(schema.projects).values({ ownerId, name: `${query} project` }).returning();
    const [run] = await database.insert(schema.researchRuns).values({
      ownerId, projectId: project!.id, idempotencyKey: `seed-${ownerId}-${query}`.replace(/[^A-Za-z0-9-]/g, "-").slice(0, 120),
      requestHash: "a".repeat(64), query, countryCode: "US", languageCode: "en", configuration: { keywordLimit: 100 },
      status: "completed", progress: 100,
      createdAt: new Date(Date.now() - 60_000), startedAt: new Date(Date.now() - 30_000), finishedAt: new Date(),
    }).returning();
    return run!.id;
  }

  async function outboxCount(eventType: string) {
    const rows = await database.select().from(schema.jobOutbox).where(eq(schema.jobOutbox.eventType, eventType));
    return rows.length;
  }

  describe("SERP analyses", () => {
    it("queues the best opportunities with one dispatch event each, idempotently", async () => {
      const queued = await requestTopSerpAnalyses(repo, OWNER, runId, 2);
      expect(queued.map((analysis) => analysis.keywordResultId).sort()).toEqual([keywordIds[0], keywordIds[1]].sort());
      expect(queued.every((analysis) => analysis.status === "queued")).toBe(true);

      await requestTopSerpAnalyses(repo, OWNER, runId, 2);
      expect(await outboxCount("serp.requested")).toBe(2);
    });

    it("ignores keywords from another tenant's run", async () => {
      await requestSerpAnalyses(repo, OTHER_OWNER, otherRunId, [keywordIds[2]!]);
      expect(await getSerpAnalysisForKeyword(repo, OTHER_OWNER, otherRunId, keywordIds[2]!)).toBeNull();
    });

    it("completes with a snapshot and results only while the lease is held", async () => {
      const analysis = (await getSerpAnalysisForKeyword(repo, OWNER, runId, keywordIds[1]!))!;
      const claimed = (await claimSerpAnalysis(repo, OWNER, analysis.id, WORKER))!;
      expect(await claimSerpAnalysis(repo, OWNER, analysis.id, "worker-2")).toBeNull();

      const input = {
        keyword: "running shoes for beginners", countryCode: "US", languageCode: "en", device: "desktop" as const,
        providerRequestId: "task-1", nicheScore: 64, hasAiOverview: true,
        results: [
          { rank: 1, title: "Reddit thread", url: "https://www.reddit.com/r/running/1", domain: "www.reddit.com", description: null },
          { rank: 2, title: "Small blog", url: "https://tinyblog.com/", domain: "tinyblog.com", description: "Guide" },
        ],
      };
      expect(await completeSerpAnalysis(repo, { ...claimed, version: claimed.version + 5 }, WORKER, input)).toBeNull();
      const completed = (await completeSerpAnalysis(repo, claimed, WORKER, input))!;

      expect(completed).toMatchObject({ status: "completed", nicheScore: 64, hasAiOverview: true, leaseOwner: null });
      const results = await listSerpResults(repo, OWNER, completed.snapshotId!);
      expect(results.map((result) => [result.rank, result.domain])).toEqual([[1, "www.reddit.com"], [2, "tinyblog.com"]]);
      expect(await listNicheScores(repo, OWNER, runId)).toEqual(new Map([[keywordIds[1], 64]]));
      expect((await listRunSerpDomains(repo, OWNER, runId)).map((row) => row.domain).sort()).toEqual(["tinyblog.com", "www.reddit.com"]);
      expect(await listSerpResults(repo, OTHER_OWNER, completed.snapshotId!)).toEqual([]);
    });

    it("re-queues failed analyses under a new event, but not completed ones", async () => {
      const analysis = (await getSerpAnalysisForKeyword(repo, OWNER, runId, keywordIds[0]!))!;
      const claimed = (await claimSerpAnalysis(repo, OWNER, analysis.id, WORKER))!;
      await failSerpAnalysis(repo, claimed, WORKER, "PROVIDER_ERROR", "SERP data is unavailable.");
      const before = await outboxCount("serp.requested");

      await requestSerpAnalyses(repo, OWNER, runId, [keywordIds[0]!, keywordIds[1]!]);

      expect((await getSerpAnalysisForKeyword(repo, OWNER, runId, keywordIds[0]!))!.status).toBe("queued");
      expect((await getSerpAnalysisForKeyword(repo, OWNER, runId, keywordIds[1]!))!.status).toBe("completed");
      expect(await outboxCount("serp.requested")).toBe(before + 1);
    });
  });

  describe("domain metrics cache", () => {
    it("upserts metrics, clamps bad values and reports stale domains", async () => {
      const now = new Date("2026-10-22T00:00:00.000Z");
      await upsertDomainMetrics(repo, [
        { domain: "Reddit.com", authority: 140, backlinks: 5, referringDomains: 2, monthlyTraffic: -3, registeredAt: "2005-04-29T00:00:00.000Z" },
      ], now);
      await upsertDomainMetrics(repo, [
        { domain: "reddit.com", authority: 91, backlinks: 10, referringDomains: 4, monthlyTraffic: 900, registeredAt: null },
      ], now);

      const [row] = await getDomainMetrics(repo, ["reddit.com"]);
      expect(row).toMatchObject({ domain: "reddit.com", authority: 91, backlinks: 10, monthlyTraffic: 900 });
      expect(await findStaleDomains(repo, ["reddit.com", "new.com"], now)).toEqual(["new.com"]);
      expect(await findStaleDomains(repo, ["reddit.com"], new Date("2026-12-01T00:00:00.000Z"))).toEqual(["reddit.com"]);
    });
  });

  describe("content gap reports", () => {
    it("queues one report per run and domain, completes it, and re-queues after failure", async () => {
      const report = (await requestContentGap(repo, OWNER, runId, " MyBlog.com "))!;
      expect(report).toMatchObject({ status: "queued", targetDomain: "myblog.com" });
      await requestContentGap(repo, OWNER, runId, "myblog.com");
      expect(await outboxCount("content-gap.requested")).toBe(1);

      const claimed = (await claimContentGap(repo, OWNER, report.id, WORKER))!;
      const completed = (await completeContentGap(repo, claimed, WORKER, {
        competitors: ["runrepeat.com"],
        keywords: [{ keyword: "wide feet shoes", searchVolume: 100, difficulty: 20, cpcMicros: 1_000_000, competitorDomain: "runrepeat.com", competitorRank: 2 }],
      }))!;
      expect(completed).toMatchObject({ status: "completed", competitors: ["runrepeat.com"] });

      const other = (await requestContentGap(repo, OWNER, runId, "second.com"))!;
      const claimedOther = (await claimContentGap(repo, OWNER, other.id, WORKER))!;
      await failContentGap(repo, claimedOther, WORKER, "PROVIDER_ERROR", "Try again.");
      expect((await requestContentGap(repo, OWNER, runId, "second.com"))!.status).toBe("queued");
      expect(await outboxCount("content-gap.requested")).toBe(3);
    });

    it("refuses reports for another tenant's run", async () => {
      expect(await requestContentGap(repo, OTHER_OWNER, runId, "x.com")).toBeNull();
      expect(await getContentGap(repo, OTHER_OWNER, runId, "x.com")).toBeNull();
    });
  });
});

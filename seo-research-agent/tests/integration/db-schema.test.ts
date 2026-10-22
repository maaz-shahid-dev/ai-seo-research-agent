import type { PGlite } from "@electric-sql/pglite";
import { and, eq } from "drizzle-orm";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, test } from "vitest";

import type { DatabaseClient } from "@/server/db/client";
import {
  aiAnalyses,
  aiCitations,
  jobOutbox,
  keywordResults,
  passwordResetTokens,
  projects,
  providerRequests,
  researchRuns,
  users,
} from "@/server/db/schema";
import {
  createProject,
  createResearchRun,
  claimAiAnalysis,
  claimOutboxEvents,
  claimResearchRun,
  finishResearchRun,
  getProjectById,
  getAiAnalysisById,
  IdempotencyConflictError,
  completeAiAnalysis,
  insertKeywordResults,
  listKeywordResults,
  listProjects,
  markOutboxEventPublished,
  purgeProject,
  queueAiAnalysis,
  updateResearchRunProgress,
  updateProject,
} from "@/server/db/repositories";
import * as schema from "@/server/db/schema";
import { createTestDatabase, PGLITE_SETUP_TIMEOUT_MS } from "../helpers/pglite";

const OWNER_ONE_ID = "10000000-0000-4000-8000-000000000001";
const OWNER_TWO_ID = "10000000-0000-4000-8000-000000000002";
const PASSWORD_HASH = "$argon2id$v=19$m=65536,t=3,p=1$fixture$fixturefixturefixture";
const HASH_A = "a".repeat(64);

describe("PostgreSQL schema and tenant repositories", () => {
  let client: PGlite;
  let database: PgliteDatabase<typeof schema>;
  let repositoryDatabase: DatabaseClient;

  beforeAll(async () => {
    ({ client, database, repositoryDatabase } = await createTestDatabase());

    await database.insert(users).values([
      {
        id: OWNER_ONE_ID,
        email: "owner-one@example.test",
        displayName: "Owner One",
        passwordHash: PASSWORD_HASH,
      },
      {
        id: OWNER_TWO_ID,
        email: "owner-two@example.test",
        displayName: "Owner Two",
        passwordHash: PASSWORD_HASH,
      },
    ]);
  }, PGLITE_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await client.close();
  });

  test("applies every migration and creates scale-critical indexes", async () => {
    const tables = await client.query<{ table_name: string }>(
      `select table_name
         from information_schema.tables
        where table_schema = 'public' and table_type = 'BASE TABLE'`,
    );
    expect(tables.rows).toHaveLength(19);

    const indexes = await client.query<{ indexname: string }>(
      `select indexname from pg_indexes where schemaname = 'public'`,
    );
    const names = new Set(indexes.rows.map(({ indexname }) => indexname));
    expect(names.has("research_runs_owner_idempotency_unique")).toBe(true);
    expect(names.has("keyword_results_owner_run_id_idx")).toBe(true);
    expect(names.has("provider_requests_retry_idx")).toBe(true);
    expect(names.has("job_outbox_dispatch_idx")).toBe(true);
    expect(names.has("job_outbox_stale_lease_idx")).toBe(true);
    expect(names.has("serp_snapshots_keyword_run_owner_idx")).toBe(true);
    expect(names.has("saved_reports_run_project_owner_idx")).toBe(true);
    expect(names.has("serp_analyses_owner_keyword_unique")).toBe(true);
    expect(names.has("serp_analyses_status_lease_idx")).toBe(true);
    expect(names.has("content_gap_reports_owner_run_domain_unique")).toBe(true);
    expect(names.has("domain_metrics_expiry_idx")).toBe(true);
    expect(names.has("niche_ideas_date_seed_unique")).toBe(true);
  });

  test("enforces normalized identities, reset-token safety, and session revocation bounds", async () => {
    await expect(
      database.insert(users).values({
        email: "MixedCase@example.test",
        displayName: "Mixed Case",
        passwordHash: PASSWORD_HASH,
      }),
    ).rejects.toThrow();

    await expect(
      database
        .update(users)
        .set({ sessionVersion: -1 })
        .where(eq(users.id, OWNER_ONE_ID)),
    ).rejects.toThrow();

    await expect(
      database.insert(passwordResetTokens).values({
        userId: OWNER_ONE_ID,
        tokenHash: "short",
        expiresAt: new Date(Date.now() + 60_000),
      }),
    ).rejects.toThrow();

    await expect(
      database.insert(passwordResetTokens).values({
        userId: OWNER_ONE_ID,
        tokenHash: "c".repeat(64),
        expiresAt: new Date("2000-01-01T00:00:00.000Z"),
      }),
    ).rejects.toThrow();
  });

  test("keeps project reads and mutations tenant-scoped with optimistic concurrency", async () => {
    const project = await createProject(repositoryDatabase, OWNER_ONE_ID, {
      name: "Tenant Project",
      defaultCountryCode: "us",
      defaultLanguageCode: "en",
    });

    await expect(
      createProject(repositoryDatabase, OWNER_ONE_ID, {
        name: " tenant project ",
        defaultCountryCode: "US",
        defaultLanguageCode: "en",
      }),
    ).rejects.toThrow();

    expect(await getProjectById(repositoryDatabase, OWNER_TWO_ID, project.id)).toBeNull();
    const otherOwnerProjects = await listProjects(repositoryDatabase, OWNER_TWO_ID);
    expect(otherOwnerProjects.items.some(({ id }) => id === project.id)).toBe(false);

    expect(
      await updateProject(repositoryDatabase, OWNER_TWO_ID, project.id, project.version, {
        name: "Stolen",
      }),
    ).toBeNull();
    const updated = await updateProject(repositoryDatabase, OWNER_ONE_ID, project.id, project.version, {
      name: "Updated Tenant Project",
      targetDomain: "example.com",
    });
    expect(updated).toMatchObject({ name: "Updated Tenant Project", version: 2 });
    expect(
      await updateProject(repositoryDatabase, OWNER_ONE_ID, project.id, project.version, {
        name: "Stale Update",
      }),
    ).toBeNull();
    expect(await purgeProject(repositoryDatabase, OWNER_TWO_ID, project.id)).toBe(false);
  });

  test("enforces project ownership and owner-scoped run idempotency", async () => {
    const ownerOneProject = await createProject(repositoryDatabase, OWNER_ONE_ID, {
      name: "Run Project One",
      defaultCountryCode: "US",
      defaultLanguageCode: "en",
    });
    const ownerTwoProject = await createProject(repositoryDatabase, OWNER_TWO_ID, {
      name: "Run Project Two",
      defaultCountryCode: "US",
      defaultLanguageCode: "en",
    });

    await expect(
      database.insert(researchRuns).values({
        ownerId: OWNER_TWO_ID,
        projectId: ownerOneProject.id,
        idempotencyKey: "cross-tenant-run-0001",
        requestHash: HASH_A,
        query: "forbidden",
        countryCode: "US",
        languageCode: "en",
        configuration: { keywordLimit: 100 },
      }),
    ).rejects.toThrow();

    const input = {
      projectId: ownerOneProject.id,
      idempotencyKey: "same-request-key-0001",
      query: "seo tools",
      countryCode: "US",
      languageCode: "en",
      keywordLimit: 100,
    } as const;
    const first = await createResearchRun(repositoryDatabase, OWNER_ONE_ID, input);
    // Regression: a single submission must already have its dispatch event.
    const afterFirst = await database
      .select()
      .from(jobOutbox)
      .where(and(eq(jobOutbox.ownerId, OWNER_ONE_ID), eq(jobOutbox.idempotencyKey, input.idempotencyKey)));
    expect(afterFirst).toHaveLength(1);
    const replay = await createResearchRun(repositoryDatabase, OWNER_ONE_ID, input);
    expect(replay.id).toBe(first.id);
    const events = await database
      .select()
      .from(jobOutbox)
      .where(
        and(
          eq(jobOutbox.ownerId, OWNER_ONE_ID),
          eq(jobOutbox.idempotencyKey, input.idempotencyKey),
        ),
      );
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({ aggregateId: first.id, eventType: "research.requested" });

    await expect(
      createResearchRun(repositoryDatabase, OWNER_ONE_ID, { ...input, query: "different request" }),
    ).rejects.toBeInstanceOf(IdempotencyConflictError);

    const otherOwnerRun = await createResearchRun(repositoryDatabase, OWNER_TWO_ID, {
      ...input,
      projectId: ownerTwoProject.id,
    });
    expect(otherOwnerRun.ownerId).toBe(OWNER_TWO_ID);
  });

  test("claims runs once and keeps progress monotonic with versioned updates", async () => {
    const project = await createProject(repositoryDatabase, OWNER_ONE_ID, {
      name: "Leased Run Project",
      defaultCountryCode: "US",
      defaultLanguageCode: "en",
    });
    const run = await createResearchRun(repositoryDatabase, OWNER_ONE_ID, {
      projectId: project.id,
      idempotencyKey: "leased-run-request-0001",
      query: "technical seo",
      countryCode: "US",
      languageCode: "en",
      keywordLimit: 50,
    });

    const claimed = await claimResearchRun(
      repositoryDatabase,
      OWNER_ONE_ID,
      run.id,
      "worker-one",
    );
    expect(claimed).toMatchObject({ status: "running", progress: 1, version: 2 });
    expect(
      await claimResearchRun(repositoryDatabase, OWNER_ONE_ID, run.id, "worker-two"),
    ).toBeNull();

    const highProgress = await updateResearchRunProgress(
      repositoryDatabase,
      OWNER_ONE_ID,
      run.id,
      claimed!.version,
      "worker-one",
      80,
    );
    expect(highProgress).toMatchObject({ progress: 80, version: 3 });
    const lowerProgress = await updateResearchRunProgress(
      repositoryDatabase,
      OWNER_ONE_ID,
      run.id,
      highProgress!.version,
      "worker-one",
      20,
    );
    expect(lowerProgress).toMatchObject({ progress: 80, version: 4 });
    expect(
      await updateResearchRunProgress(
        repositoryDatabase,
        OWNER_ONE_ID,
        run.id,
        highProgress!.version,
        "worker-one",
        90,
      ),
    ).toBeNull();

    const completed = await finishResearchRun(
      repositoryDatabase,
      OWNER_ONE_ID,
      run.id,
      lowerProgress!.version,
      "worker-one",
      { status: "completed", keywordCount: 0 },
    );
    expect(completed).toMatchObject({ status: "completed", progress: 100, version: 5 });
    expect(
      await finishResearchRun(
        repositoryDatabase,
        OWNER_ONE_ID,
        run.id,
        completed!.version,
        "worker-one",
        { status: "completed", keywordCount: 0 },
      ),
    ).toBeNull();
  });

  test("bulk inserts keywords idempotently and never reads another tenant's rows", async () => {
    const [project] = await database
      .select()
      .from(projects)
      .where(and(eq(projects.ownerId, OWNER_ONE_ID), eq(projects.name, "Run Project One")))
      .limit(1);
    expect(project).toBeDefined();
    const [run] = await database
      .select()
      .from(researchRuns)
      .where(and(eq(researchRuns.ownerId, OWNER_ONE_ID), eq(researchRuns.projectId, project!.id)))
      .limit(1);
    expect(run).toBeDefined();

    const result = await insertKeywordResults(repositoryDatabase, OWNER_ONE_ID, run!.id, [
      {
        keyword: "  Best   SEO Tools ",
        source: "seed",
        provider: "dataforseo",
        providerRequestId: "provider-request-1",
        retrievedAt: new Date(),
        countryCode: "us",
        languageCode: "en",
        searchVolume: 1_000,
        cpcMicros: 2_750_000,
        competition: 0.45,
        difficulty: 61,
      },
      {
        keyword: "best seo tools",
        source: "related",
        provider: "dataforseo",
        retrievedAt: new Date(),
        countryCode: "US",
        languageCode: "en",
      },
    ]);
    expect(result).toEqual({ insertedCount: 1, duplicateCount: 1 });

    const ownRows = await listKeywordResults(repositoryDatabase, OWNER_ONE_ID, run!.id);
    expect(ownRows.items).toHaveLength(1);
    expect(ownRows.items[0]).toMatchObject({
      normalizedKeyword: "best seo tools",
      cpcMicros: 2_750_000,
      provider: "dataforseo",
    });
    const otherRows = await listKeywordResults(repositoryDatabase, OWNER_TWO_ID, run!.id);
    expect(otherRows.items).toHaveLength(0);

    await expect(
      database.insert(keywordResults).values({
        ownerId: OWNER_TWO_ID,
        runId: run!.id,
        keyword: "cross tenant",
        normalizedKeyword: "cross tenant",
        source: "seed",
        provider: "dataforseo",
        retrievedAt: new Date(),
        countryCode: "US",
        languageCode: "en",
      }),
    ).rejects.toThrow();
  });

  test("requires internal evidence for citations and direct ownership for provider requests", async () => {
    const [run] = await database
      .select()
      .from(researchRuns)
      .where(eq(researchRuns.ownerId, OWNER_ONE_ID))
      .limit(1);
    const [keyword] = await database
      .select()
      .from(keywordResults)
      .where(eq(keywordResults.runId, run!.id))
      .limit(1);
    const [analysis] = await database
      .insert(aiAnalyses)
      .values({
        ownerId: OWNER_ONE_ID,
        runId: run!.id,
        type: "intent",
        provider: "openai",
        model: "test-model",
        promptVersion: "v1",
        inputHash: HASH_A,
      })
      .returning();

    await expect(
      database.insert(aiCitations).values({
        ownerId: OWNER_ONE_ID,
        runId: run!.id,
        analysisId: analysis!.id,
        position: 1,
        url: "https://example.test/source",
      }),
    ).rejects.toThrow();

    const [citation] = await database
      .insert(aiCitations)
      .values({
        ownerId: OWNER_ONE_ID,
        runId: run!.id,
        analysisId: analysis!.id,
        keywordResultId: keyword!.id,
        position: 1,
      })
      .returning();
    expect(citation?.keywordResultId).toBe(keyword!.id);

    await expect(
      database.insert(providerRequests).values({
        ownerId: "10000000-0000-4000-8000-000000000099",
        provider: "openai",
        operation: "analysis",
        idempotencyKey: "orphan-provider-request",
        requestHash: HASH_A,
      }),
    ).rejects.toThrow();
  });

  test("queues, leases, and completes AI analysis without crossing tenant boundaries", async () => {
    const [keyword] = await database
      .select()
      .from(keywordResults)
      .where(eq(keywordResults.ownerId, OWNER_ONE_ID))
      .limit(1);
    expect(keyword).toBeDefined();

    const input = {
      model: "gpt-test",
      inputHash: "b".repeat(64),
    };
    const queued = await queueAiAnalysis(
      repositoryDatabase,
      OWNER_ONE_ID,
      keyword!.runId,
      input,
    );
    const replay = await queueAiAnalysis(
      repositoryDatabase,
      OWNER_ONE_ID,
      keyword!.runId,
      input,
    );
    expect(queued).toMatchObject({ status: "queued", version: 1 });
    expect(replay?.id).toBe(queued?.id);
    expect(
      await getAiAnalysisById(
        repositoryDatabase,
        OWNER_TWO_ID,
        keyword!.runId,
        queued!.id,
      ),
    ).toBeNull();

    const events = await database
      .select()
      .from(jobOutbox)
      .where(
        and(
          eq(jobOutbox.ownerId, OWNER_ONE_ID),
          eq(jobOutbox.aggregateId, queued!.id),
          eq(jobOutbox.eventType, "analysis.requested"),
        ),
      );
    expect(events).toHaveLength(1);

    const claimed = await claimAiAnalysis(
      repositoryDatabase,
      OWNER_ONE_ID,
      keyword!.runId,
      queued!.id,
      "analysis-worker-one",
    );
    expect(claimed).toMatchObject({ status: "running", version: 2 });
    expect(
      await claimAiAnalysis(
        repositoryDatabase,
        OWNER_ONE_ID,
        keyword!.runId,
        queued!.id,
        "analysis-worker-two",
      ),
    ).toBeNull();

    const output = {
      summary: { statement: "Demand is measurable.", citationIds: [`kw_${keyword!.id}`] },
      opportunitySignals: [],
      risks: [],
      missingEvidence: [],
      nextSteps: [
        { statement: "Validate the topic.", citationIds: [`kw_${keyword!.id}`] },
      ],
    };
    const completed = await completeAiAnalysis(
      repositoryDatabase,
      OWNER_ONE_ID,
      keyword!.runId,
      queued!.id,
      claimed!.version,
      "analysis-worker-one",
      {
        output,
        citations: [{ keywordResultId: keyword!.id, title: keyword!.keyword }],
        latencyMs: 250,
      },
    );
    expect(completed).toMatchObject({
      status: "completed",
      summary: "Demand is measurable.",
      version: 3,
      leaseOwner: null,
    });
    const storedCitations = await database
      .select()
      .from(aiCitations)
      .where(eq(aiCitations.analysisId, queued!.id));
    expect(storedCitations).toHaveLength(1);
    expect(storedCitations[0]?.keywordResultId).toBe(keyword!.id);
  });

  test("enforces outbox idempotency independently of worker retries", async () => {
    const value = {
      ownerId: OWNER_ONE_ID,
      aggregateType: "research_run",
      aggregateId: "10000000-0000-4000-8000-000000000010",
      eventType: "research.requested",
      idempotencyKey: "outbox-idempotency-0001",
      payload: { version: 1 },
    } as const;
    await database.insert(jobOutbox).values(value);
    await expect(database.insert(jobOutbox).values(value)).rejects.toThrow();

    await expect(
      database.insert(jobOutbox).values({ ...value, ownerId: OWNER_TWO_ID }),
    ).resolves.toBeDefined();
  });

  test("claims outbox events once and recovers stale worker leases", async () => {
    const [fresh] = await database
      .insert(jobOutbox)
      .values({
        ownerId: OWNER_ONE_ID,
        aggregateType: "research_run",
        aggregateId: "10000000-0000-4000-8000-000000000011",
        eventType: "research.requested",
        idempotencyKey: "outbox-lease-recovery-0001",
        payload: { version: 1 },
      })
      .returning();
    const firstClaims = await claimOutboxEvents(repositoryDatabase, "dispatcher-one", {
      limit: 100,
    });
    const firstClaim = firstClaims.find(({ id }) => id === fresh!.id);
    expect(firstClaim).toMatchObject({ status: "processing", attempts: 1 });

    const activeClaims = await claimOutboxEvents(repositoryDatabase, "dispatcher-two", {
      limit: 100,
    });
    expect(activeClaims.some(({ id }) => id === fresh!.id)).toBe(false);

    await database
      .update(jobOutbox)
      .set({ lockedAt: new Date(Date.now() - 120_000) })
      .where(eq(jobOutbox.id, fresh!.id));
    const recoveredClaims = await claimOutboxEvents(repositoryDatabase, "dispatcher-two", {
      limit: 100,
      leaseDurationMs: 60_000,
    });
    const recovered = recoveredClaims.find(({ id }) => id === fresh!.id);
    expect(recovered).toMatchObject({ status: "processing", attempts: 2 });

    const published = await markOutboxEventPublished(
      repositoryDatabase,
      fresh!.id,
      "dispatcher-two",
    );
    expect(published).toMatchObject({ status: "published", lockedAt: null, lockedBy: null });
  });
});


describe("seeded markets", () => {
  test("has an active English market for every country the UI offers", async () => {
    const { MARKETS } = await import("@/features/research/markets");
    const { client: db, database: drizzleDb } = await createTestDatabase();
    try {
      const rows = await drizzleDb.select().from(schema.providerMarkets);
      const seeded = new Set(rows.filter((row) => row.active && row.languageCode === "en").map((row) => row.countryCode));
      for (const market of MARKETS) expect(seeded.has(market.countryCode)).toBe(true);
    } finally {
      await db.close();
    }
  }, PGLITE_SETUP_TIMEOUT_MS);
});

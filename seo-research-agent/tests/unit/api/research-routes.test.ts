import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => {
  class IdempotencyConflictError extends Error {
    constructor(message = "The idempotency key was already used for a different request.") {
      super(message);
      this.name = "IdempotencyConflictError";
    }
  }

  return {
    database: { kind: "database" },
    IdempotencyConflictError,
    requireActiveUser: vi.fn(),
    getDatabase: vi.fn(),
    createResearchRun: vi.fn(),
    getProjectById: vi.fn(),
    getLatestAiAnalysisForRun: vi.fn(),
    getResearchRunById: vi.fn(),
    listKeywordResults: vi.fn(),
    listResearchRuns: vi.fn(),
    isResearchConfigured: vi.fn(),
    dispatchResearchRunNow: vi.fn(),
    enforceRateLimit: vi.fn(),
  };
});

vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/db/client", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/server/db/repositories", () => ({
  IdempotencyConflictError: mocks.IdempotencyConflictError,
  createResearchRun: mocks.createResearchRun,
  getLatestAiAnalysisForRun: mocks.getLatestAiAnalysisForRun,
  getProjectById: mocks.getProjectById,
  getResearchRunById: mocks.getResearchRunById,
  listKeywordResults: mocks.listKeywordResults,
  listResearchRuns: mocks.listResearchRuns,
}));
vi.mock("@/server/config/environment", () => ({
  isResearchConfigured: mocks.isResearchConfigured,
}));
vi.mock("@/server/jobs", () => ({ dispatchResearchRunNow: mocks.dispatchResearchRunNow }));
vi.mock("@/server/rate-limit/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/server/logging/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET as listResearchRoute, POST as createResearchRoute } from "@/app/api/research/route";
import { GET as getResearchRoute } from "@/app/api/research/[runId]/route";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const RUN_ID = "30000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-21T00:00:00.000Z");

const user = {
  id: USER_ID,
  email: "person@example.com",
  displayName: "Person Example",
  role: "user" as const,
  status: "active" as const,
  sessionVersion: 1,
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

const project = {
  id: PROJECT_ID,
  ownerId: USER_ID,
  name: "Acme",
  targetDomain: "example.com",
  description: null,
  defaultCountryCode: "US",
  defaultLanguageCode: "en",
  status: "active" as const,
  version: 1,
  createdAt: NOW,
  updatedAt: NOW,
};

const completedRun = {
  id: RUN_ID,
  ownerId: USER_ID,
  projectId: PROJECT_ID,
  idempotencyKey: "research-key-1234567890",
  requestHash: "a".repeat(64),
  query: "technical seo",
  countryCode: "US",
  languageCode: "en",
  device: "desktop" as const,
  configuration: { keywordLimit: 100 },
  status: "completed" as const,
  version: 4,
  progress: 100,
  keywordCount: 2,
  errorCode: null,
  errorMessage: null,
  startedAt: NOW,
  finishedAt: new Date("2026-10-21T00:01:00.000Z"),
  leaseOwner: null,
  leaseExpiresAt: null,
  createdAt: NOW,
  updatedAt: new Date("2026-10-21T00:01:00.000Z"),
};

const keyword = {
  id: 43,
  ownerId: USER_ID,
  runId: RUN_ID,
  keyword: "technical seo audit",
  normalizedKeyword: "technical seo audit",
  source: "related" as const,
  provider: "dataforseo",
  providerRequestId: null,
  retrievedAt: NOW,
  intent: "commercial" as const,
  countryCode: "US",
  languageCode: "en",
  searchVolume: 900,
  cpcMicros: 2_500_000,
  competition: "0.4000",
  difficulty: 58,
  trend: null,
  createdAt: NOW,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActiveUser.mockResolvedValue(user);
  mocks.getDatabase.mockReturnValue(mocks.database);
  mocks.getProjectById.mockResolvedValue(project);
  mocks.enforceRateLimit.mockResolvedValue({ success: true });
  mocks.dispatchResearchRunNow.mockResolvedValue(undefined);
  mocks.getLatestAiAnalysisForRun.mockResolvedValue(null);
  mocks.getResearchRunById.mockResolvedValue(completedRun);
  mocks.listKeywordResults.mockResolvedValue({ items: [], nextCursor: null });
  mocks.listResearchRuns.mockResolvedValue({ items: [completedRun], nextCursor: null });
  mocks.isResearchConfigured.mockReturnValue(true);
});

describe("research history API", () => {
  it("lists recent runs for the owner and project with a bounded limit", async () => {
    const response = await listResearchRoute(historyRequest(`?projectId=${PROJECT_ID}&limit=5`));
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.listResearchRuns).toHaveBeenCalledWith(mocks.database, USER_ID, {
      projectId: PROJECT_ID,
      limit: 5,
    });
    expect(payload.runs).toEqual([
      expect.objectContaining({ id: RUN_ID, query: "technical seo", status: "completed" }),
    ]);
    expect(payload.runs[0]).not.toHaveProperty("ownerId");
    expect(payload.runs[0]).not.toHaveProperty("idempotencyKey");
  });

  it("defaults the limit to ten", async () => {
    await listResearchRoute(historyRequest(`?projectId=${PROJECT_ID}`));

    expect(mocks.listResearchRuns).toHaveBeenCalledWith(mocks.database, USER_ID, {
      projectId: PROJECT_ID,
      limit: 10,
    });
  });

  it.each([
    ["a missing project", ""],
    ["an invalid project", "?projectId=not-a-uuid"],
    ["an excessive limit", `?projectId=${PROJECT_ID}&limit=500`],
    ["a non-numeric limit", `?projectId=${PROJECT_ID}&limit=abc`],
  ])("rejects %s", async (_label, search) => {
    const response = await listResearchRoute(historyRequest(search));

    expect(response.status).toBe(400);
    expect(mocks.listResearchRuns).not.toHaveBeenCalled();
  });

  it("requires authentication before reading history", async () => {
    mocks.requireActiveUser.mockRejectedValue(
      new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false),
    );

    const response = await listResearchRoute(historyRequest(`?projectId=${PROJECT_ID}`));

    expect(response.status).toBe(401);
    expect(mocks.listResearchRuns).not.toHaveBeenCalled();
  });
});

describe("research submission API", () => {
  it("rejects cross-origin submission before authentication and rate limiting", async () => {
    const response = await createResearchRoute(
      researchRequest(undefined, {
        origin: "https://attacker.example",
        "sec-fetch-site": "cross-site",
      }),
    );

    expect(response.status).toBe(403);
    expect((await response.json()).error.code).toBe("INVALID_ORIGIN");
    expect(mocks.requireActiveUser).not.toHaveBeenCalled();
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createResearchRun).not.toHaveBeenCalled();
  });

  it("rejects unauthenticated submission before rate limiting or database access", async () => {
    mocks.requireActiveUser.mockRejectedValue(
      new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false),
    );

    const response = await createResearchRoute(researchRequest());

    expect(response.status).toBe(401);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.getProjectById).not.toHaveBeenCalled();
  });

  it("explains when research services are not configured instead of queuing a stuck run", async () => {
    mocks.isResearchConfigured.mockReturnValue(false);

    const response = await createResearchRoute(researchRequest());
    const payload = await response.json();

    expect(response.status).toBe(503);
    expect(payload.error.code).toBe("RESEARCH_NOT_CONFIGURED");
    expect(payload.error.message).toBe("Keyword research isn't available yet. Try again later.");
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.createResearchRun).not.toHaveBeenCalled();
    expect(mocks.dispatchResearchRunNow).not.toHaveBeenCalled();
  });

  it("rejects invalid JSON fields without creating or dispatching a run", async () => {
    const response = await createResearchRoute(
      researchRequest({
        projectId: "not-a-project",
        seed: "x",
        countryCode: "USA",
        languageCode: "?",
        device: "tablet",
        keywordLimit: 501,
        idempotencyKey: "short",
      }),
    );
    const payload = await response.json();

    expect(response.status).toBe(400);
    expect(payload.error.code).toBe("VALIDATION_ERROR");
    expect(payload.error.fields).toMatchObject({
      projectId: expect.any(Array),
      seed: expect.any(Array),
      countryCode: expect.any(Array),
      languageCode: expect.any(Array),
      device: expect.any(Array),
      keywordLimit: expect.any(Array),
      idempotencyKey: expect.any(Array),
    });
    expect(mocks.createResearchRun).not.toHaveBeenCalled();
    expect(mocks.dispatchResearchRunNow).not.toHaveBeenCalled();
  });

  it("uses only the authenticated owner when validating a project and creating a run", async () => {
    const queuedRun = {
      ...completedRun,
      status: "queued" as const,
      version: 1,
      progress: 0,
      keywordCount: 0,
      startedAt: null,
      finishedAt: null,
      updatedAt: NOW,
    };
    mocks.createResearchRun.mockResolvedValue(queuedRun);

    const response = await createResearchRoute(
      researchRequest({
        projectId: PROJECT_ID,
        seed: "  technical seo  ",
        countryCode: "us",
        languageCode: "en",
        device: "desktop",
        keywordLimit: 100,
        idempotencyKey: "research-key-1234567890",
        ownerId: "10000000-0000-4000-8000-000000000099",
      }),
    );

    expect(response.status).toBe(202);
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith("research", USER_ID);
    expect(mocks.getProjectById).toHaveBeenCalledWith(mocks.database, USER_ID, PROJECT_ID);
    expect(mocks.createResearchRun).toHaveBeenCalledWith(mocks.database, USER_ID, {
      projectId: PROJECT_ID,
      idempotencyKey: "research-key-1234567890",
      query: "technical seo",
      countryCode: "US",
      languageCode: "en",
      device: "desktop",
      keywordLimit: 100,
    });
    expect(mocks.dispatchResearchRunNow).toHaveBeenCalledWith(USER_ID, RUN_ID);
    expect((await response.json()).run).not.toHaveProperty("ownerId");
  });

  it("returns a stable conflict and does not dispatch when an idempotency key is reused", async () => {
    mocks.createResearchRun.mockRejectedValue(new mocks.IdempotencyConflictError());

    const response = await createResearchRoute(researchRequest());
    const payload = await response.json();

    expect(response.status).toBe(409);
    expect(payload.error).toMatchObject({
      code: "IDEMPOTENCY_CONFLICT",
      message: "The idempotency key was already used for a different request.",
      retryable: false,
    });
    expect(mocks.dispatchResearchRunNow).not.toHaveBeenCalled();
  });
});

describe("research status API", () => {
  it("uses the authenticated tenant and forwards a validated pagination cursor", async () => {
    mocks.listKeywordResults.mockResolvedValue({ items: [keyword], nextCursor: 43 });

    const response = await getResearchRoute(
      new Request(`https://app.example.test/api/research/${RUN_ID}?after=42`),
      { params: Promise.resolve({ runId: RUN_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(mocks.getResearchRunById).toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID);
    expect(mocks.listKeywordResults).toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID, {
      afterId: 42,
      limit: 100,
    });
    expect(mocks.getLatestAiAnalysisForRun)
      .toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID);
    expect(payload.nextCursor).toBe(43);
    expect(payload.keywords).toEqual([
      {
        id: 43,
        keyword: "technical seo audit",
        source: "related",
        intent: "commercial",
        searchVolume: 900,
        cpcMicros: 2_500_000,
        competition: 0.4,
        difficulty: 58,
        trend: null,
        countryCode: "US",
        languageCode: "en",
        // No SERP has been analyzed yet, so no score (and never the row index).
        nicheScore: null,
      },
    ]);
    expect(payload.run).not.toHaveProperty("ownerId");
  });

  it.each(["0", "-1", "1.5", "NaN", "9007199254740992"])(
    "rejects invalid cursor %s before reading tenant data",
    async (cursor) => {
      const response = await getResearchRoute(
        new Request(`https://app.example.test/api/research/${RUN_ID}?after=${cursor}`),
        { params: Promise.resolve({ runId: RUN_ID }) },
      );

      expect(response.status).toBe(400);
      expect((await response.json()).error.code).toBe("VALIDATION_ERROR");
      expect(mocks.getResearchRunById).not.toHaveBeenCalled();
      expect(mocks.listKeywordResults).not.toHaveBeenCalled();
    },
  );

  it("returns not found for a run outside the authenticated tenant", async () => {
    mocks.getResearchRunById.mockResolvedValue(null);

    const response = await getResearchRoute(
      new Request(`https://app.example.test/api/research/${RUN_ID}`),
      { params: Promise.resolve({ runId: RUN_ID }) },
    );

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
    expect(mocks.getResearchRunById).toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID);
    expect(mocks.listKeywordResults).not.toHaveBeenCalled();
    expect(mocks.getLatestAiAnalysisForRun).not.toHaveBeenCalled();
  });

  it("does not query keyword rows while a run is still in progress", async () => {
    mocks.getResearchRunById.mockResolvedValue({
      ...completedRun,
      status: "running",
      progress: 60,
      finishedAt: null,
    });

    const response = await getResearchRoute(
      new Request(`https://app.example.test/api/research/${RUN_ID}`),
      { params: Promise.resolve({ runId: RUN_ID }) },
    );
    const payload = await response.json();

    expect(response.status).toBe(200);
    expect(payload.keywords).toEqual([]);
    expect(payload.nextCursor).toBeNull();
    expect(mocks.listKeywordResults).not.toHaveBeenCalled();
    expect(mocks.getLatestAiAnalysisForRun)
      .toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID);
  });

  it("returns validated AI output without provider internals", async () => {
    mocks.getLatestAiAnalysisForRun.mockResolvedValue({
      id: "40000000-0000-4000-8000-000000000001",
      status: "completed",
      output: {
        summary: { statement: "Demand is measurable.", citationIds: ["kw_43"] },
        opportunitySignals: [],
        risks: [],
        missingEvidence: [],
        nextSteps: [{ statement: "Validate intent.", citationIds: ["kw_43"] }],
      },
      errorMessage: null,
      provider: "openai",
      model: "private-model-name",
      updatedAt: NOW,
    });

    const response = await getResearchRoute(
      new Request(`https://app.example.test/api/research/${RUN_ID}`),
      { params: Promise.resolve({ runId: RUN_ID }) },
    );
    const payload = await response.json();

    expect(payload.analysis).toMatchObject({
      status: "completed",
      summary: "Demand is measurable.",
    });
    expect(payload.analysis).not.toHaveProperty("provider");
    expect(payload.analysis).not.toHaveProperty("model");
  });

  it("fails closed when persisted AI output is malformed", async () => {
    mocks.getLatestAiAnalysisForRun.mockResolvedValue({
      id: "40000000-0000-4000-8000-000000000002",
      status: "completed",
      output: { summary: "not structured" },
      errorMessage: null,
      updatedAt: NOW,
    });

    const response = await getResearchRoute(
      new Request(`https://app.example.test/api/research/${RUN_ID}`),
      { params: Promise.resolve({ runId: RUN_ID }) },
    );
    const payload = await response.json();

    expect(payload.analysis).toEqual({
      id: "40000000-0000-4000-8000-000000000002",
      status: "failed",
      summary: null,
      output: null,
      errorMessage: "AI insights are temporarily unavailable.",
      updatedAt: NOW.toISOString(),
    });
  });
});

function historyRequest(search: string) {
  return new Request(`https://app.example.test/api/research${search}`);
}

function researchRequest(
  body: unknown = {
    projectId: PROJECT_ID,
    seed: "technical seo",
    countryCode: "US",
    languageCode: "en",
    device: "desktop",
    keywordLimit: 100,
    idempotencyKey: "research-key-1234567890",
  },
  headers: Record<string, string> = {},
) {
  return new Request("https://app.example.test/api/research", {
    method: "POST",
    headers: {
      origin: "https://app.example.test",
      "content-type": "application/json",
      ...headers,
    },
    body: JSON.stringify(body),
  });
}

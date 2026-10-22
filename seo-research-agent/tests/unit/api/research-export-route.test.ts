import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({
  database: { kind: "database" },
  requireActiveUser: vi.fn(),
  getDatabase: vi.fn(),
  getResearchRunById: vi.fn(),
  listKeywordResults: vi.fn(),
}));

vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/db/client", () => ({ getDatabase: mocks.getDatabase }));
vi.mock("@/server/db/repositories", () => ({
  getResearchRunById: mocks.getResearchRunById,
  listKeywordResults: mocks.listKeywordResults,
}));
vi.mock("@/server/logging/logger", () => ({
  logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() },
}));

import { GET as exportResearchRoute } from "@/app/api/research/[runId]/export/route";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const RUN_ID = "30000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-21T00:00:00.000Z");

const user = {
  id: USER_ID,
  role: "user" as const,
  status: "active" as const,
  sessionVersion: 1,
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
  keywordCount: 5,
  errorCode: null,
  errorMessage: null,
  startedAt: NOW,
  finishedAt: NOW,
  leaseOwner: null,
  leaseExpiresAt: null,
  createdAt: NOW,
  updatedAt: NOW,
};

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActiveUser.mockResolvedValue(user);
  mocks.getDatabase.mockReturnValue(mocks.database);
  mocks.getResearchRunById.mockResolvedValue(completedRun);
  mocks.listKeywordResults.mockResolvedValue({ items: [], nextCursor: null });
});

describe("research CSV export API", () => {
  it("requires authentication before loading a run", async () => {
    mocks.requireActiveUser.mockRejectedValue(
      new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false),
    );

    const response = await exportResearchRoute(exportRequest(), routeContext());

    expect(response.status).toBe(401);
    expect(mocks.getResearchRunById).not.toHaveBeenCalled();
    expect(mocks.listKeywordResults).not.toHaveBeenCalled();
  });

  it("does not expose an export owned by another tenant", async () => {
    mocks.getResearchRunById.mockResolvedValue(null);

    const response = await exportResearchRoute(exportRequest(), routeContext());

    expect(response.status).toBe(404);
    expect((await response.json()).error.code).toBe("NOT_FOUND");
    expect(mocks.getResearchRunById).toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID);
    expect(mocks.listKeywordResults).not.toHaveBeenCalled();
  });

  it("rejects export until research has completed", async () => {
    mocks.getResearchRunById.mockResolvedValue({
      ...completedRun,
      status: "running",
      progress: 70,
      finishedAt: null,
    });

    const response = await exportResearchRoute(exportRequest(), routeContext());

    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("NOT_READY");
    expect(mocks.listKeywordResults).not.toHaveBeenCalled();
  });

  it("streams tenant-scoped pages and neutralizes spreadsheet formulas", async () => {
    mocks.listKeywordResults
      .mockResolvedValueOnce({
        items: [
          keyword(1, "=HYPERLINK(\"https://evil.example\")", { cpcMicros: 1_250_000 }),
          keyword(2, "+SUM(1,1)"),
          keyword(3, "-2+3"),
          keyword(4, "@malicious"),
        ],
        nextCursor: 4,
      })
      .mockResolvedValueOnce({
        items: [
          keyword(5, "safe, \"quoted\" keyword", { searchVolume: null, cpcMicros: null }),
        ],
        nextCursor: null,
      });

    const response = await exportResearchRoute(
      new Request(`https://app.example.test/api/research/${RUN_ID}/export`, {
        headers: { "x-request-id": "csv-request-1" },
      }),
      routeContext(),
    );
    const csv = await response.text();

    expect(response.status).toBe(200);
    expect(response.headers.get("content-type")).toBe("text/csv; charset=utf-8");
    expect(response.headers.get("content-disposition"))
      .toBe(`attachment; filename="research-${RUN_ID}.csv"`);
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("x-request-id")).toBe("csv-request-1");
    expect(mocks.listKeywordResults).toHaveBeenNthCalledWith(
      1,
      mocks.database,
      USER_ID,
      RUN_ID,
      { afterId: undefined, limit: 250 },
    );
    expect(mocks.listKeywordResults).toHaveBeenNthCalledWith(
      2,
      mocks.database,
      USER_ID,
      RUN_ID,
      { afterId: 4, limit: 250 },
    );

    const lines = csv.trimEnd().split("\r\n");
    expect(lines[0]).toBe(
      "keyword,source,intent,search_volume,cpc_usd,competition,difficulty",
    );
    expect(lines[1]).toContain(`"'=HYPERLINK(""https://evil.example"")"`);
    expect(lines[1]).toContain('"1.250000"');
    expect(lines[2]).toContain(`"'+SUM(1,1)"`);
    expect(lines[3]).toContain(`"'-2+3"`);
    expect(lines[4]).toContain(`"'@malicious"`);
    expect(lines[5]).toContain(`"safe, ""quoted"" keyword"`);
    expect(lines[5]).toContain(',,"0.4000","58"');
    expect(lines.slice(1).every((line) => !/^"[=+\-@]/.test(line))).toBe(true);
  });
});

function exportRequest() {
  return new Request(`https://app.example.test/api/research/${RUN_ID}/export`);
}

function routeContext() {
  return { params: Promise.resolve({ runId: RUN_ID }) };
}

function keyword(
  id: number,
  value: string,
  overrides: Partial<{
    searchVolume: number | null;
    cpcMicros: number | null;
  }> = {},
) {
  return {
    id,
    ownerId: USER_ID,
    runId: RUN_ID,
    keyword: value,
    normalizedKeyword: value.toLowerCase(),
    source: "related" as const,
    provider: "dataforseo",
    providerRequestId: null,
    retrievedAt: NOW,
    intent: "commercial" as const,
    countryCode: "US",
    languageCode: "en",
    searchVolume: overrides.searchVolume === undefined ? 900 : overrides.searchVolume,
    cpcMicros: overrides.cpcMicros === undefined ? 2_500_000 : overrides.cpcMicros,
    competition: "0.4000",
    difficulty: 58,
    trend: null,
    createdAt: NOW,
  };
}

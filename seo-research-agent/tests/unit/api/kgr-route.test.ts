import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({
  database: { kind: "database" },
  requireActiveUser: vi.fn(),
  isResearchConfigured: vi.fn(),
  requireCompletedRun: vi.fn(),
  checkAllintitleCounts: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/config/environment", () => ({ isResearchConfigured: mocks.isResearchConfigured }));
vi.mock("@/server/db/client", () => ({ getDatabase: () => mocks.database }));
vi.mock("@/server/research/runs", () => ({ requireCompletedRun: mocks.requireCompletedRun }));
vi.mock("@/server/research/kgr", () => ({ checkAllintitleCounts: mocks.checkAllintitleCounts }));
vi.mock("@/server/rate-limit/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { POST } from "@/app/api/research/[runId]/kgr/route";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const RUN_ID = "30000000-0000-4000-8000-000000000001";
const run = { id: RUN_ID, ownerId: USER_ID, status: "completed" };
const context = { params: Promise.resolve({ runId: RUN_ID }) };

function request(body: unknown, origin = "https://app.example.test") {
  return new Request(`https://app.example.test/api/research/${RUN_ID}/kgr`, {
    method: "POST",
    headers: { origin, "content-type": "application/json" },
    body: JSON.stringify(body),
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActiveUser.mockResolvedValue({ id: USER_ID });
  mocks.isResearchConfigured.mockReturnValue(true);
  mocks.requireCompletedRun.mockResolvedValue(run);
  mocks.enforceRateLimit.mockResolvedValue({ success: true });
  mocks.checkAllintitleCounts.mockImplementation(async ({ beforeLookups }: { beforeLookups: () => Promise<void> }) => {
    await beforeLookups();
    return { keywords: [{ id: 7, allintitleCount: 12 }], failed: 0 };
  });
});

describe("KGR API", () => {
  it("checks the run's keywords and rate-limits paid lookups", async () => {
    const response = await POST(request({ keywordIds: [7, 8] }), context);

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ keywords: [{ id: 7, allintitleCount: 12 }], failed: 0 });
    expect(mocks.requireCompletedRun).toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID);
    expect(mocks.checkAllintitleCounts).toHaveBeenCalledWith(expect.objectContaining({ ownerId: USER_ID, run, keywordIds: [7, 8] }));
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith("kgr", USER_ID);
  });

  it("rejects cross-site requests, bad input and oversized batches", async () => {
    expect((await POST(request({ keywordIds: [7] }, "https://evil.example"), context)).status).toBe(403);
    expect((await POST(request({ keywordIds: [] }), context)).status).toBe(400);
    expect((await POST(request({ keywordIds: [7, 7] }), context)).status).toBe(400);
    expect((await POST(request({ keywordIds: Array.from({ length: 11 }, (_, index) => index + 1) }), context)).status).toBe(400);
    expect((await POST(request({ keywordIds: ["7"] }), context)).status).toBe(400);
    expect((await POST(request({ keywordIds: [7], extra: true }), context)).status).toBe(400);
    expect(mocks.checkAllintitleCounts).not.toHaveBeenCalled();
  });

  it("requires sign-in and reports when research isn't configured", async () => {
    mocks.requireActiveUser.mockRejectedValueOnce(new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false));
    expect((await POST(request({ keywordIds: [7] }), context)).status).toBe(401);

    mocks.isResearchConfigured.mockReturnValue(false);
    const response = await POST(request({ keywordIds: [7] }), context);
    expect(response.status).toBe(503);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });
});

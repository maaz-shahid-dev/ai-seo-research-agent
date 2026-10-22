import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({
  database: { kind: "database" },
  requireActiveUser: vi.fn(),
  isResearchConfigured: vi.fn(),
  getResearchRunById: vi.fn(),
  getKeywordResult: vi.fn(),
  getSerpAnalysisForKeyword: vi.fn(),
  requestSerpAnalyses: vi.fn(),
  listSerpResults: vi.fn(),
  getDomainMetrics: vi.fn(),
  getProjectById: vi.fn(),
  getContentGap: vi.fn(),
  requestContentGap: vi.fn(),
  dispatchOutboxEventNow: vi.fn(),
  enforceRateLimit: vi.fn(),
}));

vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/config/environment", () => ({ isResearchConfigured: mocks.isResearchConfigured }));
vi.mock("@/server/db/client", () => ({ getDatabase: () => mocks.database }));
vi.mock("@/server/db/repositories", () => ({
  getResearchRunById: mocks.getResearchRunById,
  getKeywordResult: mocks.getKeywordResult,
  getSerpAnalysisForKeyword: mocks.getSerpAnalysisForKeyword,
  requestSerpAnalyses: mocks.requestSerpAnalyses,
  listSerpResults: mocks.listSerpResults,
  getDomainMetrics: mocks.getDomainMetrics,
  getProjectById: mocks.getProjectById,
  getContentGap: mocks.getContentGap,
  requestContentGap: mocks.requestContentGap,
}));
vi.mock("@/server/jobs", () => ({ dispatchOutboxEventNow: mocks.dispatchOutboxEventNow }));
vi.mock("@/server/rate-limit/rate-limit", () => ({ enforceRateLimit: mocks.enforceRateLimit }));
vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { GET as getGap, POST as postGap } from "@/app/api/research/[runId]/content-gap/route";
import { GET as getSerp, POST as postSerp } from "@/app/api/research/[runId]/serp/[keywordId]/route";

const USER_ID = "10000000-0000-4000-8000-000000000001";
const RUN_ID = "30000000-0000-4000-8000-000000000001";
const PROJECT_ID = "20000000-0000-4000-8000-000000000001";
const ANALYSIS_ID = "50000000-0000-4000-8000-000000000001";
const NOW = new Date("2026-10-22T00:00:00.000Z");

const run = { id: RUN_ID, ownerId: USER_ID, projectId: PROJECT_ID, status: "completed" };
const queuedAnalysis = {
  id: ANALYSIS_ID, ownerId: USER_ID, runId: RUN_ID, keywordResultId: 7, status: "queued", snapshotId: null,
  nicheScore: null, hasAiOverview: null, errorMessage: null, finishedAt: null,
};
const completedAnalysis = {
  ...queuedAnalysis, status: "completed", snapshotId: "70000000-0000-4000-8000-000000000001", nicheScore: 72, hasAiOverview: false, finishedAt: NOW,
};

function serpRequest(method: "GET" | "POST", headers: Record<string, string> = {}) {
  return new Request(`https://app.example.test/api/research/${RUN_ID}/serp/7`, {
    method,
    headers: method === "POST" ? { origin: "https://app.example.test", "content-type": "application/json", ...headers } : headers,
    body: method === "POST" ? "{}" : undefined,
  });
}
const serpContext = (keywordId = "7") => ({ params: Promise.resolve({ runId: RUN_ID, keywordId }) });

function gapRequest(method: "GET" | "POST") {
  return new Request(`https://app.example.test/api/research/${RUN_ID}/content-gap`, {
    method,
    headers: method === "POST" ? { origin: "https://app.example.test", "content-type": "application/json" } : {},
    body: method === "POST" ? "{}" : undefined,
  });
}
const gapContext = { params: Promise.resolve({ runId: RUN_ID }) };

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActiveUser.mockResolvedValue({ id: USER_ID });
  mocks.isResearchConfigured.mockReturnValue(true);
  mocks.getResearchRunById.mockResolvedValue(run);
  mocks.getKeywordResult.mockResolvedValue({ id: 7 });
  mocks.listSerpResults.mockResolvedValue([]);
  mocks.getDomainMetrics.mockResolvedValue([]);
  mocks.enforceRateLimit.mockResolvedValue({ success: true });
  mocks.getProjectById.mockResolvedValue({ id: PROJECT_ID, targetDomain: "myblog.com" });
});

describe("SERP analysis API", () => {
  it("queues a new analysis, dispatches it and applies the rate limit", async () => {
    mocks.getSerpAnalysisForKeyword.mockResolvedValueOnce(null).mockResolvedValueOnce(queuedAnalysis);

    const response = await postSerp(serpRequest("POST"), serpContext());

    expect(response.status).toBe(202);
    expect((await response.json()).serp).toMatchObject({ keywordId: 7, status: "queued", results: [] });
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith("serp", USER_ID);
    expect(mocks.requestSerpAnalyses).toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID, [7]);
    expect(mocks.dispatchOutboxEventNow).toHaveBeenCalledWith(USER_ID, ANALYSIS_ID, "serp.requested");
  });

  it("returns an existing analysis without spending quota", async () => {
    mocks.getSerpAnalysisForKeyword.mockResolvedValue(completedAnalysis);
    mocks.listSerpResults.mockResolvedValue([
      { rank: 1, title: "Thread", url: "https://www.reddit.com/r/x", domain: "www.reddit.com" },
      { rank: 2, title: "Home", url: "https://tinyblog.com/", domain: "tinyblog.com" },
    ]);
    mocks.getDomainMetrics.mockResolvedValue([
      { domain: "reddit.com", authority: 91, backlinks: 9, referringDomains: 3, monthlyTraffic: 900_000, registeredAt: new Date("2005-01-01") },
      { domain: "tinyblog.com", authority: 8, backlinks: null, referringDomains: null, monthlyTraffic: null, registeredAt: null },
    ]);

    const response = await postSerp(serpRequest("POST"), serpContext());
    const { serp } = await response.json();

    expect(response.status).toBe(200);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
    expect(mocks.requestSerpAnalyses).not.toHaveBeenCalled();
    expect(mocks.getDomainMetrics).toHaveBeenCalledWith(mocks.database, ["reddit.com", "tinyblog.com"]);
    expect(serp).toMatchObject({ status: "completed", nicheScore: 72, hasAiOverview: false });
    expect(serp.results[0]).toMatchObject({ domain: "reddit.com", authority: 91, siteType: "forum", weakSpots: ["forum"], isHomepage: false });
    expect(serp.results[1]).toMatchObject({ domain: "tinyblog.com", authority: 8, isHomepage: true, weakSpots: ["low-authority"] });
  });

  it("retries a failed analysis", async () => {
    mocks.getSerpAnalysisForKeyword.mockResolvedValueOnce({ ...queuedAnalysis, status: "failed" }).mockResolvedValueOnce(queuedAnalysis);
    const response = await postSerp(serpRequest("POST"), serpContext());
    expect(response.status).toBe(202);
    expect(mocks.requestSerpAnalyses).toHaveBeenCalled();
  });

  it.each([
    ["a cross-site request", () => postSerp(serpRequest("POST", { origin: "https://evil.example", "sec-fetch-site": "cross-site" }), serpContext()), 403],
    ["an invalid keyword id", () => postSerp(serpRequest("POST"), serpContext("abc")), 400],
    ["a missing run", async () => { mocks.getResearchRunById.mockResolvedValue(null); return postSerp(serpRequest("POST"), serpContext()); }, 404],
    ["an unfinished run", async () => { mocks.getResearchRunById.mockResolvedValue({ ...run, status: "running" }); return postSerp(serpRequest("POST"), serpContext()); }, 409],
    ["a keyword from another run", async () => { mocks.getKeywordResult.mockResolvedValue(null); return postSerp(serpRequest("POST"), serpContext()); }, 404],
  ])("rejects %s", async (_label, call, status) => {
    const response = await call();
    expect(response.status).toBe(status);
    expect(mocks.requestSerpAnalyses).not.toHaveBeenCalled();
  });

  it("refuses new paid lookups when services are not configured", async () => {
    mocks.getSerpAnalysisForKeyword.mockResolvedValue(null);
    mocks.isResearchConfigured.mockReturnValue(false);
    const response = await postSerp(serpRequest("POST"), serpContext());
    expect(response.status).toBe(503);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();
  });

  it("requires sign-in and returns 404 before an analysis exists", async () => {
    mocks.getSerpAnalysisForKeyword.mockResolvedValue(null);
    expect((await getSerp(serpRequest("GET"), serpContext())).status).toBe(404);

    mocks.requireActiveUser.mockRejectedValue(new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false));
    expect((await getSerp(serpRequest("GET"), serpContext())).status).toBe(401);
  });
});

describe("content gap API", () => {
  const report = {
    id: "60000000-0000-4000-8000-000000000001", status: "queued", targetDomain: "myblog.com",
    competitors: [], keywords: [], errorMessage: null,
  };

  it("queues a report for the project's website", async () => {
    mocks.getContentGap.mockResolvedValue(null);
    mocks.requestContentGap.mockResolvedValue(report);

    const response = await postGap(gapRequest("POST"), gapContext);

    expect(response.status).toBe(202);
    expect(mocks.requestContentGap).toHaveBeenCalledWith(mocks.database, USER_ID, RUN_ID, "myblog.com");
    expect(mocks.enforceRateLimit).toHaveBeenCalledWith("content-gap", USER_ID);
    expect(mocks.dispatchOutboxEventNow).toHaveBeenCalledWith(USER_ID, report.id, "content-gap.requested");
  });

  it("asks for a website when the project has none", async () => {
    mocks.getProjectById.mockResolvedValue({ id: PROJECT_ID, targetDomain: null });
    const response = await postGap(gapRequest("POST"), gapContext);
    expect(response.status).toBe(409);
    expect((await response.json()).error.code).toBe("WEBSITE_REQUIRED");
  });

  it("returns an existing report without spending quota, and reads it via GET", async () => {
    mocks.getContentGap.mockResolvedValue({ ...report, status: "completed", competitors: ["rival.com"] });

    const posted = await postGap(gapRequest("POST"), gapContext);
    expect(posted.status).toBe(200);
    expect(mocks.enforceRateLimit).not.toHaveBeenCalled();

    const read = await getGap(gapRequest("GET"), gapContext);
    expect((await read.json()).contentGap).toMatchObject({ status: "completed", competitors: ["rival.com"], errorMessage: null });
  });
});

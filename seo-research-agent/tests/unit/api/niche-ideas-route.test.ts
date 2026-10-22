import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({
  requireActiveUser: vi.fn(),
  ensureTodaysNicheIdeas: vi.fn(),
  listLatestNicheIdeas: vi.fn(),
  listNicheIdeasForDate: vi.fn(),
  listFavoriteNicheIdeas: vi.fn(),
  listNicheIdeaDates: vi.fn(),
  listNicheIdeaReactions: vi.fn(),
  setNicheIdeaReaction: vi.fn(),
}));
vi.mock("@/server/jobs/daily-niches", () => ({ ensureTodaysNicheIdeas: mocks.ensureTodaysNicheIdeas }));
vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/server/db/repositories", () => ({
  listLatestNicheIdeas: mocks.listLatestNicheIdeas,
  listNicheIdeasForDate: mocks.listNicheIdeasForDate,
  listFavoriteNicheIdeas: mocks.listFavoriteNicheIdeas,
  listNicheIdeaDates: mocks.listNicheIdeaDates,
  listNicheIdeaReactions: mocks.listNicheIdeaReactions,
  setNicheIdeaReaction: mocks.setNicheIdeaReaction,
}));
vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { PUT } from "@/app/api/niche-ideas/[ideaId]/reaction/route";
import { GET } from "@/app/api/niche-ideas/route";

const IDEA_ID = "60000000-0000-4000-8000-000000000001";
const row = {
  id: IDEA_ID, niche: "Betta tanks", seedKeyword: "betta fish tank setup", problem: "Cloudy water", audience: "New fish owners",
  nicheType: "info", countryCode: "GB", searchVolume: 2400, difficulty: 12, lowAuthorityCount: 4, ideaDate: "2026-10-22", createdAt: new Date(),
};
const get = (query = "") => GET(new Request(`https://app.example.test/api/niche-ideas${query}`));
const put = (body: unknown, origin = "https://app.example.test", ideaId = IDEA_ID) =>
  PUT(new Request(`https://app.example.test/api/niche-ideas/${ideaId}/reaction`, {
    method: "PUT", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body),
  }), { params: Promise.resolve({ ideaId }) });

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActiveUser.mockResolvedValue({ id: "u" });
  mocks.ensureTodaysNicheIdeas.mockResolvedValue({ status: "completed" });
  mocks.listLatestNicheIdeas.mockResolvedValue({ date: "2026-10-22", ideas: [row] });
  mocks.listNicheIdeaDates.mockResolvedValue(["2026-10-22", "2026-10-21"]);
  mocks.listNicheIdeaReactions.mockResolvedValue(new Map([[IDEA_ID, "favorite"]]));
});

describe("niche ideas API", () => {
  it("returns the latest ideas with days and the user's reactions, without internal fields", async () => {
    const response = await get();
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      date: "2026-10-22",
      dates: ["2026-10-22", "2026-10-21"],
      ideas: [{
        id: IDEA_ID, niche: "Betta tanks", seedKeyword: "betta fish tank setup", problem: "Cloudy water", audience: "New fish owners",
        nicheType: "info", countryCode: "GB", searchVolume: 2400, difficulty: 12, lowAuthorityCount: 4, ideaDate: "2026-10-22", reaction: "favorite",
      }],
    });
    expect(mocks.listNicheIdeaReactions).toHaveBeenCalledWith({}, "u", [IDEA_ID]);
  });

  it("lists a past day without generating, and the user's favorites", async () => {
    mocks.listNicheIdeasForDate.mockResolvedValue([row]);
    expect((await (await get("?date=2026-10-21")).json()).date).toBe("2026-10-21");
    expect(mocks.listNicheIdeasForDate).toHaveBeenCalledWith({}, "2026-10-21");

    mocks.listFavoriteNicheIdeas.mockResolvedValue([row]);
    const favorites = await (await get("?view=favorites")).json();
    expect(favorites.date).toBeNull();
    expect(favorites.ideas).toHaveLength(1);
    expect(mocks.listFavoriteNicheIdeas).toHaveBeenCalledWith({}, "u");
    expect(mocks.ensureTodaysNicheIdeas).not.toHaveBeenCalled();
  });

  it("rejects invalid dates and views", async () => {
    expect((await get("?date=2026-02-31")).status).toBe(400);
    expect((await get("?date=yesterday")).status).toBe(400);
    expect((await get("?view=everything")).status).toBe(400);
  });

  it("requires sign-in", async () => {
    mocks.requireActiveUser.mockRejectedValue(new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false));
    expect((await get()).status).toBe(401);
    expect(mocks.listLatestNicheIdeas).not.toHaveBeenCalled();
  });

  it("creates today's ideas before listing, and still lists older ideas if that fails", async () => {
    mocks.listLatestNicheIdeas.mockResolvedValue({ date: "2026-10-21", ideas: [] });
    mocks.ensureTodaysNicheIdeas.mockRejectedValue(new Error("provider down"));

    const response = await get();

    expect(mocks.ensureTodaysNicheIdeas).toHaveBeenCalledOnce();
    expect(response.status).toBe(200);
    expect((await response.json()).date).toBe("2026-10-21");
  });
});

describe("niche idea reactions API", () => {
  it("saves and clears a reaction for the signed-in user", async () => {
    mocks.setNicheIdeaReaction.mockResolvedValue(true);
    const response = await put({ status: "dismissed" });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ ideaId: IDEA_ID, reaction: "dismissed" });
    expect(mocks.setNicheIdeaReaction).toHaveBeenCalledWith({}, "u", IDEA_ID, "dismissed");

    expect((await put({ status: null })).status).toBe(200);
    expect(mocks.setNicheIdeaReaction).toHaveBeenLastCalledWith({}, "u", IDEA_ID, null);
  });

  it("rejects cross-site requests, bad input and unknown ideas", async () => {
    expect((await put({ status: "favorite" }, "https://evil.example")).status).toBe(403);
    expect((await put({ status: "loved" })).status).toBe(400);
    expect((await put({ status: "favorite", ownerId: "x" })).status).toBe(400);
    expect((await put({ status: "favorite" }, undefined, "not-a-uuid")).status).toBe(400);
    expect(mocks.setNicheIdeaReaction).not.toHaveBeenCalled();

    mocks.setNicheIdeaReaction.mockResolvedValue(false);
    expect((await put({ status: "favorite" })).status).toBe(404);
  });
});

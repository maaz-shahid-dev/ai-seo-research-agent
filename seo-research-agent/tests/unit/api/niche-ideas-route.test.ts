import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({ requireActiveUser: vi.fn(), listLatestNicheIdeas: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/server/db/repositories", () => ({ listLatestNicheIdeas: mocks.listLatestNicheIdeas }));
vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { GET } from "@/app/api/niche-ideas/route";

beforeEach(() => vi.clearAllMocks());

describe("niche ideas API", () => {
  it("returns the latest ideas without internal fields", async () => {
    mocks.requireActiveUser.mockResolvedValue({ id: "u" });
    mocks.listLatestNicheIdeas.mockResolvedValue({
      date: "2026-10-22",
      ideas: [{ id: "i1", niche: "Betta tanks", seedKeyword: "betta fish tank setup", problem: "Cloudy water", audience: "New fish owners", ideaDate: "2026-10-22", createdAt: new Date() }],
    });

    const response = await GET(new Request("https://app.example.test/api/niche-ideas"));
    const body = await response.json();

    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(body).toEqual({
      date: "2026-10-22",
      ideas: [{ id: "i1", niche: "Betta tanks", seedKeyword: "betta fish tank setup", problem: "Cloudy water", audience: "New fish owners" }],
    });
  });

  it("requires sign-in", async () => {
    mocks.requireActiveUser.mockRejectedValue(new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false));
    expect((await GET(new Request("https://app.example.test/api/niche-ideas"))).status).toBe(401);
    expect(mocks.listLatestNicheIdeas).not.toHaveBeenCalled();
  });
});

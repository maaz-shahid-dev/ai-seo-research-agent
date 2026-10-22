import { beforeEach, describe, expect, it, vi } from "vitest";

import { AppError } from "@/server/http/errors";

const mocks = vi.hoisted(() => ({ requireActiveUser: vi.fn(), getUserSettings: vi.fn(), updateUserSettings: vi.fn() }));
vi.mock("@/server/auth", () => ({ requireActiveUser: mocks.requireActiveUser }));
vi.mock("@/server/db/client", () => ({ getDatabase: () => ({}) }));
vi.mock("@/server/db/repositories", () => ({ getUserSettings: mocks.getUserSettings, updateUserSettings: mocks.updateUserSettings }));
vi.mock("@/server/logging/logger", () => ({ logger: { error: vi.fn(), info: vi.fn(), warn: vi.fn() } }));

import { GET, PATCH } from "@/app/api/me/settings/route";

const settings = { email: "a@example.test", displayName: "Maaz", defaultCountryCode: null, theme: "light", tableDensity: "comfortable" };
const patch = (body: unknown, origin = "https://app.example.test") =>
  PATCH(new Request("https://app.example.test/api/me/settings", { method: "PATCH", headers: { origin, "content-type": "application/json" }, body: JSON.stringify(body) }));

beforeEach(() => {
  vi.clearAllMocks();
  mocks.requireActiveUser.mockResolvedValue({ id: "u" });
  mocks.getUserSettings.mockResolvedValue(settings);
  mocks.updateUserSettings.mockImplementation(async (_db, _id, update) => ({ ...settings, ...update }));
});

describe("settings API", () => {
  it("returns the signed-in user's settings", async () => {
    const response = await GET(new Request("https://app.example.test/api/me/settings"));
    expect(response.headers.get("cache-control")).toBe("no-store");
    expect(await response.json()).toEqual({ settings });
    expect(mocks.getUserSettings).toHaveBeenCalledWith({}, "u");
  });

  it("saves only the fields sent, for the signed-in user", async () => {
    const response = await patch({ theme: "dark", defaultCountryCode: "GB", displayName: "  Maaz Shahid " });
    expect(response.status).toBe(200);
    expect(mocks.updateUserSettings).toHaveBeenCalledWith({}, "u", { theme: "dark", defaultCountryCode: "GB", displayName: "Maaz Shahid" });
    expect((await response.json()).settings).toMatchObject({ theme: "dark", defaultCountryCode: "GB" });

    expect((await patch({ defaultCountryCode: null })).status).toBe(200);
  });

  it("rejects bad input, unknown fields, empty updates and cross-site requests", async () => {
    for (const body of [{ theme: "blue" }, { defaultCountryCode: "FR" }, { tableDensity: "tiny" }, { displayName: "<b>x</b>" }, { role: "admin" }, {}]) {
      expect((await patch(body)).status).toBe(400);
    }
    expect((await patch({ theme: "dark" }, "https://evil.example")).status).toBe(403);
    expect(mocks.updateUserSettings).not.toHaveBeenCalled();
  });

  it("requires sign-in", async () => {
    mocks.requireActiveUser.mockRejectedValue(new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false));
    expect((await GET(new Request("https://app.example.test/api/me/settings"))).status).toBe(401);
    expect((await patch({ theme: "dark" })).status).toBe(401);
  });
});

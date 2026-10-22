import { describe, expect, it, vi } from "vitest";
import type { Session } from "next-auth";

import { requireActiveUserFromSession } from "@/server/auth/active-session";
import type { DatabaseClient } from "@/server/db/client";

const database = {} as DatabaseClient;
const activeUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "person@example.com",
  displayName: "Person Example",
  role: "user" as const,
  status: "active" as const,
  sessionVersion: 2,
  emailVerifiedAt: null,
  lastLoginAt: null,
  createdAt: new Date("2026-10-20T00:00:00.000Z"),
  updatedAt: new Date("2026-10-20T00:00:00.000Z"),
};

function session(overrides: Partial<NonNullable<Session["user"]>> = {}): Session {
  return {
    expires: "2026-10-22T00:00:00.000Z",
    user: {
      id: activeUser.id,
      role: "user",
      status: "active",
      sessionVersion: 2,
      ...overrides,
    },
  };
}

describe("active-user authorization boundary", () => {
  it("re-reads and returns the current safe user projection", async () => {
    const loader = vi.fn().mockResolvedValue({ ...activeUser, role: "admin" as const });
    const result = await requireActiveUserFromSession(session(), database, loader);

    expect(loader).toHaveBeenCalledWith(database, activeUser.id);
    expect(result.role).toBe("admin");
    expect(result).not.toHaveProperty("passwordHash");
  });

  it.each([
    ["missing session", null, activeUser],
    ["disabled token", session({ status: "disabled" }), activeUser],
    ["deleted account", session(), null],
    ["disabled account", session(), { ...activeUser, status: "disabled" as const }],
    ["revoked version", session(), { ...activeUser, sessionVersion: 3 }],
  ])("rejects a %s", async (_label, value, databaseUser) => {
    const loader = vi.fn().mockResolvedValue(databaseUser);
    await expect(
      requireActiveUserFromSession(value, database, loader),
    ).rejects.toMatchObject({ code: "UNAUTHENTICATED", status: 401 });
  });
});

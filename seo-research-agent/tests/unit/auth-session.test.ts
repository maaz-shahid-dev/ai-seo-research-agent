import { describe, expect, it } from "vitest";
import type { Session, User } from "next-auth";
import type { JWT } from "next-auth/jwt";

import { exposeIdentityInSession, persistIdentityInToken } from "@/features/auth/session";

describe("minimal authentication session claims", () => {
  it("persists only authorization claims in the JWT", () => {
    const token: JWT = {
      name: "Sensitive Name",
      email: "person@example.com",
      picture: "https://example.com/avatar.png",
    };
    const user: User = {
      id: "user-1",
      role: "admin",
      status: "active",
      sessionVersion: 4,
    };

    expect(persistIdentityInToken(token, user)).toEqual({
      sub: "user-1",
      role: "admin",
      status: "active",
      sessionVersion: 4,
    });
  });

  it("exposes only valid identity claims to the browser session", () => {
    const session: Session = { expires: "2026-10-22T00:00:00.000Z" };
    const token: JWT = {
      sub: "user-1",
      role: "user",
      status: "active",
      sessionVersion: 2,
    };

    expect(exposeIdentityInSession(session, token)).toEqual({
      expires: session.expires,
      user: { id: "user-1", role: "user", status: "active", sessionVersion: 2 },
    });
  });

  it("drops malformed or incomplete claims", () => {
    const session: Session = { expires: "2026-10-22T00:00:00.000Z" };
    const malformedToken = {
      sub: "user-1",
      role: "owner",
      status: "active",
      sessionVersion: 2,
    } as unknown as JWT;
    expect(
      exposeIdentityInSession(session, malformedToken),
    ).toEqual({ ...session, user: undefined });
  });
});

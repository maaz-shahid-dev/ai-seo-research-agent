import { describe, expect, it, vi } from "vitest";

import { authenticateCredentials, registerAccount } from "@/features/auth/service";
import { AppError } from "@/server/http/errors";

const CURRENT_PASSWORD_HASH =
  "$argon2id$v=19$m=19456,t=2,p=1$NGDHXAOSHtpaz2oMkIoGOw$ckHmISZjyEK10F+4h0G/SLvOaSY2oq0/n9VQ+vIwltA";

const credentialUser = {
  id: "10000000-0000-4000-8000-000000000001",
  email: "person@example.com",
  displayName: "Person Example",
  passwordHash: CURRENT_PASSWORD_HASH,
  role: "user" as const,
  status: "active" as const,
  sessionVersion: 3,
  failedAuthAttempts: 0,
  lockedUntil: null,
};

function authDependencies(overrides: Record<string, unknown> = {}) {
  return {
    rateLimit: vi.fn().mockResolvedValue({ success: true }),
    findCredentialsByEmail: vi.fn().mockResolvedValue(credentialUser),
    recordFailure: vi.fn().mockResolvedValue(undefined),
    recordSuccess: vi.fn().mockResolvedValue({
      id: credentialUser.id,
      email: credentialUser.email,
      displayName: credentialUser.displayName,
      role: credentialUser.role,
      status: credentialUser.status,
      sessionVersion: credentialUser.sessionVersion,
    }),
    replaceHash: vi.fn().mockResolvedValue(true),
    verifyPassword: vi.fn().mockResolvedValue(true),
    hashPassword: vi.fn().mockResolvedValue("replacement-hash"),
    now: () => new Date("2026-10-21T10:00:00.000Z"),
    ...overrides,
  };
}

describe("credential authentication service", () => {
  it("rate limits private identifiers and returns only minimal identity claims", async () => {
    const dependencies = authDependencies();

    const result = await authenticateCredentials(
      { email: " Person@Example.com ", password: "correct horse battery staple" },
      "203.0.113.42",
      dependencies,
    );

    expect(result).toEqual({
      id: credentialUser.id,
      role: "user",
      status: "active",
      sessionVersion: 3,
    });
    expect(dependencies.findCredentialsByEmail).toHaveBeenCalledWith("person@example.com");
    expect(dependencies.recordSuccess).toHaveBeenCalledWith(
      credentialUser.id,
      CURRENT_PASSWORD_HASH,
    );
    const rateLimitKeys = dependencies.rateLimit.mock.calls.map(([, key]) => String(key));
    expect(rateLimitKeys.join(" ")).not.toContain("person@example.com");
    expect(rateLimitKeys.join(" ")).not.toContain("203.0.113.42");
    expect(dependencies.recordFailure).not.toHaveBeenCalled();
  });

  it("uses the dummy password path for an unknown account", async () => {
    const dependencies = authDependencies({
      findCredentialsByEmail: vi.fn().mockResolvedValue(null),
      verifyPassword: vi.fn().mockResolvedValue(false),
    });

    await expect(
      authenticateCredentials(
        { email: "missing@example.com", password: "a password long enough" },
        "198.51.100.2",
        dependencies,
      ),
    ).resolves.toBeNull();

    expect(dependencies.verifyPassword).toHaveBeenCalledWith(null, "a password long enough");
    expect(dependencies.recordFailure).not.toHaveBeenCalled();
  });

  it("counts an incorrect password for an active unlocked account", async () => {
    const dependencies = authDependencies({
      verifyPassword: vi.fn().mockResolvedValue(false),
    });

    await expect(
      authenticateCredentials(
        { email: credentialUser.email, password: "incorrect password value" },
        "198.51.100.3",
        dependencies,
      ),
    ).resolves.toBeNull();
    expect(dependencies.recordFailure).toHaveBeenCalledWith(credentialUser.id);
    expect(dependencies.recordSuccess).not.toHaveBeenCalled();
  });

  it.each([
    ["disabled", { ...credentialUser, status: "disabled" as const }],
    [
      "locked",
      { ...credentialUser, lockedUntil: new Date("2026-10-21T10:15:00.000Z") },
    ],
  ])("denies a %s account with a generic null result", async (_label, user) => {
    const dependencies = authDependencies({
      findCredentialsByEmail: vi.fn().mockResolvedValue(user),
    });

    await expect(
      authenticateCredentials(
        { email: credentialUser.email, password: "correct horse battery staple" },
        "198.51.100.4",
        dependencies,
      ),
    ).resolves.toBeNull();
    expect(dependencies.recordSuccess).not.toHaveBeenCalled();
  });

  it("performs a dummy verification for malformed input without querying a user", async () => {
    const dependencies = authDependencies();

    await expect(
      authenticateCredentials(
        { email: "not-an-email", password: "short" },
        "198.51.100.5",
        dependencies,
      ),
    ).resolves.toBeNull();
    expect(dependencies.verifyPassword).toHaveBeenCalledWith(null, "short");
    expect(dependencies.findCredentialsByEmail).not.toHaveBeenCalled();
  });

  it("fails closed when rate limiting is unavailable", async () => {
    const failure = new AppError("Unavailable", "RATE_LIMIT_UNAVAILABLE", 503, true);
    const dependencies = authDependencies({
      rateLimit: vi.fn().mockRejectedValue(failure),
    });

    await expect(
      authenticateCredentials(
        { email: credentialUser.email, password: "correct horse battery staple" },
        "198.51.100.6",
        dependencies,
      ),
    ).rejects.toBe(failure);
    expect(dependencies.findCredentialsByEmail).not.toHaveBeenCalled();
  });

  it("denies a password-reset race when the verified digest is no longer current", async () => {
    const dependencies = authDependencies({ recordSuccess: vi.fn().mockResolvedValue(null) });

    await expect(
      authenticateCredentials(
        { email: credentialUser.email, password: "correct horse battery staple" },
        "198.51.100.7",
        dependencies,
      ),
    ).resolves.toBeNull();
  });

  it("upgrades an obsolete digest and denies a concurrent replacement race", async () => {
    const legacyUser = { ...credentialUser, passwordHash: "obsolete-digest" };
    const dependencies = authDependencies({
      findCredentialsByEmail: vi.fn().mockResolvedValue(legacyUser),
      replaceHash: vi.fn().mockResolvedValue(false),
    });

    await expect(
      authenticateCredentials(
        { email: credentialUser.email, password: "correct horse battery staple" },
        "198.51.100.8",
        dependencies,
      ),
    ).resolves.toBeNull();
    expect(dependencies.hashPassword).toHaveBeenCalledWith("correct horse battery staple");
    expect(dependencies.replaceHash).toHaveBeenCalledWith(
      credentialUser.id,
      "obsolete-digest",
      "replacement-hash",
    );
  });
});

describe("account registration service", () => {
  function registrationDependencies(overrides: Record<string, unknown> = {}) {
    return {
      rateLimit: vi.fn().mockResolvedValue({ success: true }),
      hashPassword: vi.fn().mockResolvedValue(CURRENT_PASSWORD_HASH),
      createUser: vi.fn().mockResolvedValue({
        id: credentialUser.id,
        email: credentialUser.email,
        displayName: credentialUser.displayName,
        role: "user" as const,
        status: "active" as const,
        sessionVersion: 0,
      }),
      ...overrides,
    };
  }

  it("strips an attempted role escalation before persistence", async () => {
    const dependencies = registrationDependencies();
    const result = await registerAccount(
      {
        name: "Person Example",
        email: " PERSON@EXAMPLE.COM ",
        password: "correct horse battery staple",
        role: "admin",
      },
      "203.0.113.9",
      dependencies,
    );

    expect(result.role).toBe("user");
    expect(dependencies.createUser).toHaveBeenCalledWith({
      email: "person@example.com",
      displayName: "Person Example",
      passwordHash: CURRENT_PASSWORD_HASH,
    });
    expect(dependencies.createUser.mock.calls[0]?.[0]).not.toHaveProperty("role");
  });

  it("returns the same safe error for a duplicate identity", async () => {
    const duplicate = Object.assign(new Error("unique users_email_unique"), { code: "23505" });
    const dependencies = registrationDependencies({
      createUser: vi.fn().mockRejectedValue(duplicate),
    });

    await expect(
      registerAccount(
        {
          name: "Person Example",
          email: credentialUser.email,
          password: "correct horse battery staple",
        },
        "203.0.113.10",
        dependencies,
      ),
    ).rejects.toMatchObject({
      code: "REGISTRATION_FAILED",
      status: 409,
      message: "We could not create this account. Check the details or sign in.",
    });
  });

  it("validates before hashing or inserting but still consumes a rate-limit attempt", async () => {
    const dependencies = registrationDependencies();

    await expect(
      registerAccount(
        { name: "X", email: "bad", password: "short", role: "admin" },
        "203.0.113.11",
        dependencies,
      ),
    ).rejects.toHaveProperty("name", "ZodError");
    expect(dependencies.rateLimit).toHaveBeenCalledOnce();
    expect(dependencies.hashPassword).not.toHaveBeenCalled();
    expect(dependencies.createUser).not.toHaveBeenCalled();
  });
});

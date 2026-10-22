import "server-only";

import { createHash } from "node:crypto";

import { AppError } from "@/server/http/errors";
import { getDatabase } from "@/server/db/client";
import {
  createUser,
  findUserCredentialsByEmail,
  hasDatabaseErrorCode,
  recordFailedLogin,
  recordSuccessfulLogin,
  replacePasswordHash,
} from "@/server/db/repositories";
import { enforceRateLimit } from "@/server/rate-limit/rate-limit";

import {
  hashPassword,
  passwordHashNeedsUpgrade,
  verifyPasswordOrDummy,
} from "./password";
import { normalizeEmail, registrationSchema, signInSchema } from "./schemas";

type UserRole = "user" | "admin";
type UserStatus = "active" | "disabled";

export type AuthenticatedIdentity = {
  id: string;
  role: UserRole;
  status: "active";
  sessionVersion: number;
};

export type RegisteredAccount = AuthenticatedIdentity & {
  email: string;
  displayName: string;
};

type CredentialUser = {
  id: string;
  email: string;
  displayName: string;
  passwordHash: string;
  role: UserRole;
  status: UserStatus;
  sessionVersion: number;
  failedAuthAttempts: number;
  lockedUntil: Date | null;
};

type SafeCreatedUser = Omit<CredentialUser, "passwordHash" | "failedAuthAttempts" | "lockedUntil">;

type AuthDependencies = {
  rateLimit: (kind: "sign-in-ip" | "sign-in-account", identifier: string) => Promise<unknown>;
  findCredentialsByEmail: (email: string) => Promise<CredentialUser | null>;
  recordFailure: (userId: string) => Promise<void>;
  recordSuccess: (userId: string, verifiedPasswordHash: string) => Promise<SafeCreatedUser | null>;
  replaceHash: (
    userId: string,
    currentPasswordHash: string,
    nextPasswordHash: string,
  ) => Promise<boolean>;
  verifyPassword: typeof verifyPasswordOrDummy;
  hashPassword: typeof hashPassword;
  now: () => Date;
};

type RegistrationDependencies = {
  rateLimit: (kind: "registration", identifier: string) => Promise<unknown>;
  hashPassword: typeof hashPassword;
  createUser: (input: {
    email: string;
    displayName: string;
    passwordHash: string;
  }) => Promise<SafeCreatedUser>;
};

const defaultAuthDependencies: AuthDependencies = {
  rateLimit: enforceRateLimit,
  findCredentialsByEmail: (email) => findUserCredentialsByEmail(getDatabase(), email),
  recordFailure: (userId) => recordFailedLogin(getDatabase(), userId),
  recordSuccess: (userId, passwordHash) =>
    recordSuccessfulLogin(getDatabase(), userId, passwordHash),
  replaceHash: (userId, currentHash, nextHash) =>
    replacePasswordHash(getDatabase(), userId, currentHash, nextHash),
  verifyPassword: verifyPasswordOrDummy,
  hashPassword,
  now: () => new Date(),
};

const defaultRegistrationDependencies: RegistrationDependencies = {
  rateLimit: enforceRateLimit,
  hashPassword,
  createUser: (input) => createUser(getDatabase(), input),
};

/**
 * Verifies credentials without exposing whether the account exists, is disabled,
 * or is currently locked. Operational failures intentionally propagate so the
 * Auth.js boundary can fail closed with a generic service message.
 */
export async function authenticateCredentials(
  rawCredentials: unknown,
  clientAddress: string,
  dependencies: AuthDependencies = defaultAuthDependencies,
): Promise<AuthenticatedIdentity | null> {
  const emailCandidate = readBoundedString(rawCredentials, "email", 512);
  const passwordCandidate = readBoundedString(rawCredentials, "password", 256);

  await Promise.all([
    dependencies.rateLimit("sign-in-ip", privateRateLimitKey("ip", clientAddress)),
    dependencies.rateLimit(
      "sign-in-account",
      privateRateLimitKey("account", normalizeEmail(emailCandidate ?? "invalid")),
    ),
  ]);

  const parsed = signInSchema.safeParse({
    email: emailCandidate,
    password: passwordCandidate,
  });

  if (!parsed.success) {
    // Keep malformed and unknown-account requests on the Argon2 path.
    await dependencies.verifyPassword(null, passwordCandidate ?? "invalid credentials");
    return null;
  }

  const user = await dependencies.findCredentialsByEmail(parsed.data.email);
  const passwordMatches = await dependencies.verifyPassword(
    user?.passwordHash ?? null,
    parsed.data.password,
  );

  if (!user) {
    return null;
  }

  const isLocked = Boolean(user.lockedUntil && user.lockedUntil > dependencies.now());
  if (!passwordMatches) {
    if (user.status === "active" && !isLocked) {
      await dependencies.recordFailure(user.id);
    }
    return null;
  }

  if (user.status !== "active" || isLocked) {
    return null;
  }

  // The repository predicates on the verified digest, closing password-reset races.
  const currentUser = await dependencies.recordSuccess(user.id, user.passwordHash);
  if (!currentUser || currentUser.status !== "active") {
    return null;
  }

  if (passwordHashNeedsUpgrade(user.passwordHash)) {
    const replacementHash = await dependencies.hashPassword(parsed.data.password);
    const replaced = await dependencies.replaceHash(
      user.id,
      user.passwordHash,
      replacementHash,
    );
    if (!replaced) {
      return null;
    }
  }

  return {
    id: currentUser.id,
    role: currentUser.role,
    status: "active",
    sessionVersion: currentUser.sessionVersion,
  };
}

export async function registerAccount(
  rawInput: unknown,
  clientAddress: string,
  dependencies: RegistrationDependencies = defaultRegistrationDependencies,
): Promise<RegisteredAccount> {
  await dependencies.rateLimit("registration", privateRateLimitKey("ip", clientAddress));
  const input = registrationSchema.parse(rawInput);
  const passwordHash = await dependencies.hashPassword(input.password);

  try {
    const user = await dependencies.createUser({
      email: input.email,
      displayName: input.name,
      passwordHash,
    });

    return {
      id: user.id,
      email: user.email,
      displayName: user.displayName,
      role: user.role,
      status: "active",
      sessionVersion: user.sessionVersion,
    };
  } catch (error) {
    if (hasDatabaseErrorCode(error, "23505")) {
      throw new AppError(
        "We could not create this account. Check the details or sign in.",
        "REGISTRATION_FAILED",
        409,
        false,
      );
    }
    throw error;
  }
}

function readBoundedString(value: unknown, key: string, maximumLength: number) {
  if (!value || typeof value !== "object") return null;
  const candidate = Reflect.get(value, key);
  return typeof candidate === "string" && candidate.length <= maximumLength ? candidate : null;
}

function privateRateLimitKey(namespace: string, value: string) {
  const digest = createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
  return `${namespace}:${digest}`;
}


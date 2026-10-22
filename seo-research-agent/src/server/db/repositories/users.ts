import { and, eq, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { users } from "../schema";

const MAX_FAILED_AUTH_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 15;

const safeUserSelection = {
  id: users.id,
  email: users.email,
  displayName: users.displayName,
  role: users.role,
  status: users.status,
  sessionVersion: users.sessionVersion,
  emailVerifiedAt: users.emailVerifiedAt,
  lastLoginAt: users.lastLoginAt,
  createdAt: users.createdAt,
  updatedAt: users.updatedAt,
};

const credentialUserSelection = {
  ...safeUserSelection,
  passwordHash: users.passwordHash,
  failedAuthAttempts: users.failedAuthAttempts,
  lockedUntil: users.lockedUntil,
};

export type CreateUserInput = {
  email: string;
  displayName: string;
  passwordHash: string;
};

export async function findUserById(database: DatabaseClient, userId: string) {
  const [user] = await database
    .select(safeUserSelection)
    .from(users)
    .where(eq(users.id, userId))
    .limit(1);
  return user ?? null;
}

export async function findUserByEmail(database: DatabaseClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await database
    .select(safeUserSelection)
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  return user ?? null;
}

/** Authentication-only projection. Keep this out of pages and API responses. */
export async function findUserCredentialsByEmail(database: DatabaseClient, email: string) {
  const normalizedEmail = email.trim().toLowerCase();
  const [user] = await database
    .select(credentialUserSelection)
    .from(users)
    .where(eq(users.email, normalizedEmail))
    .limit(1);
  return user ?? null;
}

export async function createUser(database: DatabaseClient, input: CreateUserInput) {
  const [user] = await database
    .insert(users)
    .values({
      email: input.email.trim().toLowerCase(),
      displayName: input.displayName.trim(),
      passwordHash: input.passwordHash,
      // Defense in depth: self-registration can never choose an elevated role.
      role: "user",
    })
    .returning(safeUserSelection);

  if (!user) {
    throw new Error("The user could not be created.");
  }

  return user;
}

/** Atomically increments failures and applies a bounded lock after repeated attempts. */
export async function recordFailedLogin(database: DatabaseClient, userId: string) {
  const nextAttemptCount = sql<number>`case
    when ${users.lockedUntil} is not null and ${users.lockedUntil} <= now() then 1
    else least(${users.failedAuthAttempts} + 1, 100)
  end`;

  await database
    .update(users)
    .set({
      failedAuthAttempts: nextAttemptCount,
      lockedUntil: sql<Date | null>`case
        when ${nextAttemptCount} >= ${MAX_FAILED_AUTH_ATTEMPTS}
          then now() + (${LOCK_DURATION_MINUTES} * interval '1 minute')
        when ${users.lockedUntil} is not null and ${users.lockedUntil} <= now()
          then null
        else ${users.lockedUntil}
      end`,
      updatedAt: new Date(),
    })
    .where(and(eq(users.id, userId), eq(users.status, "active")));
}

/** A successful authentication clears the lock counter in the same write. */
export async function recordSuccessfulLogin(
  database: DatabaseClient,
  userId: string,
  verifiedPasswordHash: string,
) {
  const [user] = await database
    .update(users)
    .set({
      failedAuthAttempts: 0,
      lockedUntil: null,
      lastLoginAt: new Date(),
      updatedAt: new Date(),
    })
    .where(
      and(
        eq(users.id, userId),
        eq(users.status, "active"),
        eq(users.passwordHash, verifiedPasswordHash),
      ),
    )
    .returning(safeUserSelection);

  return user ?? null;
}

/** Replaces an obsolete digest only if another request has not already changed it. */
export async function replacePasswordHash(
  database: DatabaseClient,
  userId: string,
  currentPasswordHash: string,
  nextPasswordHash: string,
) {
  const [updated] = await database
    .update(users)
    .set({ passwordHash: nextPasswordHash, updatedAt: new Date() })
    .where(and(eq(users.id, userId), eq(users.passwordHash, currentPasswordHash)))
    .returning({ id: users.id });

  return Boolean(updated);
}

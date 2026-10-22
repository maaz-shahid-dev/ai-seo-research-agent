import type { PGlite } from "@electric-sql/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/server/db/client";
import {
  createUser,
  findUserByEmail,
  findUserById,
  findUserCredentialsByEmail,
  recordFailedLogin,
  recordSuccessfulLogin,
  replacePasswordHash,
  type CreateUserInput,
} from "@/server/db/repositories/users";
import { createTestDatabase, PGLITE_SETUP_TIMEOUT_MS } from "../helpers/pglite";

const PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$fixture$fixturefixturefixture";
const NEW_PASSWORD_HASH = "$argon2id$v=19$m=19456,t=3,p=1$fixture$newfixturefixturefixture";

describe("authentication user repository", () => {
  let client: PGlite;
  let repositoryDatabase: DatabaseClient;

  beforeAll(async () => {
    ({ client, repositoryDatabase } = await createTestDatabase());
  }, PGLITE_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await client.close();
  });

  it("forces self-registered users to the user role and returns safe projections", async () => {
    const maliciousInput = {
      email: "PERSON@EXAMPLE.COM",
      displayName: " Person Example ",
      passwordHash: PASSWORD_HASH,
      role: "admin",
    } as CreateUserInput & { role: "admin" };

    const created = await createUser(repositoryDatabase, maliciousInput);
    expect(created).toMatchObject({
      email: "person@example.com",
      displayName: "Person Example",
      role: "user",
      status: "active",
    });
    expect(created).not.toHaveProperty("passwordHash");

    const byId = await findUserById(repositoryDatabase, created.id);
    const byEmail = await findUserByEmail(repositoryDatabase, " PERSON@EXAMPLE.COM ");
    expect(byId).not.toHaveProperty("passwordHash");
    expect(byEmail?.id).toBe(created.id);

    const credentials = await findUserCredentialsByEmail(
      repositoryDatabase,
      "person@example.com",
    );
    expect(credentials?.passwordHash).toBe(PASSWORD_HASH);
  });

  it("locks repeated failures and clears the counter only with the verified digest", async () => {
    const user = await findUserCredentialsByEmail(repositoryDatabase, "person@example.com");
    expect(user).not.toBeNull();

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await recordFailedLogin(repositoryDatabase, user!.id);
    }

    const locked = await findUserCredentialsByEmail(repositoryDatabase, "person@example.com");
    expect(locked?.failedAuthAttempts).toBe(5);
    expect(locked?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());

    await expect(
      recordSuccessfulLogin(repositoryDatabase, user!.id, NEW_PASSWORD_HASH),
    ).resolves.toBeNull();
    const stillLocked = await findUserCredentialsByEmail(repositoryDatabase, "person@example.com");
    expect(stillLocked?.failedAuthAttempts).toBe(5);

    const authenticated = await recordSuccessfulLogin(
      repositoryDatabase,
      user!.id,
      PASSWORD_HASH,
    );
    expect(authenticated?.id).toBe(user!.id);
    const cleared = await findUserCredentialsByEmail(repositoryDatabase, "person@example.com");
    expect(cleared?.failedAuthAttempts).toBe(0);
    expect(cleared?.lockedUntil).toBeNull();
    expect(cleared?.lastLoginAt).toBeInstanceOf(Date);
  });

  it("updates password digests with optimistic concurrency", async () => {
    const user = await findUserCredentialsByEmail(repositoryDatabase, "person@example.com");
    expect(user).not.toBeNull();

    await expect(
      replacePasswordHash(repositoryDatabase, user!.id, "stale-digest", NEW_PASSWORD_HASH),
    ).resolves.toBe(false);
    await expect(
      replacePasswordHash(repositoryDatabase, user!.id, PASSWORD_HASH, NEW_PASSWORD_HASH),
    ).resolves.toBe(true);

    const updated = await findUserCredentialsByEmail(repositoryDatabase, "person@example.com");
    expect(updated?.passwordHash).toBe(NEW_PASSWORD_HASH);
  });
});

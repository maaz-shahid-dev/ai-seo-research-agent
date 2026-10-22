import type { PGlite } from "@electric-sql/pglite";
import type { PgliteDatabase } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/server/db/client";
import { getUserSettings, updateUserSettings } from "@/server/db/repositories";
import * as schema from "@/server/db/schema";
import { createTestDatabase, PGLITE_SETUP_TIMEOUT_MS } from "../helpers/pglite";

describe("user settings", () => {
  let client: PGlite;
  let repo: DatabaseClient;
  let database: PgliteDatabase<typeof schema>;
  const USER = "10000000-0000-4000-8000-0000000000d1";

  beforeAll(async () => {
    ({ client, database, repositoryDatabase: repo } = await createTestDatabase());
    await database.insert(schema.users).values({ id: USER, email: "settings@example.test", displayName: "Set", passwordHash: "$argon2id$v=19$m=19456,t=2,p=1$a$b" });
  }, PGLITE_SETUP_TIMEOUT_MS);

  afterAll(async () => {
    await client.close();
  });

  it("defaults, updates only given fields, and enforces allowed values in the database", async () => {
    expect(await getUserSettings(repo, USER)).toEqual({ email: "settings@example.test", displayName: "Set", defaultCountryCode: null, theme: "light", tableDensity: "comfortable" });

    expect(await updateUserSettings(repo, USER, { theme: "dark", defaultCountryCode: "PK" })).toMatchObject({ displayName: "Set", theme: "dark", defaultCountryCode: "PK", tableDensity: "comfortable" });
    expect(await updateUserSettings(repo, USER, { defaultCountryCode: null })).toMatchObject({ defaultCountryCode: null, theme: "dark" });

    await expect(updateUserSettings(repo, USER, { theme: "blue" as never })).rejects.toThrow();
    await expect(updateUserSettings(repo, USER, { defaultCountryCode: "pk" })).rejects.toThrow();
    expect(await updateUserSettings(repo, "10000000-0000-4000-8000-0000000000ff", { theme: "dark" })).toBeNull();
  });
});

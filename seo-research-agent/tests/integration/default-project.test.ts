import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { afterAll, beforeAll, describe, expect, it } from "vitest";

import type { DatabaseClient } from "@/server/db/client";
import {
  archiveProject,
  createProject,
  DEFAULT_PROJECT_NAME,
  ensureDefaultProject,
  listProjects,
} from "@/server/db/repositories/projects";
import { createUser } from "@/server/db/repositories/users";
import * as schema from "@/server/db/schema";
import { applyMigrations } from "../helpers/pglite";

const PASSWORD_HASH = "$argon2id$v=19$m=19456,t=2,p=1$fixture$fixturefixturefixture";

describe("default project provisioning", () => {
  let client: PGlite;
  let database: DatabaseClient;

  beforeAll(async () => {
    client = new PGlite();
    await applyMigrations(client);
    database = drizzle(client, { schema, casing: "snake_case" }) as unknown as DatabaseClient;
  }, 30_000);

  afterAll(async () => {
    await client.close();
  });

  async function newOwner(email: string) {
    const user = await createUser(database, {
      email,
      displayName: "Owner",
      passwordHash: PASSWORD_HASH,
    });
    return user.id;
  }

  it("creates exactly one US/en project for an empty workspace, even when repeated", async () => {
    const ownerId = await newOwner("empty@example.com");

    await Promise.all([
      ensureDefaultProject(database, ownerId),
      ensureDefaultProject(database, ownerId),
    ]);
    await ensureDefaultProject(database, ownerId);

    const { items } = await listProjects(database, ownerId);
    expect(items).toHaveLength(1);
    expect(items[0]).toMatchObject({
      name: DEFAULT_PROJECT_NAME,
      defaultCountryCode: "US",
      defaultLanguageCode: "en",
      status: "active",
    });
  });

  it("leaves owners who already have projects, including archived ones, untouched", async () => {
    const ownerId = await newOwner("existing@example.com");
    const project = await createProject(database, ownerId, { name: "Acme" });
    await archiveProject(database, ownerId, project.id, project.version);

    await ensureDefaultProject(database, ownerId);

    const { items } = await listProjects(database, ownerId);
    expect(items.map((item) => item.name)).toEqual(["Acme"]);
  });

  it("does not create projects for other owners", async () => {
    const ownerId = await newOwner("first@example.com");
    const otherOwnerId = await newOwner("second@example.com");

    await ensureDefaultProject(database, ownerId);

    expect((await listProjects(database, otherOwnerId)).items).toHaveLength(0);
  });
});

import { PGlite } from "@electric-sql/pglite";
import { drizzle } from "drizzle-orm/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

import type { DatabaseClient } from "@/server/db/client";
import * as schema from "@/server/db/schema";

/** Booting PGlite and applying every migration is slow when workers run in parallel. */
export const PGLITE_SETUP_TIMEOUT_MS = 90_000;

/** An in-memory PostgreSQL with all committed migrations applied. */
export async function createTestDatabase() {
  const client = new PGlite();
  await applyMigrations(client);
  const database = drizzle(client, { schema, casing: "snake_case" });
  // Repositories are typed for Neon; PGlite implements the same query surface.
  return { client, database, repositoryDatabase: database as unknown as DatabaseClient };
}

export async function applyMigrations(client: PGlite) {
  const migrationDirectory = fileURLToPath(new URL("../../drizzle/", import.meta.url));
  const migrationFiles = readdirSync(migrationDirectory)
    .filter((fileName) => fileName.endsWith(".sql"))
    .sort();

  if (migrationFiles.length === 0) {
    throw new Error("No SQL migrations were found.");
  }

  for (const fileName of migrationFiles) {
    const migrationSql = readFileSync(new URL(`../../drizzle/${fileName}`, import.meta.url), "utf8");
    const statements = migrationSql
      .split("--> statement-breakpoint")
      .map((statement) => statement.trim())
      .filter(Boolean);

    for (const statement of statements) {
      await client.exec(statement);
    }
  }
}

import type { PGlite } from "@electric-sql/pglite";
import { readFileSync, readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";

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

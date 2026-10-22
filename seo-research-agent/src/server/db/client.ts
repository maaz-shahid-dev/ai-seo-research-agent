import "server-only";

import { neon } from "@neondatabase/serverless";
import { drizzle, type NeonHttpDatabase } from "drizzle-orm/neon-http";

import { runtimeEnvironmentSchema } from "@/server/config/environment-schema";

import * as schema from "./schema";

export type DatabaseClient = NeonHttpDatabase<typeof schema>;

let database: DatabaseClient | undefined;

/** Creates the HTTP database client on first use, never during import or build. */
export function getDatabase(): DatabaseClient {
  if (database) {
    return database;
  }

  const { DATABASE_URL } = runtimeEnvironmentSchema.pick({ DATABASE_URL: true }).parse(process.env);
  const queryClient = neon(DATABASE_URL);
  database = drizzle(queryClient, { schema, casing: "snake_case" });

  return database;
}

/**
 * Applies committed SQL migrations from ./drizzle inside a transaction.
 *
 *   npm run db:migrate              always migrates (local or release use)
 *   npm run db:migrate -- --deploy  migrates only on Vercel production builds
 */
import { Pool, neonConfig } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import { migrate } from "drizzle-orm/neon-serverless/migrator";

import { planMigration } from "./migration-policy";

async function main() {
  const mode = process.argv.includes("--deploy") ? "deploy" : "manual";
  const plan = planMigration(process.env, mode);

  if (plan.action === "skip") {
    console.log(plan.reason);
    return;
  }
  if (plan.action === "fail") {
    throw new Error(plan.reason);
  }

  // Node 22 provides a global WebSocket, which the pooled driver needs for transactions.
  neonConfig.webSocketConstructor = WebSocket;
  const pool = new Pool({ connectionString: plan.url });
  try {
    await migrate(drizzle({ client: pool }), { migrationsFolder: "./drizzle" });
    console.log("Database migrations are up to date.");
  } finally {
    await pool.end();
  }
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});

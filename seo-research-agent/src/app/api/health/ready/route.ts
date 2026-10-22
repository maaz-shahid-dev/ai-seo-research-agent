import { sql } from "drizzle-orm";

import { getEnvironmentReadiness } from "@/server/config/environment";
import { getDatabase } from "@/server/db/client";
import { logger } from "@/server/logging/logger";

export async function GET() {
  const environment = getEnvironmentReadiness();
  if (!environment.ready) {
    return readinessResponse(false);
  }

  try {
    await Promise.race([
      getDatabase().execute(sql`select 1`),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("Database readiness timed out")), 3_000),
      ),
    ]);
    return readinessResponse(true);
  } catch (error) {
    logger.error({ error }, "Readiness check failed");
    return readinessResponse(false);
  }
}

function readinessResponse(ready: boolean) {
  return Response.json(
    { status: ready ? "ready" : "unavailable" },
    {
      status: ready ? 200 : 503,
      headers: { "cache-control": "no-store" },
    },
  );
}

import { afterEach, describe, expect, it, vi } from "vitest";
import {
  listMissingEnvironmentKeys,
  productionEnvironmentKeys,
  runtimeReadinessKeys,
  runtimeEnvironmentSchema,
} from "@/server/config/environment-schema";

describe("runtime environment", () => {
  it("accepts a PostgreSQL URL and a sufficiently long auth secret", () => {
    const parsed = runtimeEnvironmentSchema.parse({
      NODE_ENV: "test",
      DATABASE_URL: "postgresql://app:secret@localhost:5432/seo",
      AUTH_SECRET: "a".repeat(32),
    });

    expect(parsed.LOG_LEVEL).toBe("info");
  });

  it.each([
    "https://example.com/database",
    "mysql://localhost/database",
    "not-a-url",
  ])("rejects a non-PostgreSQL database URL: %s", (databaseUrl) => {
    expect(() =>
      runtimeEnvironmentSchema.parse({
        DATABASE_URL: databaseUrl,
        AUTH_SECRET: "a".repeat(32),
      }),
    ).toThrow();
  });

  it("reports only missing or blank required variables", () => {
    expect(
      listMissingEnvironmentKeys(
        { DATABASE_URL: "postgres://example", AUTH_SECRET: "   " },
        ["DATABASE_URL", "AUTH_SECRET", "OPENAI_API_KEY"],
      ),
    ).toEqual(["AUTH_SECRET", "OPENAI_API_KEY"]);
  });

  it("keeps migration credentials out of runtime readiness", () => {
    expect(runtimeReadinessKeys).not.toContain("MIGRATION_DATABASE_URL");
    expect(productionEnvironmentKeys).toContain("MIGRATION_DATABASE_URL");
  });
});

describe("research service configuration", () => {
  const keys = ["INNGEST_EVENT_KEY", "INNGEST_SIGNING_KEY", "DATAFORSEO_LOGIN", "DATAFORSEO_PASSWORD"];

  afterEach(() => vi.unstubAllEnvs());

  it("is ready only when the job queue and SEO provider credentials are set", async () => {
    const { isResearchConfigured } = await import("@/server/config/environment");
    for (const key of keys) vi.stubEnv(key, "configured");
    expect(isResearchConfigured()).toBe(true);

    vi.stubEnv("DATAFORSEO_PASSWORD", " ");
    expect(isResearchConfigured()).toBe(false);
  });
});

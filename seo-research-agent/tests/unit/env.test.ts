import { describe, expect, it } from "vitest";
import {
  listMissingEnvironmentKeys,
  runtimeEnvironmentSchema,
} from "@/server/env/schema";

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
});

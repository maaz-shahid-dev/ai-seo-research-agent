import { describe, expect, it } from "vitest";

import { planMigration } from "../../scripts/migration-policy";

const url = "postgresql://owner:secret@db.example.com/app";

describe("migration policy", () => {
  it("skips deploy builds outside Vercel production", () => {
    expect(planMigration({ VERCEL_ENV: "preview", MIGRATION_DATABASE_URL: url }, "deploy").action)
      .toBe("skip");
    expect(planMigration({ MIGRATION_DATABASE_URL: url }, "deploy").action).toBe("skip");
  });

  it("migrates production deploys and manual runs when a URL is present", () => {
    expect(planMigration({ VERCEL_ENV: "production", MIGRATION_DATABASE_URL: url }, "deploy"))
      .toEqual({ action: "migrate", url });
    expect(planMigration({ MIGRATION_DATABASE_URL: ` ${url} ` }, "manual"))
      .toEqual({ action: "migrate", url });
  });

  it("fails production deploys that are missing a migration URL", () => {
    expect(planMigration({ VERCEL_ENV: "production" }, "deploy")).toMatchObject({ action: "fail" });
    expect(planMigration({ MIGRATION_DATABASE_URL: "  " }, "manual")).toMatchObject({ action: "fail" });
  });

  it("rejects non-PostgreSQL URLs", () => {
    expect(planMigration({ MIGRATION_DATABASE_URL: "mysql://x@y/z" }, "manual"))
      .toMatchObject({ action: "fail" });
  });
});

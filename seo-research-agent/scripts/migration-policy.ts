/**
 * Decides whether a build should apply database migrations.
 *
 * Only Vercel production builds migrate automatically, so preview deployments
 * can never change the production schema. A production build without a
 * migration URL fails instead of shipping code against an outdated schema.
 */
export type MigrationPlan =
  | { action: "migrate"; url: string }
  | { action: "skip"; reason: string }
  | { action: "fail"; reason: string };

type Environment = Readonly<Record<string, string | undefined>>;

export function planMigration(environment: Environment, mode: "deploy" | "manual"): MigrationPlan {
  const url = environment.MIGRATION_DATABASE_URL?.trim();

  if (mode === "deploy" && environment.VERCEL_ENV !== "production") {
    return { action: "skip", reason: "Not a production deployment; migrations skipped." };
  }

  if (!url) {
    return { action: "fail", reason: "MIGRATION_DATABASE_URL is required to run migrations." };
  }

  if (!/^postgres(ql)?:\/\//.test(url)) {
    return { action: "fail", reason: "MIGRATION_DATABASE_URL must be a PostgreSQL URL." };
  }

  return { action: "migrate", url };
}

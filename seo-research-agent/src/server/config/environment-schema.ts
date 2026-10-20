import { z } from "zod";

const logLevels = ["fatal", "error", "warn", "info", "debug", "trace", "silent"] as const;

const nonEmptySecret = z.string().trim().min(1);

export const runtimeEnvironmentSchema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  DATABASE_URL: z.string().trim().url().refine(isPostgresUrl, "Must be a PostgreSQL URL"),
  AUTH_SECRET: z.string().min(32, "Must contain at least 32 characters"),
  LOG_LEVEL: z.enum(logLevels).default("info"),
});

export const migrationEnvironmentSchema = z.object({
  MIGRATION_DATABASE_URL: z
    .string()
    .trim()
    .url()
    .refine(isPostgresUrl, "Must be a PostgreSQL URL"),
});

export const upstashEnvironmentSchema = z.object({
  UPSTASH_REDIS_REST_URL: z.string().trim().url().startsWith("https://"),
  UPSTASH_REDIS_REST_TOKEN: nonEmptySecret,
});

export const inngestEnvironmentSchema = z.object({
  INNGEST_EVENT_KEY: nonEmptySecret,
  INNGEST_SIGNING_KEY: nonEmptySecret,
});

export const dataForSeoEnvironmentSchema = z.object({
  DATAFORSEO_LOGIN: nonEmptySecret,
  DATAFORSEO_PASSWORD: nonEmptySecret,
});

export const openAiEnvironmentSchema = z.object({
  OPENAI_API_KEY: nonEmptySecret,
  OPENAI_MODEL: z.string().trim().min(1).max(100),
});

export const productionEnvironmentKeys = [
  "DATABASE_URL",
  "MIGRATION_DATABASE_URL",
  "AUTH_SECRET",
  "UPSTASH_REDIS_REST_URL",
  "UPSTASH_REDIS_REST_TOKEN",
  "INNGEST_EVENT_KEY",
  "INNGEST_SIGNING_KEY",
  "DATAFORSEO_LOGIN",
  "DATAFORSEO_PASSWORD",
  "OPENAI_API_KEY",
  "OPENAI_MODEL",
] as const;

export type RuntimeEnvironment = z.infer<typeof runtimeEnvironmentSchema>;

export function listMissingEnvironmentKeys(
  source: Record<string, string | undefined>,
  keys: readonly string[] = productionEnvironmentKeys,
) {
  return keys.filter((key) => !source[key]?.trim());
}

function isPostgresUrl(value: string) {
  try {
    const protocol = new URL(value).protocol;
    return protocol === "postgres:" || protocol === "postgresql:";
  } catch {
    return false;
  }
}

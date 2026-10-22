import "server-only";

import {
  dataForSeoEnvironmentSchema,
  inngestEnvironmentSchema,
  isDemoMode,
  listMissingEnvironmentKeys,
  migrationEnvironmentSchema,
  openAiEnvironmentSchema,
  listMissingResearchKeys,
  runtimeReadinessKeys,
  runtimeEnvironmentSchema,
  upstashEnvironmentSchema,
} from "./environment-schema";

export function getRuntimeEnvironment() {
  return runtimeEnvironmentSchema.parse(process.env);
}

export function getMigrationEnvironment() {
  return migrationEnvironmentSchema.parse(process.env);
}

export function getUpstashEnvironment() {
  return upstashEnvironmentSchema.parse(process.env);
}

export function getInngestEnvironment() {
  return inngestEnvironmentSchema.parse(process.env);
}

export function getDataForSeoEnvironment() {
  return dataForSeoEnvironmentSchema.parse(process.env);
}

export function getOpenAiEnvironment() {
  if (isDemoMode(process.env) && !process.env.OPENAI_API_KEY?.trim()) {
    return { OPENAI_API_KEY: "demo", OPENAI_MODEL: process.env.OPENAI_MODEL?.trim() || "demo-analysis" };
  }
  return openAiEnvironmentSchema.parse(process.env);
}

/** Whether AI features can run: real OpenAI keys, or demo mode. */
export function isOpenAiAvailable() {
  return isDemoMode(process.env) || listMissingEnvironmentKeys(process.env, ["OPENAI_API_KEY", "OPENAI_MODEL"]).length === 0;
}

export function isResearchConfigured() {
  return listMissingResearchKeys(process.env).length === 0;
}

export function getEnvironmentReadiness() {
  const missing = listMissingEnvironmentKeys(process.env, runtimeReadinessKeys);
  return { ready: missing.length === 0, missing };
}

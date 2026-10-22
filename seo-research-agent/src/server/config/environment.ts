import "server-only";

import {
  dataForSeoEnvironmentSchema,
  inngestEnvironmentSchema,
  listMissingEnvironmentKeys,
  migrationEnvironmentSchema,
  openAiEnvironmentSchema,
  researchServiceKeys,
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
  return openAiEnvironmentSchema.parse(process.env);
}

export function isResearchConfigured() {
  return listMissingEnvironmentKeys(process.env, researchServiceKeys).length === 0;
}

export function getEnvironmentReadiness() {
  const missing = listMissingEnvironmentKeys(process.env, runtimeReadinessKeys);
  return { ready: missing.length === 0, missing };
}

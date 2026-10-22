import "server-only";

import { isDemoMode } from "@/server/config/environment-schema";

import { createDataForSeoClient as createLiveDataForSeoClient, type DataForSeoClientOptions } from "./dataforseo/client";
import { createDemoDataForSeoClient } from "./demo/dataforseo";
import { createDemoOpenAiClient } from "./demo/openai";
import { createOpenAiAnalysisClient as createLiveOpenAiClient, type OpenAiAnalysisClientOptions } from "./openai/analysis";

export { DEFAULT_DATAFORSEO_TIMEOUT_MS, isRetryableDataForSeoStatus } from "./dataforseo/client";
export { isRetryableOpenAiCode } from "./openai/analysis";

/** The DataForSEO client for this environment: live, or the demo generator when DEMO_DATA=true. */
export function createDataForSeoClient(options?: DataForSeoClientOptions) {
  return isDemoMode(process.env) ? createDemoDataForSeoClient() : createLiveDataForSeoClient(options);
}

/** The OpenAI client for this environment: live, or the demo generator when DEMO_DATA=true. */
export function createOpenAiAnalysisClient(options?: OpenAiAnalysisClientOptions) {
  return isDemoMode(process.env) ? createDemoOpenAiClient() : createLiveOpenAiClient(options);
}
export { ProviderError } from "./errors";
export type {
  DataForSeoClient,
  DataForSeoClientOptions,
} from "./dataforseo/client";
export type {
  OpenAiAnalysisClient,
  OpenAiAnalysisClientOptions,
} from "./openai/analysis";
export type {
  KeywordIdeasRequest,
  KeywordIdeasResult,
  DataForSeoPartialWarning,
  DataForSeoResultOutcome,
  NicheIdea,
  NormalizedKeywordIdea,
  NormalizedOrganicResult,
  OrganicSerpRequest,
  OrganicSerpResult,
  ProviderRequestOptions,
  ResearchAnalysis,
  ResearchAnalysisRequest,
  ResearchAnalysisResult,
  ResearchEvidence,
} from "./types";

import type { toProjectDto } from "@/features/projects/dto";

import type { toAiAnalysisDto, toKeywordDto, toResearchRunDto } from "./dto";
import type { SiteType, WeakSpot } from "./niche";

/** Client-side shapes, derived from the server DTOs so the two cannot drift. */
export type ProjectDto = ReturnType<typeof toProjectDto>;
export type ResearchRunDto = ReturnType<typeof toResearchRunDto>;
export type KeywordDto = ReturnType<typeof toKeywordDto>;
export type AiAnalysisDto = NonNullable<ReturnType<typeof toAiAnalysisDto>>;

export type ResearchDetailResponse = {
  run: ResearchRunDto;
  keywords: KeywordDto[];
  nextCursor: number | null;
  analysis: AiAnalysisDto | null;
};

/** Lifecycle shared by SERP analyses and content-gap reports. */
export type JobStatus = "queued" | "running" | "completed" | "failed";

/**
 * GET/POST /api/research/{runId}/serp/{keywordId}
 * POST requests an analysis (idempotent); GET reads it. Both return { serp }.
 */
export type SerpResultDto = {
  rank: number;
  title: string;
  url: string;
  domain: string;
  /** DataForSEO domain rank scaled to 0–100. */
  authority: number | null;
  monthlyTraffic: number | null;
  domainAgeYears: number | null;
  siteType: SiteType;
  weakSpots: WeakSpot[];
};

export type SerpAnalysisDto = {
  keywordId: number;
  status: JobStatus;
  nicheScore: number | null;
  results: SerpResultDto[];
  errorMessage: string | null;
  fetchedAt: string | null;
};

/**
 * GET/POST /api/research/{runId}/content-gap → { contentGap }
 * Keywords the top competitors rank for where the project's website does not.
 */
export type ContentGapKeywordDto = {
  keyword: string;
  searchVolume: number | null;
  difficulty: number | null;
  cpcMicros: number | null;
  competitorDomain: string;
  competitorRank: number;
};

export type ContentGapDto = {
  status: JobStatus;
  targetDomain: string;
  competitors: string[];
  keywords: ContentGapKeywordDto[];
  errorMessage: string | null;
};

export function isJobInProgress(job: { status: JobStatus } | null) {
  return job?.status === "queued" || job?.status === "running";
}

export function isRunInProgress(run: Pick<ResearchRunDto, "status">) {
  return run.status === "queued" || run.status === "running";
}

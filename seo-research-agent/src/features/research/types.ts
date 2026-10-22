import type { toProjectDto } from "@/features/projects/dto";

import type { NicheType } from "./niche-types";
import type { toAiAnalysisDto, toContentGapDto, toKeywordDto, toResearchRunDto, toSerpAnalysisDto } from "./dto";

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
  /** SERP analyses still queued or running; niche scores appear as they finish. */
  pendingSerpCount: number;
};

/** Lifecycle shared by SERP analyses and content-gap reports. */
export type JobStatus = "queued" | "running" | "completed" | "failed";

/**
 * GET/POST /api/research/{runId}/serp/{keywordId} → { serp }
 * POST requests an analysis (idempotent); GET reads it.
 */
export type SerpAnalysisDto = ReturnType<typeof toSerpAnalysisDto>;
export type SerpResultDto = SerpAnalysisDto["results"][number];

/**
 * GET/POST /api/research/{runId}/content-gap → { contentGap }
 * Keywords the top competitors rank for where the project's website does not.
 */
export type ContentGapDto = ReturnType<typeof toContentGapDto>;
export type ContentGapKeywordDto = ContentGapDto["keywords"][number];

export function isJobInProgress(job: { status: JobStatus } | null) {
  return job?.status === "queued" || job?.status === "running";
}

export function isRunInProgress(run: Pick<ResearchRunDto, "status">) {
  return run.status === "queued" || run.status === "running";
}

/** GET /api/niche-ideas */
export type NicheIdeaDto = { id: string; niche: string; seedKeyword: string; problem: string; audience: string; nicheType: NicheType };
export type NicheIdeasResponse = { date: string | null; ideas: NicheIdeaDto[] };

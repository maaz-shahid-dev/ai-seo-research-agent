import type { toProjectDto } from "@/features/projects/dto";

import type { toAiAnalysisDto, toKeywordDto, toResearchRunDto } from "./dto";

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

export function isRunInProgress(run: Pick<ResearchRunDto, "status">) {
  return run.status === "queued" || run.status === "running";
}

export function isAnalysisInProgress(analysis: Pick<AiAnalysisDto, "status"> | null) {
  return analysis?.status === "queued" || analysis?.status === "running";
}

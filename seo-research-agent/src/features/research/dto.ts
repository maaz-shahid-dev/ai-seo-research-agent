import { researchAnalysisSchema } from "@/server/providers/types";
import type { AiAnalysis, KeywordResult, ResearchRun } from "@/server/db/schema";

export function toResearchRunDto(run: ResearchRun) {
  return {
    id: run.id,
    projectId: run.projectId,
    query: run.query,
    countryCode: run.countryCode,
    languageCode: run.languageCode,
    device: run.device,
    keywordLimit: run.configuration.keywordLimit,
    status: run.status,
    version: run.version,
    progress: run.progress,
    keywordCount: run.keywordCount,
    errorCode: run.errorCode,
    errorMessage: run.errorMessage,
    createdAt: run.createdAt.toISOString(),
    updatedAt: run.updatedAt.toISOString(),
    finishedAt: run.finishedAt?.toISOString() ?? null,
  };
}

export function toKeywordDto(keyword: KeywordResult) {
  return {
    id: keyword.id,
    keyword: keyword.keyword,
    source: keyword.source,
    intent: keyword.intent,
    searchVolume: keyword.searchVolume,
    cpcMicros: keyword.cpcMicros,
    competition: keyword.competition === null ? null : Number(keyword.competition),
    difficulty: keyword.difficulty,
    trend: keyword.trend,
    countryCode: keyword.countryCode,
    languageCode: keyword.languageCode,
  };
}

export function toAiAnalysisDto(analysis: AiAnalysis | null) {
  if (!analysis) return null;

  if (analysis.status === "completed") {
    const output = researchAnalysisSchema.safeParse(analysis.output);
    if (!output.success) {
      return {
        id: analysis.id,
        status: "failed" as const,
        summary: null,
        output: null,
        errorMessage: "AI insights are temporarily unavailable.",
        updatedAt: analysis.updatedAt.toISOString(),
      };
    }

    return {
      id: analysis.id,
      status: analysis.status,
      summary: output.data.summary.statement,
      output: output.data,
      errorMessage: null,
      updatedAt: analysis.updatedAt.toISOString(),
    };
  }

  return {
    id: analysis.id,
    status: analysis.status,
    summary: null,
    output: null,
    errorMessage: analysis.status === "failed"
      ? analysis.errorMessage ?? "AI insights could not be generated."
      : null,
    updatedAt: analysis.updatedAt.toISOString(),
  };
}

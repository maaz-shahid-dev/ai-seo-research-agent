import { researchAnalysisSchema } from "@/server/providers/types";
import type { AiAnalysis, ContentGapReport, KeywordResult, ResearchRun, SerpAnalysis, SerpResult } from "@/server/db/schema";

import { isHomepageUrl } from "./domains";
import { classifySite, findWeakSpots } from "./niche";
import { siteMetricsFor, type StoredDomainMetrics } from "./serp";

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

/**
 * `nicheScores` maps keyword ids to scores; keywords without an analyzed SERP get null.
 * A Map (not a number) also stops `.map(toKeywordDto)` from passing array indexes as scores.
 */
export function toKeywordDto(keyword: KeywordResult, nicheScores?: ReadonlyMap<number, number>) {
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
    nicheScore: nicheScores?.get(keyword.id) ?? null,
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

/**
 * SERP analysis with each result joined to the cached metrics of its
 * registrable domain. Weak spots are derived at read time, so refreshed
 * metrics show up without re-running the analysis.
 */
export function toSerpAnalysisDto(
  analysis: SerpAnalysis,
  results: readonly SerpResult[],
  metricsByDomain: ReadonlyMap<string, StoredDomainMetrics>,
  now = new Date(),
) {
  return {
    keywordId: analysis.keywordResultId,
    status: analysis.status,
    nicheScore: analysis.status === "completed" ? analysis.nicheScore : null,
    hasAiOverview: analysis.hasAiOverview,
    errorMessage: analysis.status === "failed" ? analysis.errorMessage ?? "SERP analysis failed." : null,
    fetchedAt: analysis.finishedAt?.toISOString() ?? null,
    results: results.flatMap((result) => {
      if (!result.domain) return [];
      const site = siteMetricsFor(result.domain, metricsByDomain, now);
      const url = result.url ?? "";
      return [{
        rank: result.rank,
        title: result.title ?? url,
        url,
        domain: result.domain.replace(/^www\./, ""),
        authority: site.authority,
        monthlyTraffic: site.monthlyTraffic,
        domainAgeYears: site.domainAgeYears,
        backlinks: site.backlinks,
        referringDomains: site.referringDomains,
        rankingKeywords: site.rankingKeywords,
        isHomepage: isHomepageUrl(url),
        siteType: classifySite(result.domain),
        weakSpots: findWeakSpots(site),
      }];
    }),
  };
}

export function toContentGapDto(report: ContentGapReport) {
  return {
    status: report.status,
    targetDomain: report.targetDomain,
    competitors: report.competitors,
    keywords: report.keywords,
    errorMessage: report.status === "failed" ? report.errorMessage ?? "Content gap analysis failed." : null,
  };
}

import "server-only";

import { registrableDomain } from "@/features/research/domains";
import { toSerpAnalysisDto } from "@/features/research/dto";
import type { DatabaseClient } from "@/server/db/client";
import { getDomainMetrics, listSerpResults } from "@/server/db/repositories";
import type { SerpAnalysis } from "@/server/db/schema";

/** Loads an analysis's stored results and cached domain metrics into its DTO. */
export async function loadSerpAnalysisDto(database: DatabaseClient, analysis: SerpAnalysis) {
  const results = analysis.snapshotId ? await listSerpResults(database, analysis.ownerId, analysis.snapshotId) : [];
  const domains = [...new Set(results.flatMap((result) => (result.domain ? registrableDomain(result.domain) ?? [] : [])))];
  const metrics = await getDomainMetrics(database, domains);
  return toSerpAnalysisDto(analysis, results, new Map(metrics.map((row) => [row.domain, row])));
}

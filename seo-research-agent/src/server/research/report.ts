import "server-only";

import { toAiAnalysisDto, toKeywordDto, toResearchRunDto } from "@/features/research/dto";
import type { DatabaseClient } from "@/server/db/client";
import { getLatestAiAnalysisForRun, getResearchRunById, listKeywordResults, listNicheScores } from "@/server/db/repositories";

const PAGE_SIZE = 250;
/** Reports cover up to 1,000 keywords, more than any search the app creates. */
const MAX_PAGES = 4;

/** A finished search's stored data for its report, or null if it isn't the user's or isn't finished. */
export async function loadReportData(database: DatabaseClient, ownerId: string, runId: string) {
  const run = await getResearchRunById(database, ownerId, runId);
  if (!run || run.status !== "completed") return null;

  const [analysis, nicheScores] = await Promise.all([
    getLatestAiAnalysisForRun(database, ownerId, run.id),
    listNicheScores(database, ownerId, run.id),
  ]);
  const keywords = [];
  let afterId: number | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const result = await listKeywordResults(database, ownerId, run.id, { afterId, limit: PAGE_SIZE });
    keywords.push(...result.items.map((keyword) => toKeywordDto(keyword, nicheScores)));
    if (result.nextCursor === null) break;
    afterId = result.nextCursor;
  }
  return { run: toResearchRunDto(run), keywords, analysis: toAiAnalysisDto(analysis) };
}

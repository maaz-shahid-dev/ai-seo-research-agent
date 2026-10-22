import { researchRunIdSchema } from "@/features/research/schemas";
import { toAiAnalysisDto, toKeywordDto, toResearchRunDto } from "@/features/research/dto";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import {
  countPendingSerpAnalyses,
  deleteResearchRun,
  getLatestAiAnalysisForRun,
  getResearchRunById,
  listKeywordResults,
  listNicheScores,
} from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";
import { isSameOriginMutation } from "@/server/security/request";

type RouteContext = { params: Promise<{ runId: string }> };

// Large enough for keyword ideas plus autocomplete suggestions in one page.
const KEYWORD_PAGE_SIZE = 250;

export async function GET(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const runId = researchRunIdSchema.parse((await context.params).runId);
    const afterId = parseCursor(new URL(request.url).searchParams.get("after"));
    const run = await getResearchRunById(getDatabase(), user.id, runId);
    if (!run) throw new AppError("Research not found.", "NOT_FOUND", 404, false);

    const completed = run.status === "completed";
    const [keywords, analysis, nicheScores, pendingSerpCount] = await Promise.all([
      completed
        ? listKeywordResults(getDatabase(), user.id, run.id, { afterId, limit: KEYWORD_PAGE_SIZE })
        : Promise.resolve({ items: [], nextCursor: null }),
      getLatestAiAnalysisForRun(getDatabase(), user.id, run.id),
      completed ? listNicheScores(getDatabase(), user.id, run.id) : Promise.resolve(new Map<number, number>()),
      completed ? countPendingSerpAnalyses(getDatabase(), user.id, run.id) : Promise.resolve(0),
    ]);
    return noStore(
      Response.json({
        run: toResearchRunDto(run),
        keywords: keywords.items.map((keyword) => toKeywordDto(keyword, nicheScores)),
        nextCursor: keywords.nextCursor,
        analysis: toAiAnalysisDto(analysis),
        pendingSerpCount,
      }),
    );
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

function parseCursor(value: string | null) {
  if (value === null) return undefined;
  const parsed = Number(value);
  if (!Number.isSafeInteger(parsed) || parsed < 1) {
    throw new AppError("Invalid result cursor.", "VALIDATION_ERROR", 400, false);
  }
  return parsed;
}

/** Removes a search and everything collected for it. */
export async function DELETE(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    if (!isSameOriginMutation(request)) {
      throw new AppError("This request is not allowed.", "INVALID_ORIGIN", 403, false);
    }
    const user = await requireActiveUser();
    const runId = researchRunIdSchema.parse((await context.params).runId);
    if (!(await deleteResearchRun(getDatabase(), user.id, runId))) {
      throw new AppError("Research not found.", "NOT_FOUND", 404, false);
    }
    return noStore(new Response(null, { status: 204 }));
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

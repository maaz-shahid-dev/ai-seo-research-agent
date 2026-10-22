import { researchRunIdSchema } from "@/features/research/schemas";
import { toAiAnalysisDto, toKeywordDto, toResearchRunDto } from "@/features/research/dto";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import {
  getLatestAiAnalysisForRun,
  getResearchRunById,
  listKeywordResults,
} from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const runId = researchRunIdSchema.parse((await context.params).runId);
    const afterId = parseCursor(new URL(request.url).searchParams.get("after"));
    const run = await getResearchRunById(getDatabase(), user.id, runId);
    if (!run) throw new AppError("Research not found.", "NOT_FOUND", 404, false);

    const [keywords, analysis] = await Promise.all([
      run.status === "completed"
        ? listKeywordResults(getDatabase(), user.id, run.id, { afterId, limit: 100 })
        : Promise.resolve({ items: [], nextCursor: null }),
      getLatestAiAnalysisForRun(getDatabase(), user.id, run.id),
    ]);
    return noStore(
      Response.json({
        run: toResearchRunDto(run),
        keywords: keywords.items.map(toKeywordDto),
        nextCursor: keywords.nextCursor,
        analysis: toAiAnalysisDto(analysis),
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

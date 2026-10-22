import { researchRunIdSchema } from "@/features/research/schemas";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { getResearchRunById, listKeywordResults } from "@/server/db/repositories";
import { AppError, errorResponse } from "@/server/http/errors";
import { noStore, readRequestId } from "@/server/http/request";
import { logger } from "@/server/logging/logger";

type RouteContext = { params: Promise<{ runId: string }> };

export async function GET(request: Request, context: RouteContext) {
  const requestId = readRequestId(request);
  try {
    const user = await requireActiveUser();
    const runId = researchRunIdSchema.parse((await context.params).runId);
    const run = await getResearchRunById(getDatabase(), user.id, runId);
    if (!run) throw new AppError("Research not found.", "NOT_FOUND", 404, false);
    if (run.status !== "completed") {
      throw new AppError("Research is not ready to export.", "NOT_READY", 409, false);
    }

    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      async start(controller) {
        try {
          controller.enqueue(
            encoder.encode("keyword,source,intent,search_volume,cpc_usd,competition,difficulty\r\n"),
          );
          let afterId: number | undefined;
          do {
            const page = await listKeywordResults(getDatabase(), user.id, run.id, {
              afterId,
              limit: 250,
            });
            for (const keyword of page.items) {
              controller.enqueue(
                encoder.encode([
                  keyword.keyword,
                  keyword.source,
                  keyword.intent,
                  keyword.searchVolume,
                  keyword.cpcMicros === null ? null : (keyword.cpcMicros / 1_000_000).toFixed(6),
                  keyword.competition,
                  keyword.difficulty,
                ].map(csvCell).join(",") + "\r\n"),
              );
            }
            afterId = page.nextCursor ?? undefined;
          } while (afterId !== undefined);
          controller.close();
        } catch (error) {
          logger.error({ error, requestId, runId }, "CSV export stream failed");
          controller.error(error);
        }
      },
    });

    return noStore(
      new Response(stream, {
        headers: {
          "content-type": "text/csv; charset=utf-8",
          "content-disposition": `attachment; filename="research-${run.id}.csv"`,
          "x-content-type-options": "nosniff",
          "x-request-id": requestId,
        },
      }),
    );
  } catch (error) {
    return noStore(errorResponse(error, requestId));
  }
}

function csvCell(value: string | number | null) {
  if (value === null) return "";
  let text = String(value);
  if (/^[=+\-@]/.test(text)) text = `'${text}`;
  return `"${text.replaceAll('"', '""')}"`;
}

"use client";

import { isJobInProgress, type SerpAnalysisDto } from "@/features/research/types";
import { usePolling } from "@/hooks/usePolling";
import { apiRequest } from "@/lib/api-client";

const POLL_MS = 2_000;

/**
 * Requests a keyword's SERP analysis (POST is idempotent and returns any
 * existing result), then polls until it settles. Pass null to stay idle.
 */
export function useSerpAnalysis(runId: string, keywordId: number | null) {
  const url = `/api/research/${runId}/serp/${keywordId}`;
  return usePolling(
    keywordId === null ? null : url,
    async (signal, attempt) => {
      const { serp } = await apiRequest<{ serp: SerpAnalysisDto }>(
        url,
        attempt === 0 ? { method: "POST", body: "{}", signal } : { signal },
      );
      return serp;
    },
    (serp) => (isJobInProgress(serp) ? POLL_MS : null),
  );
}

"use client";

import { useCallback, useState } from "react";

import {
  isJobInProgress,
  isRunInProgress,
  type KeywordDto,
  type ResearchDetailResponse,
  type ResearchRunDto,
} from "@/features/research/types";
import { usePolling } from "@/hooks/usePolling";
import { apiRequest, errorMessage } from "@/lib/api-client";

const QUEUED_POLL_MS = 1_500;
const ACTIVE_POLL_MS = 2_500;

/** Polls until both the keyword job and the AI analysis have settled. */
function nextDelay({ run, analysis }: ResearchDetailResponse) {
  if (isRunInProgress(run)) return run.status === "queued" ? QUEUED_POLL_MS : ACTIVE_POLL_MS;
  return run.status === "completed" && isJobInProgress(analysis) ? ACTIVE_POLL_MS : null;
}

/** Loads one research run, keeps it fresh, and pages through its keywords. */
export function useResearchRun(initialRun: ResearchRunDto) {
  const runId = initialRun.id;
  const { data, error } = usePolling(
    runId,
    (signal) => apiRequest<ResearchDetailResponse>(`/api/research/${runId}`, { signal }),
    nextDelay,
  );
  // Pages after the first; the first page is fixed once the run completes.
  const [extra, setExtra] = useState<{ keywords: KeywordDto[]; nextCursor?: number | null }>({ keywords: [] });
  const [loadingMore, setLoadingMore] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const nextCursor = extra.nextCursor !== undefined ? extra.nextCursor : data?.nextCursor ?? null;

  const loadMore = useCallback(async () => {
    if (nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    setLoadError(null);
    try {
      const page = await apiRequest<ResearchDetailResponse>(`/api/research/${runId}?after=${nextCursor}`);
      setExtra((current) => ({ keywords: [...current.keywords, ...page.keywords], nextCursor: page.nextCursor }));
    } catch (caught) {
      setLoadError(errorMessage(caught));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, nextCursor, runId]);

  return {
    run: data?.run ?? initialRun,
    analysis: data?.analysis ?? null,
    keywords: [...(data?.keywords ?? []), ...extra.keywords],
    nextCursor,
    error: error ?? loadError,
    loadingMore,
    loadMore,
  };
}

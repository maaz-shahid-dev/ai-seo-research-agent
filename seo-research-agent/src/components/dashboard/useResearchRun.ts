"use client";

import { useCallback, useEffect, useState } from "react";

import {
  isAnalysisInProgress,
  isRunInProgress,
  type AiAnalysisDto,
  type KeywordDto,
  type ResearchDetailResponse,
  type ResearchRunDto,
} from "@/features/research/types";
import { ApiError, apiRequest, errorMessage, isAbortError } from "@/lib/api-client";

const QUEUED_POLL_MS = 1_500;
const ACTIVE_POLL_MS = 2_500;
const MAX_RETRY_MS = 30_000;

type RunState = {
  run: ResearchRunDto;
  analysis: AiAnalysisDto | null;
  keywords: KeywordDto[];
  nextCursor: number | null;
  /** True once the first page of a completed run is loaded; later polls keep it. */
  keywordsLoaded: boolean;
  error: string | null;
};

/**
 * Loads one research run and keeps it fresh until both the keyword job and the
 * AI analysis settle. Temporary failures retry with exponential backoff; other
 * failures stop polling and surface the server's message.
 */
export function useResearchRun(initialRun: ResearchRunDto) {
  const runId = initialRun.id;
  const [state, setState] = useState<RunState>({
    run: initialRun,
    analysis: null,
    keywords: [],
    nextCursor: null,
    keywordsLoaded: false,
    error: null,
  });
  const [loadingMore, setLoadingMore] = useState(false);

  useEffect(() => {
    const controller = new AbortController();
    let timer: ReturnType<typeof setTimeout> | undefined;
    let failures = 0;

    async function refresh() {
      try {
        const detail = await apiRequest<ResearchDetailResponse>(`/api/research/${runId}`, {
          signal: controller.signal,
        });
        failures = 0;
        setState((current) => ({
          run: detail.run,
          analysis: detail.analysis,
          keywords: current.keywordsLoaded ? current.keywords : detail.keywords,
          nextCursor: current.keywordsLoaded ? current.nextCursor : detail.nextCursor,
          keywordsLoaded: current.keywordsLoaded || detail.run.status === "completed",
          error: null,
        }));

        if (isRunInProgress(detail.run)) {
          timer = setTimeout(refresh, detail.run.status === "queued" ? QUEUED_POLL_MS : ACTIVE_POLL_MS);
        } else if (detail.run.status === "completed" && isAnalysisInProgress(detail.analysis)) {
          timer = setTimeout(refresh, ACTIVE_POLL_MS);
        }
      } catch (error) {
        if (controller.signal.aborted || isAbortError(error)) return;
        const retryable = error instanceof ApiError && error.retryable;
        setState((current) => ({
          ...current,
          error: retryable ? "Connection problem. Retrying…" : errorMessage(error),
        }));
        if (retryable) {
          failures += 1;
          timer = setTimeout(refresh, Math.min(ACTIVE_POLL_MS * 2 ** failures, MAX_RETRY_MS));
        }
      }
    }

    void refresh();
    return () => {
      controller.abort();
      clearTimeout(timer);
    };
  }, [runId]);

  const loadMore = useCallback(async () => {
    if (state.nextCursor === null || loadingMore) return;
    setLoadingMore(true);
    try {
      const page = await apiRequest<ResearchDetailResponse>(
        `/api/research/${runId}?after=${state.nextCursor}`,
      );
      setState((current) => ({
        ...current,
        keywords: [...current.keywords, ...page.keywords],
        nextCursor: page.nextCursor,
        error: null,
      }));
    } catch (error) {
      setState((current) => ({ ...current, error: errorMessage(error) }));
    } finally {
      setLoadingMore(false);
    }
  }, [loadingMore, runId, state.nextCursor]);

  return { ...state, loadingMore, loadMore };
}

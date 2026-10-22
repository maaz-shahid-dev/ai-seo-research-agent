"use client";

import { useCallback, useEffect, useState } from "react";

import type { ResearchRunDto } from "@/features/research/types";
import { apiRequest, errorMessage, isAbortError } from "@/lib/api-client";

const RECENT_RUN_LIMIT = 8;

type RecentRunsState = {
  projectId: string | null;
  runs: ResearchRunDto[];
  loading: boolean;
  error: string | null;
};

/** Loads a project's latest searches and lets callers add or refresh one in place. */
export function useRecentRuns(projectId: string | null) {
  const [state, setState] = useState<RecentRunsState>({
    projectId,
    runs: [],
    loading: projectId !== null,
    error: null,
  });

  // Reset synchronously when the project changes so stale runs never flash.
  if (state.projectId !== projectId) {
    setState({ projectId, runs: [], loading: projectId !== null, error: null });
  }

  useEffect(() => {
    if (!projectId) return;
    const controller = new AbortController();
    const params = new URLSearchParams({ projectId, limit: String(RECENT_RUN_LIMIT) });

    apiRequest<{ runs: ResearchRunDto[] }>(`/api/research?${params}`, { signal: controller.signal })
      .then(({ runs }) =>
        setState((current) => ({
          ...current,
          // Keep runs added while the request was in flight (e.g. a new search).
          runs: mergeRuns(current.runs, runs),
          loading: false,
          error: null,
        })),
      )
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
      });

    return () => controller.abort();
  }, [projectId]);

  const upsert = useCallback((run: ResearchRunDto) => {
    setState((current) =>
      run.projectId === current.projectId
        ? { ...current, runs: mergeRuns([run], current.runs) }
        : current,
    );
  }, []);

  const remove = useCallback((runId: string) => {
    setState((current) => ({ ...current, runs: current.runs.filter((run) => run.id !== runId) }));
  }, []);

  return { runs: state.runs, loading: state.loading, error: state.error, upsert, remove };
}

/** Newest first, unique by id, preferring entries from `preferred`. */
function mergeRuns(preferred: ResearchRunDto[], others: ResearchRunDto[]) {
  const byId = new Map<string, ResearchRunDto>();
  for (const run of [...preferred, ...others]) {
    if (!byId.has(run.id)) byId.set(run.id, run);
  }
  return [...byId.values()]
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt))
    .slice(0, RECENT_RUN_LIMIT);
}

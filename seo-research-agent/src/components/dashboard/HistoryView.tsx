"use client";

import { History, Loader2, Search, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";

import { marketFor } from "@/features/research/markets";
import { isRunInProgress, type ResearchRunDto } from "@/features/research/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { apiRequest, errorMessage, isAbortError } from "@/lib/api-client";
import { formatNumber, formatRelativeTime } from "@/lib/format";

const PAGE_SIZE = 20;
const SEARCH_DELAY_MS = 300;

type HistoryPage = { runs: ResearchRunDto[]; nextCursor: string | null };

type HistoryState = {
  /** The project and search the rows belong to; a change resets the list. */
  key: string;
  runs: ResearchRunDto[];
  nextCursor: string | null;
  loading: boolean;
  error: string | null;
};

type HistoryViewProps = {
  projectId: string;
  projectName: string;
  onOpen: (run: ResearchRunDto) => void;
  /** Called after a search was deleted on the server. */
  onDeleted: (runId: string) => void;
};

/** Every search in the project: find, reopen or delete past research. */
export function HistoryView({ projectId, projectName, onOpen, onDeleted }: HistoryViewProps) {
  const [input, setInput] = useState("");
  const [search, setSearch] = useState("");
  const key = `${projectId}\n${search}`;
  const [state, setState] = useState<HistoryState>({ key, runs: [], nextCursor: null, loading: true, error: null });
  const [cursor, setCursor] = useState<string | null>(null);
  const [confirmingId, setConfirmingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  // Reset synchronously when the project or search changes so stale rows never flash.
  if (state.key !== key) {
    setState({ key, runs: [], nextCursor: null, loading: true, error: null });
    setCursor(null);
  }

  useEffect(() => {
    const timer = setTimeout(() => setSearch(input.trim()), SEARCH_DELAY_MS);
    return () => clearTimeout(timer);
  }, [input]);

  useEffect(() => {
    const controller = new AbortController();
    const params = new URLSearchParams({ projectId, limit: String(PAGE_SIZE) });
    if (search) params.set("q", search);
    if (cursor) params.set("cursor", cursor);

    apiRequest<HistoryPage>(`/api/research?${params}`, { signal: controller.signal })
      .then((page) =>
        setState((current) => current.key !== key ? current : {
          ...current,
          runs: cursor ? [...current.runs, ...page.runs.filter((run) => !current.runs.some((item) => item.id === run.id))] : page.runs,
          nextCursor: page.nextCursor,
          loading: false,
          error: null,
        }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState((current) => ({ ...current, loading: false, error: errorMessage(error) }));
      });
    return () => controller.abort();
  }, [projectId, search, cursor, key]);

  function loadMore() {
    if (!state.nextCursor || state.loading) return;
    setState((current) => ({ ...current, loading: true }));
    setCursor(state.nextCursor);
  }

  async function remove(run: ResearchRunDto) {
    setDeletingId(run.id);
    setDeleteError(null);
    try {
      await apiRequest(`/api/research/${encodeURIComponent(run.id)}`, { method: "DELETE" });
      setState((current) => ({ ...current, runs: current.runs.filter((item) => item.id !== run.id) }));
      setConfirmingId(null);
      onDeleted(run.id);
    } catch (error) {
      setDeleteError(errorMessage(error));
    } finally {
      setDeletingId(null);
    }
  }

  const empty = !state.loading && !state.error && state.runs.length === 0;

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
          <History className="h-5 w-5 text-indigo-600" aria-hidden="true" />
          History
        </h1>
        <p className="mt-1 text-sm text-slate-600">Every search in {projectName}. Open one to see its report again, or delete what you no longer need.</p>
      </div>

      <div className="relative max-w-md">
        <label htmlFor="history-search" className="sr-only">Search history</label>
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
        <input
          id="history-search"
          type="search"
          value={input}
          onChange={(event) => setInput(event.target.value)}
          maxLength={100}
          placeholder="Search your past topics"
          className="w-full rounded-lg border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm placeholder:text-slate-400"
        />
      </div>

      {state.error ? <ErrorState>{state.error}</ErrorState> : null}
      {deleteError ? <ErrorState>{deleteError}</ErrorState> : null}
      {empty ? (
        <EmptyState>{search ? `No searches match “${search}”.` : "No searches yet. Run your first research to see it here."}</EmptyState>
      ) : null}

      {state.runs.length > 0 ? (
        <ul className="divide-y divide-slate-100 overflow-hidden rounded-xl border border-slate-200 bg-white">
          {state.runs.map((run) => {
            const status = statusBadge(run);
            const market = marketFor(run.countryCode);
            return (
              <li key={run.id} className="flex flex-col gap-3 px-4 py-3 sm:flex-row sm:items-center">
                <button type="button" onClick={() => onOpen(run)} className="min-w-0 flex-1 text-left">
                  <span className="block truncate font-medium text-slate-900 hover:text-indigo-700">{run.query}</span>
                  <span className="mt-0.5 block text-xs text-slate-500">
                    {formatRelativeTime(run.createdAt)} · {market ? market.name : run.countryCode} · {formatNumber(run.keywordCount)} keywords
                  </span>
                </button>
                <div className="flex shrink-0 items-center gap-2">
                  <Badge tone={status.tone}>{status.label}</Badge>
                  {confirmingId === run.id ? (
                    <>
                      <Button size="sm" variant="danger" disabled={deletingId === run.id} onClick={() => void remove(run)}>
                        {deletingId === run.id ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
                        Delete
                      </Button>
                      <Button size="sm" variant="secondary" disabled={deletingId === run.id} onClick={() => setConfirmingId(null)}>Cancel</Button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmingId(run.id)}
                      aria-label={`Delete “${run.query}”`}
                      title="Delete"
                      className="rounded-lg p-2 text-slate-400 hover:bg-rose-50 hover:text-rose-700"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                    </button>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      ) : null}

      {state.loading ? (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" /> Loading…
        </p>
      ) : state.nextCursor ? (
        <Button variant="secondary" onClick={loadMore}>Load more</Button>
      ) : null}
    </div>
  );
}

function statusBadge(run: ResearchRunDto): { label: string; tone: BadgeTone } {
  if (isRunInProgress(run)) return { label: "Running", tone: "accent" };
  if (run.status === "failed") return { label: "Failed", tone: "bad" };
  if (run.status === "cancelled") return { label: "Cancelled", tone: "neutral" };
  return { label: "Done", tone: "good" };
}

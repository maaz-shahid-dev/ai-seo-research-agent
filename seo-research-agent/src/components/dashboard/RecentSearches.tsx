"use client";

import { isRunInProgress, type ResearchRunDto } from "@/features/research/types";
import { formatRelativeTime } from "@/lib/format";

type RecentSearchesProps = {
  runs: ResearchRunDto[];
  selectedId: string | null;
  onSelect: (run: ResearchRunDto) => void;
};

/** Sidebar list of the project's latest searches, with a status dot each. */
export function RecentSearches({ runs, selectedId, onSelect }: RecentSearchesProps) {
  return (
    <nav aria-label="Recent searches">
      <p className="px-3 pb-2 text-[11px] font-semibold uppercase tracking-wide text-slate-400">Recent searches</p>
      {runs.length === 0 ? (
        <p className="px-3 text-sm text-slate-400">No searches yet.</p>
      ) : (
        <ul className="space-y-0.5">
          {runs.map((run) => {
            const selected = run.id === selectedId;
            const failed = run.status === "failed" || run.status === "cancelled";
            return (
              <li key={run.id}>
                <button
                  type="button"
                  onClick={() => onSelect(run)}
                  aria-current={selected ? "true" : undefined}
                  className={`flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left transition ${
                    selected ? "bg-slate-100 text-slate-950" : "text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  <span
                    aria-hidden="true"
                    className={`h-2 w-2 shrink-0 rounded-full ${
                      isRunInProgress(run) ? "animate-pulse bg-indigo-500" : failed ? "bg-rose-500" : "bg-emerald-500"
                    }`}
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium">{run.query}</span>
                    <span className="block text-[11px] text-slate-400">{formatRelativeTime(run.createdAt)}</span>
                  </span>
                  {isRunInProgress(run) ? <span className="sr-only"> (running)</span> : null}
                  {failed ? <span className="sr-only"> (failed)</span> : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}
    </nav>
  );
}

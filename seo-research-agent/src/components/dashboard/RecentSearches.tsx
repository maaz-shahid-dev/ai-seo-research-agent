"use client";

import { isRunInProgress, type ResearchRunDto } from "@/features/research/types";

type RecentSearchesProps = {
  runs: ResearchRunDto[];
  selectedId: string | null;
  onSelect: (run: ResearchRunDto) => void;
};

export function RecentSearches({ runs, selectedId, onSelect }: RecentSearchesProps) {
  if (runs.length < 2) return null;

  return (
    <nav aria-label="Recent searches" className="flex flex-wrap items-center gap-2">
      <span className="text-xs text-slate-500">Recent</span>
      {runs.map((run) => {
        const selected = run.id === selectedId;
        return (
          <button
            key={run.id}
            type="button"
            onClick={() => onSelect(run)}
            aria-current={selected ? "true" : undefined}
            className={`max-w-[14rem] truncate rounded-full border px-3 py-1 text-xs font-medium transition ${
              selected
                ? "border-indigo-600 bg-indigo-50 text-indigo-700"
                : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
            }`}
          >
            {run.query}
            {isRunInProgress(run) ? <span className="sr-only"> (running)</span> : null}
            {run.status === "failed" || run.status === "cancelled"
              ? <span className="sr-only"> (failed)</span>
              : null}
          </button>
        );
      })}
    </nav>
  );
}

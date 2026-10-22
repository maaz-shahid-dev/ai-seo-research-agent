"use client";

import { Download, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { isRunInProgress, type ProjectDto, type ResearchRunDto } from "@/features/research/types";
import { Button, buttonStyles } from "@/components/ui/Button";
import { formatRelativeTime } from "@/lib/format";

import { ResearchResults } from "./ResearchResults";
import { useResearchRun } from "./useResearchRun";

type ResearchViewProps = {
  initialRun: ResearchRunDto;
  project: ProjectDto;
  onProjectUpdate: (project: ProjectDto) => void;
  /** Called whenever polling returns a newer copy of the run. */
  onRunChange: (run: ResearchRunDto) => void;
  onRetry: (query: string) => void;
};

/** Shows one search from queued through finished. Remount (via `key`) to switch runs. */
export function ResearchView({ initialRun, project, onProjectUpdate, onRunChange, onRetry }: ResearchViewProps) {
  const { run, analysis, keywords, nextCursor, error, loadingMore, loadMore } =
    useResearchRun(initialRun);

  useEffect(() => {
    onRunChange(run);
  }, [onRunChange, run]);

  return (
    <section aria-labelledby="research-title" className="space-y-4">
      <ResearchHeader run={run} />
      {error ? <p className="text-sm text-amber-700" role="status">{error}</p> : null}

      {isRunInProgress(run) ? (
        <ResearchProgress run={run} />
      ) : run.status === "completed" ? (
        <ResearchResults
          runId={run.id}
          analysis={analysis}
          project={project}
          onProjectUpdate={onProjectUpdate}
          keywords={keywords}
          hasMore={nextCursor !== null}
          loadingMore={loadingMore}
          onLoadMore={loadMore}
        />
      ) : (
        <div className="rounded-xl border border-rose-200 bg-rose-50 p-5" role="alert">
          <p className="text-sm text-rose-800">
            {run.errorMessage ?? "This search didn't finish."}
          </p>
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => onRetry(run.query)}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Try again
          </Button>
        </div>
      )}
    </section>
  );
}

function ResearchHeader({ run }: { run: ResearchRunDto }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h1 id="research-title" className="truncate text-xl font-semibold text-slate-950">
          {run.query}
        </h1>
        <p className="mt-0.5 text-sm text-slate-500">
          {run.status === "completed" ? `${run.keywordCount} keywords · ` : ""}
          {formatRelativeTime(run.createdAt)}
        </p>
      </div>
      {run.status === "completed" && run.keywordCount > 0 ? (
        <a href={`/api/research/${run.id}/export`} className={buttonStyles({ variant: "secondary", size: "sm" })}>
          <Download className="h-4 w-4" aria-hidden="true" />
          Export CSV
        </a>
      ) : null}
    </div>
  );
}

function ResearchProgress({ run }: { run: ResearchRunDto }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5" role="status" aria-live="polite">
      <div className="flex items-center justify-between text-sm">
        <span className="text-slate-700">
          {run.status === "queued" ? "Starting search…" : "Finding keywords…"}
        </span>
        <span className="tabular-nums text-slate-500">{run.progress}%</span>
      </div>
      {/* Native progress instead of an inline width: the CSP forbids style attributes. */}
      <progress
        value={Math.max(run.progress, 5)}
        max={100}
        aria-label="Search progress"
        className="mt-3 block h-1.5 w-full appearance-none overflow-hidden rounded-full bg-slate-100 [&::-moz-progress-bar]:bg-indigo-600 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-indigo-600"
      />
    </div>
  );
}

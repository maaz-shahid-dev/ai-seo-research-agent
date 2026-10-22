"use client";

import { Download, RotateCcw } from "lucide-react";
import { useEffect } from "react";

import { isRunInProgress, type ProjectDto, type ResearchRunDto } from "@/features/research/types";
import { Button, buttonStyles } from "@/components/ui/Button";
import { formatRelativeTime, titleCase } from "@/lib/format";

import { ResearchResults } from "./ResearchResults";
import { useResearchRun } from "./useResearchRun";

type ResearchViewProps = {
  initialRun: ResearchRunDto;
  project: ProjectDto;
  onProjectUpdate: (project: ProjectDto) => void;
  /** Called whenever polling returns a newer copy of the run. */
  onRunChange: (run: ResearchRunDto) => void;
  /** Runs the search again in the same country. */
  onRetry: (query: string, countryCode: string) => void;
};

/** Shows one search from queued through finished. Remount (via `key`) to switch runs. */
export function ResearchView({ initialRun, project, onProjectUpdate, onRunChange, onRetry }: ResearchViewProps) {
  const { run, analysis, keywords, nextCursor, error, loaded, loadingMore, loadMore } =
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
      ) : run.status === "completed" && !loaded ? (
        <ReportSkeleton />
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
          <Button variant="secondary" size="sm" className="mt-3" onClick={() => onRetry(run.query, run.countryCode)}>
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
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        <p className="text-xs font-medium uppercase tracking-wide text-indigo-600">Niche report</p>
        <h1 id="research-title" className="mt-0.5 truncate text-2xl font-semibold text-slate-950">
          {titleCase(run.query)}
        </h1>
        <div className="mt-2 flex flex-wrap gap-2 text-xs text-slate-600">
          {run.status === "completed" ? <Chip>{run.keywordCount} keywords</Chip> : null}
          <Chip>{run.countryCode} · {run.languageCode}</Chip>
          <Chip>{formatRelativeTime(run.createdAt)}</Chip>
        </div>
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

function Chip({ children }: { children: React.ReactNode }) {
  return <span className="rounded-full border border-slate-200 bg-white px-2.5 py-0.5">{children}</span>;
}

/** Shown while a finished report's data is loading (e.g. when switching searches). */
function ReportSkeleton() {
  return (
    <div className="animate-pulse space-y-3 motion-reduce:animate-none" role="status" aria-label="Loading report">
      <div className="h-11 rounded-xl bg-slate-200" />
      <div className="h-48 rounded-xl bg-slate-200" />
      <div className="h-64 rounded-xl bg-slate-200" />
    </div>
  );
}

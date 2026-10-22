import { Loader2, Sparkles } from "lucide-react";

import type { AiAnalysisDto } from "@/features/research/types";

type Statement = { statement: string };

const MAX_ITEMS_PER_LIST = 3;

export function InsightsCard({ analysis }: { analysis: AiAnalysisDto | null }) {
  if (!analysis) return null;

  if (analysis.status === "queued" || analysis.status === "running") {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
        Writing AI summary…
      </p>
    );
  }

  if (analysis.status === "failed" || !analysis.output) {
    return (
      <p className="text-sm text-slate-500">
        {analysis.errorMessage ?? "AI summary is unavailable. Your keyword results are unaffected."}
      </p>
    );
  }

  const { summary, opportunitySignals, risks, nextSteps } = analysis.output;

  return (
    <section aria-labelledby="insights-title" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="insights-title" className="flex items-center gap-2 text-sm font-semibold text-slate-900">
        <Sparkles className="h-4 w-4 text-indigo-600" aria-hidden="true" />
        AI summary
      </h2>
      <p className="mt-2 text-sm leading-6 text-slate-700">{summary.statement}</p>
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        <InsightList title="Opportunities" items={opportunitySignals} />
        <InsightList title="Risks" items={risks} />
        <InsightList title="Next steps" items={nextSteps} />
      </div>
    </section>
  );
}

function InsightList({ title, items }: { title: string; items: Statement[] }) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">{title}</h3>
      <ul className="mt-2 list-disc space-y-1.5 pl-4 text-sm leading-5 text-slate-700">
        {items.slice(0, MAX_ITEMS_PER_LIST).map((item, index) => (
          <li key={index}>{item.statement}</li>
        ))}
      </ul>
    </div>
  );
}

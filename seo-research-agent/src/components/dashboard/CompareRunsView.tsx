"use client";

import { ArrowLeft, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

import { compareKeywordSets, type ComparedKeyword, type KeywordSide } from "@/features/research/compare";
import { marketFor } from "@/features/research/markets";
import type { KeywordDto, ResearchDetailResponse, ResearchRunDto } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { apiRequest, errorMessage, isAbortError } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";

/** Enough pages for any search the app creates, without looping forever on a bad cursor. */
const MAX_PAGES = 20;

type Section = "both" | "onlyA" | "onlyB";

async function loadAllKeywords(runId: string, signal: AbortSignal) {
  const keywords: KeywordDto[] = [];
  let cursor: number | null = null;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const query: string = cursor === null ? "" : `?after=${cursor}`;
    const detail: ResearchDetailResponse = await apiRequest<ResearchDetailResponse>(`/api/research/${encodeURIComponent(runId)}${query}`, { signal });
    keywords.push(...detail.keywords);
    cursor = detail.nextCursor;
    if (cursor === null) break;
  }
  return keywords;
}

/** Side-by-side keyword differences between two searches. */
export function CompareRunsView({ runs, onBack }: { runs: [ResearchRunDto, ResearchRunDto]; onBack: () => void }) {
  const [a, b] = runs;
  const [state, setState] = useState<{ keywords: [KeywordDto[], KeywordDto[]] | null; error: string | null }>({ keywords: null, error: null });
  const [section, setSection] = useState<Section>("both");

  useEffect(() => {
    const controller = new AbortController();
    Promise.all([loadAllKeywords(a.id, controller.signal), loadAllKeywords(b.id, controller.signal)])
      .then((keywords) => setState({ keywords, error: null }))
      .catch((error: unknown) => {
        if (controller.signal.aborted || isAbortError(error)) return;
        setState({ keywords: null, error: errorMessage(error) });
      });
    return () => controller.abort();
  }, [a.id, b.id]);

  const result = useMemo(() => (state.keywords ? compareKeywordSets(state.keywords[0], state.keywords[1]) : null), [state.keywords]);
  const label = (run: ResearchRunDto) => `${run.query} (${marketFor(run.countryCode)?.name ?? run.countryCode})`;
  const sections: { id: Section; title: string; count: number }[] = result
    ? [
      { id: "both", title: "In both", count: result.both.length },
      { id: "onlyA", title: `Only in A`, count: result.onlyA.length },
      { id: "onlyB", title: `Only in B`, count: result.onlyB.length },
    ]
    : [];

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Back to history
      </Button>
      <div>
        <h1 className="text-xl font-semibold text-slate-950">Compare searches</h1>
        <dl className="mt-2 grid gap-2 text-sm sm:grid-cols-2">
          <div className="min-w-0"><dt className="inline font-semibold text-slate-900">A: </dt><dd className="inline text-slate-700">{label(a)}</dd></div>
          <div className="min-w-0"><dt className="inline font-semibold text-slate-900">B: </dt><dd className="inline text-slate-700">{label(b)}</dd></div>
        </dl>
      </div>

      {state.error ? <ErrorState>{state.error}</ErrorState> : null}
      {!result && !state.error ? (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" /> Loading both keyword lists…
        </p>
      ) : null}

      {result ? (
        <>
          <div role="group" aria-label="Keywords to show" className="flex flex-wrap gap-2">
            {sections.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={section === item.id}
                onClick={() => setSection(item.id)}
                className={`rounded-lg border px-3 py-1.5 text-sm font-medium ${section === item.id ? "border-indigo-600 bg-indigo-600 text-on-accent" : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"}`}
              >
                {item.title} <span className="tabular-nums">({formatNumber(item.count)})</span>
              </button>
            ))}
          </div>
          <CompareTable rows={result[section]} section={section} />
        </>
      ) : null}
    </div>
  );
}

function CompareTable({ rows, section }: { rows: ComparedKeyword[]; section: Section }) {
  if (rows.length === 0) return <EmptyState>No keywords in this group.</EmptyState>;
  const sides: Array<["a" | "b", string]> = section === "both" ? [["a", "A"], ["b", "B"]] : section === "onlyA" ? [["a", "A"]] : [["b", "B"]];
  return (
    <Card padded={false} className="relative overflow-x-auto">
      <table className="w-full min-w-[480px] text-sm">
        <thead className="bg-slate-50 text-left text-xs text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-2.5 font-medium">Keyword</th>
            {sides.map(([key, name]) => (
              <th key={key} scope="col" className="px-4 py-2.5 text-right font-medium">Volume / KD ({name})</th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {rows.map((row) => (
            <tr key={row.keyword}>
              <td className="px-4 py-2.5 text-slate-900">{row.keyword}</td>
              {sides.map(([key]) => <td key={key} className="px-4 py-2.5 text-right"><Metrics side={row[key]} /></td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </Card>
  );
}

function Metrics({ side }: { side: KeywordSide | null }) {
  if (!side) return <span className="text-slate-400">—</span>;
  return (
    <span className="inline-flex items-center gap-2">
      <span className="tabular-nums">{formatNumber(side.searchVolume)}</span>
      {side.difficulty === null ? null : <Badge tone={difficultyTone(side.difficulty)}>{side.difficulty}</Badge>}
    </span>
  );
}

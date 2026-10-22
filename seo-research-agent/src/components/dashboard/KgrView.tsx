"use client";

import { Loader2, Sparkles } from "lucide-react";
import { useMemo, useState } from "react";

import { isKgrCandidate, KGR_BATCH_SIZE, KGR_MAX_VOLUME, kgrRatio, kgrRating, type KgrRating } from "@/features/research/kgr";
import type { KeywordDto } from "@/features/research/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";

const RATINGS: Record<KgrRating, { label: string; tone: BadgeTone }> = {
  great: { label: "Golden", tone: "good" },
  ok: { label: "Possible", tone: "warn" },
  poor: { label: "Crowded", tone: "bad" },
};

type KgrResponse = { keywords: { id: number; allintitleCount: number | null }[]; failed: number };

/** Keyword Golden Ratio: low-volume keywords a new site can rank for quickly. */
export function KgrView({ runId, keywords }: { runId: string; keywords: KeywordDto[] }) {
  // Counts found in this visit, layered over the ones the keywords arrived with.
  const [checked, setChecked] = useState<ReadonlyMap<number, number>>(new Map());
  const [pending, setPending] = useState(false);
  const [message, setMessage] = useState<{ text: string; error: boolean } | null>(null);

  const rows = useMemo(
    () => keywords
      .filter(isKgrCandidate)
      .map((keyword) => {
        const allintitle = keyword.allintitleCount ?? checked.get(keyword.id) ?? null;
        return { keyword, allintitle, ratio: kgrRatio(allintitle, keyword.searchVolume) };
      })
      .sort((a, b) => (a.ratio ?? Infinity) - (b.ratio ?? Infinity) || (b.keyword.searchVolume ?? 0) - (a.keyword.searchVolume ?? 0)),
    [keywords, checked],
  );
  const unchecked = rows.filter((row) => row.allintitle === null);
  const batch = Math.min(unchecked.length, KGR_BATCH_SIZE);

  async function checkNext() {
    const ids = unchecked.slice(0, KGR_BATCH_SIZE).map((row) => row.keyword.id);
    if (ids.length === 0 || pending) return;
    setPending(true);
    setMessage(null);
    try {
      const result = await apiRequest<KgrResponse>(`/api/research/${encodeURIComponent(runId)}/kgr`, {
        method: "POST",
        body: JSON.stringify({ keywordIds: ids }),
      });
      setChecked((current) => {
        const next = new Map(current);
        for (const item of result.keywords) if (item.allintitleCount !== null) next.set(item.id, item.allintitleCount);
        return next;
      });
      if (result.failed > 0) setMessage({ text: `${result.failed} lookups failed. Try them again.`, error: true });
    } catch (error) {
      setMessage({ text: errorMessage(error), error: true });
    } finally {
      setPending(false);
    }
  }

  return (
    <section aria-labelledby="kgr-title" className="space-y-3 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h2 id="kgr-title" className="flex items-center gap-2 font-semibold text-slate-900">
            <Sparkles className="h-4 w-4 text-amber-500" aria-hidden="true" /> Keyword Golden Ratio
          </h2>
          <p className="mt-1 max-w-2xl text-sm text-slate-600">
            Pages with every word in the title ÷ monthly searches, for keywords with {KGR_MAX_VOLUME} or fewer searches.
            Under 0.25 is golden: a new site can often rank within weeks.
          </p>
        </div>
        {unchecked.length > 0 ? (
          <Button onClick={() => void checkNext()} disabled={pending} className="shrink-0">
            {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : null}
            Check {batch} {batch === 1 ? "keyword" : "keywords"}
          </Button>
        ) : null}
      </div>
      {message ? <p className={`text-sm ${message.error ? "text-rose-700" : "text-slate-600"}`} role="alert">{message.text}</p> : null}

      {rows.length === 0 ? (
        <p className="rounded-lg border border-dashed border-slate-300 p-6 text-center text-sm text-slate-500">
          No keywords with {KGR_MAX_VOLUME} or fewer monthly searches in this research. Try a more specific topic.
        </p>
      ) : (
        <div className="relative overflow-x-auto">
          <table className="w-full min-w-[520px] text-sm">
            <thead>
              <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                <th scope="col" className="py-2 pr-3 font-medium">Keyword</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Volume</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">Allintitle</th>
                <th scope="col" className="px-3 py-2 text-right font-medium">KGR</th>
                <th scope="col" className="py-2 pl-3 font-medium">Verdict</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ keyword, allintitle, ratio }) => (
                <tr key={keyword.id} className="border-b border-slate-100 last:border-0">
                  <td className="py-2 pr-3 text-slate-900">{keyword.keyword}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(keyword.searchVolume)}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatNumber(allintitle)}</td>
                  <td className="px-3 py-2 text-right font-semibold tabular-nums">{ratio === null ? "—" : ratio.toFixed(2)}</td>
                  <td className="py-2 pl-3">
                    {ratio === null ? <span className="text-xs text-slate-400">Not checked</span> : (
                      <Badge tone={RATINGS[kgrRating(ratio)].tone}>{RATINGS[kgrRating(ratio)].label}</Badge>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

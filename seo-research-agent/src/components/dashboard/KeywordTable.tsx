"use client";

import { useMemo, useState } from "react";

import type { KeywordDto } from "@/features/research/types";
import { Button } from "@/components/ui/Button";
import { capitalize, formatCurrencyMicros, formatNumber } from "@/lib/format";

/** The filter only earns its space once the list is long enough to scan. */
const FILTER_THRESHOLD = 10;

type KeywordTableProps = {
  keywords: KeywordDto[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

export function KeywordTable({ keywords, hasMore, loadingMore, onLoadMore }: KeywordTableProps) {
  const [filter, setFilter] = useState("");
  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return needle ? keywords.filter((item) => item.keyword.toLowerCase().includes(needle)) : keywords;
  }, [filter, keywords]);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {keywords.length > FILTER_THRESHOLD ? (
        <div className="border-b border-slate-200 p-3">
          <label htmlFor="keyword-filter" className="sr-only">Filter keywords</label>
          <input
            id="keyword-filter"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter keywords"
            className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm sm:w-64"
          />
        </div>
      ) : null}

      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Keyword</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Monthly searches</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">Difficulty</th>
              <th scope="col" className="px-4 py-2.5 text-right font-medium">CPC</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Intent</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item) => (
              <tr key={item.id}>
                <td className="px-4 py-2.5 font-medium text-slate-900">{item.keyword}</td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(item.searchVolume)}</td>
                <td className="px-4 py-2.5 text-right"><DifficultyBadge value={item.difficulty} /></td>
                <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyMicros(item.cpcMicros)}</td>
                <td className="px-4 py-2.5 text-slate-600">
                  {item.intent === "unknown" ? "—" : capitalize(item.intent)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            {keywords.length === 0 ? "No keywords found for this topic." : "No keywords match this filter."}
          </p>
        ) : null}
      </div>

      {hasMore ? (
        <div className="border-t border-slate-200 p-3 text-center">
          <Button variant="secondary" size="sm" onClick={onLoadMore} disabled={loadingMore}>
            {loadingMore ? "Loading…" : "Load more"}
          </Button>
        </div>
      ) : null}
    </div>
  );
}

function DifficultyBadge({ value }: { value: number | null }) {
  if (value === null) return <span className="text-slate-400">—</span>;
  const tone =
    value < 30 ? "bg-emerald-50 text-emerald-700"
      : value < 60 ? "bg-amber-50 text-amber-700"
        : "bg-rose-50 text-rose-700";
  return (
    <span className={`inline-block min-w-9 rounded-md px-2 py-0.5 text-center text-xs font-semibold tabular-nums ${tone}`}>
      {value}
    </span>
  );
}

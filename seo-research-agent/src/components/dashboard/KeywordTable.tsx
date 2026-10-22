"use client";

import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { competitionLevel, trendVolumes } from "@/features/research/niche";
import type { KeywordDto } from "@/features/research/types";
import { Badge, difficultyTone, nicheTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { describeTrend, Sparkline } from "@/components/ui/Sparkline";
import { capitalize, formatCurrencyMicros, formatNumber } from "@/lib/format";

/** The filters only earn their space once the list is long enough to scan. */
const FILTER_THRESHOLD = 10;

type SortKey = "searchVolume" | "difficulty" | "cpcMicros" | "nicheScore";
type Sort = { key: SortKey; direction: "asc" | "desc" } | null;

const MAX_DIFFICULTY_OPTIONS = [
  { label: "Any difficulty", value: "" },
  { label: "Difficulty ≤ 30", value: "30" },
  { label: "Difficulty ≤ 50", value: "50" },
];

type KeywordTableProps = {
  keywords: KeywordDto[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (keyword: KeywordDto) => void;
  emptyMessage?: string;
};

export function KeywordTable({ keywords, hasMore, loadingMore, onLoadMore, onSelect, emptyMessage }: KeywordTableProps) {
  const [filter, setFilter] = useState("");
  const [maxDifficulty, setMaxDifficulty] = useState("");
  const [sort, setSort] = useState<Sort>(null);

  const visible = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    const limit = maxDifficulty ? Number(maxDifficulty) : null;
    const rows = keywords.filter(
      (item) =>
        (!needle || item.keyword.toLowerCase().includes(needle)) &&
        (limit === null || (item.difficulty !== null && item.difficulty <= limit)),
    );
    return sort ? [...rows].sort((a, b) => compare(a[sort.key], b[sort.key], sort.direction)) : rows;
  }, [filter, keywords, maxDifficulty, sort]);

  function toggleSort(key: SortKey) {
    // Numbers people scan for "biggest" start descending; difficulty starts ascending.
    const first = key === "difficulty" ? "asc" : "desc";
    setSort((current) =>
      current?.key !== key ? { key, direction: first }
        : current.direction === first ? { key, direction: first === "asc" ? "desc" : "asc" }
          : null,
    );
  }

  const showNiche = keywords.some((item) => item.nicheScore !== null);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {keywords.length > FILTER_THRESHOLD ? (
        <div className="flex flex-wrap gap-2 border-b border-slate-200 p-3">
          <label htmlFor="keyword-filter" className="sr-only">Filter keywords</label>
          <input
            id="keyword-filter"
            type="search"
            value={filter}
            onChange={(event) => setFilter(event.target.value)}
            placeholder="Filter keywords"
            className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm sm:max-w-64"
          />
          <label htmlFor="max-difficulty" className="sr-only">Maximum difficulty</label>
          <select
            id="max-difficulty"
            value={maxDifficulty}
            onChange={(event) => setMaxDifficulty(event.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
          >
            {MAX_DIFFICULTY_OPTIONS.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
          </select>
        </div>
      ) : null}

      {/* relative: keeps absolutely positioned sr-only labels inside the scroll area. */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[760px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th scope="col" className="px-4 py-2.5 font-medium">Keyword</th>
              <SortHeader label="Volume" sortKey="searchVolume" sort={sort} onSort={toggleSort} />
              <th scope="col" className="px-4 py-2.5 font-medium">Trend</th>
              <SortHeader label="Difficulty" sortKey="difficulty" sort={sort} onSort={toggleSort} />
              <SortHeader label="CPC" sortKey="cpcMicros" sort={sort} onSort={toggleSort} />
              <th scope="col" className="px-4 py-2.5 font-medium">Competition</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Intent</th>
              {showNiche ? <SortHeader label="Niche" sortKey="nicheScore" sort={sort} onSort={toggleSort} /> : null}
              <th scope="col" className="w-8"><span className="sr-only">Open SERP</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item) => {
              const trend = trendVolumes(item.trend);
              return (
                <tr key={item.id} className="group cursor-pointer hover:bg-slate-50" onClick={() => onSelect(item)}>
                  <td className="px-4 py-2.5">
                    {/* The button carries keyboard access; the row click is a pointer convenience. */}
                    <button
                      type="button"
                      onClick={(event) => {
                        event.stopPropagation();
                        onSelect(item);
                      }}
                      className="text-left font-medium text-slate-900 group-hover:text-indigo-700"
                    >
                      {item.keyword}
                    </button>
                    {item.source === "autocomplete" ? (
                      <span className="ml-2 align-middle"><Badge tone="neutral" title="Found with Google Autocomplete">Google suggest</Badge></span>
                    ) : null}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(item.searchVolume)}</td>
                  <td className="px-4 py-2.5"><Sparkline values={trend} label={describeTrend(trend)} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {item.difficulty === null ? <Dash /> : <Badge tone={difficultyTone(item.difficulty)}>{item.difficulty}</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyMicros(item.cpcMicros)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{competitionLevel(item.competition) ?? <Dash />}</td>
                  <td className="px-4 py-2.5 text-slate-600">{item.intent === "unknown" ? <Dash /> : capitalize(item.intent)}</td>
                  {showNiche ? (
                    <td className="px-4 py-2.5 text-right">
                      {item.nicheScore === null ? <Dash /> : <Badge tone={nicheTone(item.nicheScore)}>{item.nicheScore}</Badge>}
                    </td>
                  ) : null}
                  <td className="pr-3 text-slate-300 group-hover:text-indigo-600">
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {visible.length === 0 ? (
          <p className="p-6 text-center text-sm text-slate-500">
            {keywords.length === 0 ? emptyMessage ?? "No keywords found for this topic." : "No keywords match these filters."}
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

function SortHeader({ label, sortKey, sort, onSort }: {
  label: string;
  sortKey: SortKey;
  sort: Sort;
  onSort: (key: SortKey) => void;
}) {
  const active = sort?.key === sortKey;
  const Icon = sort?.direction === "asc" ? ArrowUp : ArrowDown;
  return (
    <th
      scope="col"
      className="px-4 py-2.5 text-right font-medium"
      aria-sort={active ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}
    >
      <button type="button" onClick={() => onSort(sortKey)} className="inline-flex items-center gap-1 hover:text-slate-900">
        {label}
        {active ? <Icon className="h-3 w-3" aria-hidden="true" /> : null}
      </button>
    </th>
  );
}

function Dash() {
  return <span className="text-slate-400">—</span>;
}

/** Sorts nulls last in either direction. */
function compare(a: number | null, b: number | null, direction: "asc" | "desc") {
  if (a === null) return b === null ? 0 : 1;
  if (b === null) return -1;
  return direction === "asc" ? a - b : b - a;
}

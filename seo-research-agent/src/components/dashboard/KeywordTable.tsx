"use client";

import { ArrowDown, ArrowUp, ChevronRight } from "lucide-react";
import { useMemo, useState } from "react";

import { competitionLevel, trendVolumes } from "@/features/research/niche";
import type { Opportunity } from "@/features/research/opportunity";
import type { KeywordDto } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { describeTrend, Sparkline } from "@/components/ui/Sparkline";
import { toCsv } from "@/lib/csv";
import { downloadFile } from "@/lib/download";
import { capitalize, formatCurrencyMicros, formatNumber } from "@/lib/format";

import { EMPTY_FILTERS, ExportActions, FavoriteButton, FilterBar, OpportunityCell, type KeywordFilters } from "./KeywordTableParts";

/** The filters only earn their space once the list is long enough to scan. */
const FILTER_THRESHOLD = 10;

type SortKey = "searchVolume" | "difficulty" | "cpcMicros" | "opportunity";
type Sort = { key: SortKey; direction: "asc" | "desc" } | null;

type KeywordTableProps = {
  keywords: KeywordDto[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
  onSelect: (keyword: KeywordDto) => void;
  emptyMessage?: string;
  /** Opportunity score and tier per keyword id. */
  opportunities?: ReadonlyMap<number, Opportunity>;
  favorites?: { done: ReadonlySet<string>; toggle: (id: string) => void };
  /** File name stem for Copy / CSV / JSON of the shown rows; no export without it. */
  exportName?: string;
};

export function KeywordTable({
  keywords, hasMore, loadingMore, onLoadMore, onSelect, emptyMessage, opportunities, favorites, exportName,
}: KeywordTableProps) {
  const [filters, setFilters] = useState<KeywordFilters>(EMPTY_FILTERS);
  // Until the user picks a column, rank by opportunity when scores are available.
  const [chosenSort, setSort] = useState<Sort | undefined>(undefined);
  const hasOpportunities = Boolean(opportunities);
  const sort = useMemo<Sort>(
    () => (chosenSort !== undefined ? chosenSort : hasOpportunities ? { key: "opportunity", direction: "desc" } : null),
    [chosenSort, hasOpportunities],
  );

  const visible = useMemo(() => {
    const needle = filters.text.trim().toLowerCase();
    const limit = filters.maxDifficulty ? Number(filters.maxDifficulty) : null;
    const rows = keywords.filter((item) =>
      (!needle || item.keyword.toLowerCase().includes(needle)) &&
      (limit === null || (item.difficulty !== null && item.difficulty <= limit)) &&
      (!filters.intent || item.intent === filters.intent) &&
      (!filters.tier || opportunities?.get(item.id)?.tier === filters.tier) &&
      (!filters.favoritesOnly || favorites?.done.has(String(item.id))));
    if (!sort) return rows;
    const valueOf = (item: KeywordDto) => (sort.key === "opportunity" ? opportunities?.get(item.id)?.score ?? null : item[sort.key]);
    return [...rows].sort((a, b) => compare(valueOf(a), valueOf(b), sort.direction));
  }, [filters, keywords, sort, opportunities, favorites]);

  function toggleSort(key: SortKey) {
    // Numbers people scan for "biggest" start descending; difficulty starts ascending.
    const first = key === "difficulty" ? "asc" : "desc";
    setSort(
      sort?.key !== key ? { key, direction: first }
        : sort.direction === first ? { key, direction: first === "asc" ? "desc" : "asc" }
          : null,
    );
  }

  function rowsForExport() {
    return visible.map((item) => ({
      keyword: item.keyword,
      searchVolume: item.searchVolume,
      difficulty: item.difficulty,
      cpcUsd: item.cpcMicros === null ? null : item.cpcMicros / 1_000_000,
      intent: item.intent,
      opportunity: opportunities?.get(item.id)?.score ?? null,
      tier: opportunities?.get(item.id)?.tier ?? null,
      source: item.source,
    }));
  }

  const showToolbar = keywords.length > FILTER_THRESHOLD || Boolean(exportName);

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
      {showToolbar ? (
        <div className="flex flex-col gap-2 border-b border-slate-200 p-3 lg:flex-row lg:items-center lg:justify-between">
          <FilterBar
            filters={filters}
            onChange={(change) => setFilters((current) => ({ ...current, ...change }))}
            showTier={Boolean(opportunities)}
            showFavorites={Boolean(favorites)}
          />
          {exportName ? (
            <ExportActions
              count={visible.length}
              onCopy={() => navigator.clipboard.writeText(visible.map((item) => item.keyword).join("\n"))}
              onCsv={() => {
                const rows = rowsForExport();
                downloadFile(`${exportName}.csv`, toCsv(Object.keys(rows[0]!), rows.map((row) => Object.values(row))), "text/csv;charset=utf-8");
              }}
              onJson={() => downloadFile(`${exportName}.json`, `${JSON.stringify(rowsForExport(), null, 2)}\n`, "application/json")}
            />
          ) : null}
        </div>
      ) : null}

      {/* relative: keeps absolutely positioned sr-only labels inside the scroll area. */}
      <div className="relative overflow-x-auto">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              {favorites ? <th scope="col" className="w-8 pl-3"><span className="sr-only">Favorite</span></th> : null}
              <th scope="col" className="px-4 py-2.5 font-medium">Keyword</th>
              {opportunities ? <SortHeader label="Opportunity" sortKey="opportunity" sort={sort} onSort={toggleSort} /> : null}
              <SortHeader label="Volume" sortKey="searchVolume" sort={sort} onSort={toggleSort} />
              <th scope="col" className="px-4 py-2.5 font-medium">Trend</th>
              <SortHeader label="KD" sortKey="difficulty" sort={sort} onSort={toggleSort} />
              <SortHeader label="CPC" sortKey="cpcMicros" sort={sort} onSort={toggleSort} />
              <th scope="col" className="px-4 py-2.5 font-medium">Competition</th>
              <th scope="col" className="px-4 py-2.5 font-medium">Intent</th>
              <th scope="col" className="w-8"><span className="sr-only">Open SERP</span></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visible.map((item) => {
              const trend = trendVolumes(item.trend);
              return (
                <tr key={item.id} className="group cursor-pointer hover:bg-slate-50" onClick={() => onSelect(item)}>
                  {favorites ? (
                    <td className="pl-3">
                      <FavoriteButton keyword={item} active={favorites.done.has(String(item.id))} onToggle={() => favorites.toggle(String(item.id))} />
                    </td>
                  ) : null}
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
                  {opportunities ? <td className="px-4 py-2.5"><OpportunityCell value={opportunities.get(item.id)} /></td> : null}
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatNumber(item.searchVolume)}</td>
                  <td className="px-4 py-2.5"><Sparkline values={trend} label={describeTrend(trend)} /></td>
                  <td className="px-4 py-2.5 text-right">
                    {item.difficulty === null ? <Dash /> : <Badge tone={difficultyTone(item.difficulty)}>{item.difficulty}</Badge>}
                  </td>
                  <td className="px-4 py-2.5 text-right tabular-nums">{formatCurrencyMicros(item.cpcMicros)}</td>
                  <td className="px-4 py-2.5 text-slate-600">{competitionLevel(item.competition) ?? <Dash />}</td>
                  <td className="px-4 py-2.5 text-slate-600">{item.intent === "unknown" ? <Dash /> : capitalize(item.intent)}</td>
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

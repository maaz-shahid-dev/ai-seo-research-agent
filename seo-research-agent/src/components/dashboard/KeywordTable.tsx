'use client';

import React, { useState, useMemo } from 'react';
import { 
  Search, 
  ArrowUpDown, 
  Download, 
  ExternalLink, 
  Layers, 
  AlertTriangle, 
  RotateCcw,
  Info,
  Check,
  Copy,
  Table as TableIcon,
  FolderTree,
  CheckSquare,
  Square
} from 'lucide-react';
import { KeywordResult, DemoStateMode } from '@/types/seo';
import { exportKeywordsToCSV } from '@/lib/exportCsv';
import { DEMO_CLUSTERS } from '@/data/demo-data';

interface KeywordTableProps {
  keywords: KeywordResult[];
  countryCode: string;
  languageCode: string;
  demoState: DemoStateMode;
  onInspectSerp: (keyword: KeywordResult) => void;
  onResetState: () => void;
}

type SortField = 'keyword' | 'search_volume' | 'keyword_difficulty' | 'cpc';
type SortOrder = 'asc' | 'desc';
type TableViewMode = 'table' | 'clusters';

export const KeywordTable: React.FC<KeywordTableProps> = ({
  keywords,
  countryCode,
  languageCode,
  demoState,
  onInspectSerp,
  onResetState,
}) => {
  const [viewMode, setViewMode] = useState<TableViewMode>('table');
  const [filterQuery, setFilterQuery] = useState('');
  const [intentFilter, setIntentFilter] = useState<string>('all');
  const [difficultyFilter, setDifficultyFilter] = useState<string>('all');
  const [clusterFilter, setClusterFilter] = useState<string>('all');
  const [sortField, setSortField] = useState<SortField>('search_volume');
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('desc');
    }
  };

  // Filter and sort keywords
  const processedKeywords = useMemo(() => {
    return keywords
      .filter((item) => {
        // Query filter
        if (filterQuery.trim()) {
          const q = filterQuery.toLowerCase();
          if (!item.keyword.toLowerCase().includes(q)) return false;
        }
        // Intent filter
        if (intentFilter !== 'all' && item.intent !== intentFilter) {
          return false;
        }
        // Cluster filter
        if (clusterFilter !== 'all' && item.cluster !== clusterFilter) {
          return false;
        }
        // Difficulty filter
        if (difficultyFilter === 'easy') {
          if ((item.keyword_difficulty ?? 100) >= 30) return false;
        } else if (difficultyFilter === 'medium') {
          const kd = item.keyword_difficulty ?? 0;
          if (kd < 30 || kd >= 60) return false;
        } else if (difficultyFilter === 'hard') {
          if ((item.keyword_difficulty ?? 0) < 60) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const valA = a[sortField];
        const valB = b[sortField];

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        const numA = (valA as number) ?? -1;
        const numB = (valB as number) ?? -1;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [keywords, filterQuery, intentFilter, difficultyFilter, clusterFilter, sortField, sortOrder]);

  const copyKeyword = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Batch Selection
  const toggleSelectAll = () => {
    if (selectedIds.size === processedKeywords.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(processedKeywords.map((k) => k.id)));
    }
  };

  const toggleSelectRow = (id: string) => {
    const next = new Set(selectedIds);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    setSelectedIds(next);
  };

  const handleExportSelectedCSV = () => {
    const targetKeywords = selectedIds.size > 0
      ? processedKeywords.filter((k) => selectedIds.has(k.id))
      : processedKeywords;

    exportKeywordsToCSV(
      targetKeywords,
      countryCode,
      languageCode,
      `seo_keywords_${countryCode.toLowerCase()}_demo.csv`
    );
  };

  // Render State 1: Loading Skeleton
  if (demoState === 'loading') {
    return (
      <div className="rounded-xl border border-slate-200 bg-white p-6 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-4">
          <div className="h-6 w-48 animate-pulse rounded bg-slate-200" />
          <div className="h-8 w-32 animate-pulse rounded bg-slate-200" />
        </div>
        <div className="mt-6 space-y-4">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-5 flex-1 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-24 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-20 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-16 animate-pulse rounded bg-slate-100" />
              <div className="h-5 w-28 animate-pulse rounded bg-slate-100" />
            </div>
          ))}
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          Simulating real-time keyword retrieval and metrics calculation...
        </p>
      </div>
    );
  }

  // Render State 2: Error State (PRD FR-09)
  if (demoState === 'error') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-bold text-rose-900">
          Provider Request Failed (Demo Error Simulation)
        </h3>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-rose-700">
          <strong>FR-09 Compliant Error:</strong> The external SEO data provider returned a 504 Gateway Timeout. The application preserved previous research and has not fabricated placeholder numbers.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={onResetState}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Reset to Demo Data
          </button>
        </div>
      </div>
    );
  }

  // Render State 3: Rate Limit Warning (PRD FR-09)
  if (demoState === 'rate_limit') {
    return (
      <div className="rounded-xl border border-amber-300 bg-amber-50 p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-amber-100 text-amber-700">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-base font-bold text-amber-950">
          SEO Provider Rate Limit Exceeded (HTTP 429)
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-amber-800">
          Per PRD FR-09: The configured provider account has reached its burst query quota. Backoff cooldown active (retry in 60s). Existing cached records remain safe and exportable.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            onClick={onResetState}
            className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-800"
          >
            <RotateCcw className="h-3.5 w-3.5" />
            Restore Normal Demo View
          </button>
        </div>
      </div>
    );
  }

  // Render State 4: Empty State
  if (demoState === 'empty' || (keywords.length === 0 && !filterQuery)) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Layers className="h-6 w-6" />
        </div>
        <h3 className="mt-4 text-sm font-bold text-slate-800">No Keywords Discovered</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
          No keyword opportunities were found for the selected seed query and market. Try broadening the search term or switching the target country.
        </p>
        <div className="mt-5">
          <button
            onClick={onResetState}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Load Sample Demo Keywords
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Table Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: View Mode Toggle & In-table Filter Input */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* View mode toggle */}
          <div className="flex items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5">
            <button
              onClick={() => setViewMode('table')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" />
              <span>Table</span>
            </button>
            <button
              onClick={() => setViewMode('clusters')}
              className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs font-semibold transition ${
                viewMode === 'clusters' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" />
              <span>Clusters</span>
            </button>
          </div>

          <div className="relative min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter keyword list..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Intent Filter */}
          <select
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            aria-label="Filter by Search Intent"
          >
            <option value="all">Intent: All</option>
            <option value="Informational">Informational</option>
            <option value="Commercial">Commercial</option>
            <option value="Transactional">Transactional</option>
          </select>

          {/* Difficulty Filter */}
          <select
            value={difficultyFilter}
            onChange={(e) => setDifficultyFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            aria-label="Filter by Keyword Difficulty"
          >
            <option value="all">KD: All Difficulties</option>
            <option value="easy">Easy (KD &lt; 30)</option>
            <option value="medium">Medium (KD 30–59)</option>
            <option value="hard">Hard (KD 60+)</option>
          </select>

          {/* Cluster Filter */}
          <select
            value={clusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            aria-label="Filter by Topical Cluster"
          >
            <option value="all">Cluster: All</option>
            {DEMO_CLUSTERS.map((c) => (
              <option key={c.id} value={c.name}>
                {c.name}
              </option>
            ))}
          </select>
        </div>

        {/* Right Actions: Batch Exporter */}
        <div className="flex items-center justify-between gap-3 sm:justify-end">
          <span className="text-xs text-slate-500">
            {selectedIds.size > 0 ? (
              <strong className="text-indigo-600 font-bold">{selectedIds.size} selected</strong>
            ) : (
              <span>Showing <strong className="text-slate-800">{processedKeywords.length}</strong> of {keywords.length}</span>
            )}
          </span>

          <button
            onClick={handleExportSelectedCSV}
            disabled={processedKeywords.length === 0}
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50"
            title="Export to CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" />
            <span>{selectedIds.size > 0 ? `Export Selected (${selectedIds.size})` : 'Export All CSV'}</span>
          </button>
        </div>
      </div>

      {/* CLUSTERS VIEW (Alternative representation) */}
      {viewMode === 'clusters' ? (
        <div className="p-5">
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {DEMO_CLUSTERS.map((cluster) => {
              const clusterKeywords = keywords.filter((k) => k.cluster === cluster.name);
              return (
                <div key={cluster.id} className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-xs">
                  <div className="flex items-start justify-between">
                    <div>
                      <span className="rounded bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
                        Topical Cluster
                      </span>
                      <h4 className="mt-1 text-sm font-bold text-slate-900">{cluster.name}</h4>
                    </div>
                    <span className="text-xs font-mono font-bold text-indigo-700">
                      {cluster.totalVolume.toLocaleString()} vol/mo
                    </span>
                  </div>

                  <div className="mt-3 flex items-center gap-3 text-xs text-slate-600">
                    <span>{clusterKeywords.length} keywords</span>
                    <span>•</span>
                    <span className="font-semibold text-emerald-700">Avg KD {cluster.avgDifficulty}</span>
                    <span>•</span>
                    <span className="text-slate-500">Intent: {cluster.intent}</span>
                  </div>

                  {/* Top keywords in cluster */}
                  <div className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-2.5">
                    {clusterKeywords.slice(0, 3).map((kw) => (
                      <div key={kw.id} className="flex items-center justify-between text-xs text-slate-700">
                        <span className="truncate max-w-[220px]">{kw.keyword}</span>
                        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-500">
                          <span>{kw.search_volume?.toLocaleString()} vol</span>
                          <span className="font-semibold text-slate-800">KD {kw.keyword_difficulty}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-4 pr-2 w-8">
                  <button onClick={toggleSelectAll} className="text-slate-400 hover:text-slate-700" aria-label="Select all rows">
                    {selectedIds.size === processedKeywords.length && processedKeywords.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-indigo-600" />
                    ) : (
                      <Square className="h-4 w-4" />
                    )}
                  </button>
                </th>
                <th className="py-3 px-3">
                  <button
                    onClick={() => handleSort('keyword')}
                    className="flex items-center gap-1 hover:text-slate-900 transition"
                  >
                    <span>Keyword &amp; 12-mo Trend</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button
                    onClick={() => handleSort('search_volume')}
                    className="flex items-center justify-end gap-1 hover:text-slate-900 transition w-full"
                  >
                    <span>Search Volume</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="px-3 py-3 text-center">
                  <button
                    onClick={() => handleSort('keyword_difficulty')}
                    className="flex items-center justify-center gap-1 hover:text-slate-900 transition w-full"
                  >
                    <span>Difficulty (KD)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right">
                  <button
                    onClick={() => handleSort('cpc')}
                    className="flex items-center justify-end gap-1 hover:text-slate-900 transition w-full"
                  >
                    <span>CPC (USD)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" />
                  </button>
                </th>
                <th className="px-3 py-3 text-center">Search Intent</th>
                <th className="px-3 py-3">Provenance / Freshness</th>
                <th className="py-3 pl-3 pr-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {processedKeywords.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center text-xs text-slate-400">
                    No matching keywords found for filter &quot;{filterQuery}&quot;.
                  </td>
                </tr>
              ) : (
                processedKeywords.map((item) => {
                  const kd = item.keyword_difficulty ?? 0;
                  let kdColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                  let kdBarColor = 'bg-emerald-500';
                  if (kd >= 60) {
                    kdColor = 'bg-rose-50 text-rose-700 border-rose-200';
                    kdBarColor = 'bg-rose-500';
                  } else if (kd >= 30) {
                    kdColor = 'bg-amber-50 text-amber-700 border-amber-200';
                    kdBarColor = 'bg-amber-500';
                  }

                  let intentBadge = 'bg-slate-100 text-slate-700';
                  if (item.intent === 'Informational') intentBadge = 'bg-blue-50 text-blue-700 border border-blue-100';
                  if (item.intent === 'Commercial') intentBadge = 'bg-purple-50 text-purple-700 border border-purple-100';
                  if (item.intent === 'Transactional') intentBadge = 'bg-emerald-50 text-emerald-700 border border-emerald-100';

                  const isRowSelected = selectedIds.has(item.id);

                  return (
                    <tr key={item.id} className={`hover:bg-slate-50/80 transition ${isRowSelected ? 'bg-indigo-50/40' : ''}`}>
                      {/* Checkbox */}
                      <td className="py-3 pl-4 pr-2">
                        <button onClick={() => toggleSelectRow(item.id)} className="text-slate-400 hover:text-slate-700">
                          {isRowSelected ? (
                            <CheckSquare className="h-4 w-4 text-indigo-600" />
                          ) : (
                            <Square className="h-4 w-4" />
                          )}
                        </button>
                      </td>

                      {/* Keyword + 12 Mo Mini Sparkline */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{item.keyword}</span>
                            <button
                              onClick={() => copyKeyword(item.id, item.keyword)}
                              className="text-slate-300 hover:text-slate-600 transition"
                              title="Copy keyword"
                            >
                              {copiedId === item.id ? (
                                <Check className="h-3 w-3 text-emerald-600" />
                              ) : (
                                <Copy className="h-3 w-3" />
                              )}
                            </button>
                          </div>
                          {item.cluster && (
                            <span className="text-[10px] text-slate-400">{item.cluster}</span>
                          )}
                          {/* Mini Sparkline Bar Chart */}
                          {item.trend && (
                            <div className="flex items-end gap-0.5 h-3 pt-1" title="12-month relative interest trend">
                              {item.trend.map((val, idx) => (
                                <div
                                  key={idx}
                                  className="w-1 rounded-2xs bg-indigo-200 transition hover:bg-indigo-600"
                                  style={{ height: `${Math.max(15, (val / 100) * 12)}px` }}
                                />
                              ))}
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Search Volume */}
                      <td className="px-3 py-3 text-right font-mono text-slate-900">
                        {item.search_volume !== null ? item.search_volume.toLocaleString() : 'N/A'}
                      </td>

                      {/* Difficulty KD */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col items-center justify-center gap-1">
                          <span className={`inline-flex items-center rounded-md border px-2 py-0.5 text-[11px] font-bold ${kdColor}`}>
                            {item.keyword_difficulty !== null ? `${item.keyword_difficulty}` : 'N/A'}
                          </span>
                          {item.keyword_difficulty !== null && (
                            <div className="h-1 w-16 overflow-hidden rounded-full bg-slate-100">
                              <div
                                className={`h-full ${kdBarColor}`}
                                style={{ width: `${item.keyword_difficulty}%` }}
                              />
                            </div>
                          )}
                        </div>
                      </td>

                      {/* CPC */}
                      <td className="px-3 py-3 text-right font-mono text-slate-800">
                        {item.cpc !== null ? `$${item.cpc.toFixed(2)}` : 'N/A'}
                      </td>

                      {/* Search Intent */}
                      <td className="px-3 py-3 text-center">
                        <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-semibold ${intentBadge}`}>
                          {item.intent || 'Unclassified'}
                        </span>
                      </td>

                      {/* Provenance */}
                      <td className="px-3 py-3">
                        <div className="flex flex-col text-[10px] text-slate-400">
                          <span className="font-medium text-slate-600 truncate max-w-[160px]">{item.source}</span>
                          <span>{item.retrieved_at}</span>
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="py-3 pl-3 pr-4 text-right">
                        <button
                          onClick={() => onInspectSerp(item)}
                          className="inline-flex items-center gap-1 rounded-lg border border-indigo-200 bg-indigo-50/70 px-2.5 py-1 text-[11px] font-semibold text-indigo-700 transition hover:bg-indigo-100"
                          title="Inspect top ranking URLs and competitor domains"
                        >
                          <span>Inspect SERP</span>
                          <ExternalLink className="h-3 w-3" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* Table Footer */}
      <div className="flex flex-col items-start justify-between gap-2 border-t border-slate-100 bg-slate-50/50 px-4 py-2.5 text-[11px] text-slate-500 sm:flex-row sm:items-center">
        <div className="flex items-center gap-1.5">
          <Info className="h-3.5 w-3.5 text-slate-400" />
          <span>
            <strong>Data Integrity:</strong> Metrics are from static demo mock adapter. Third-party scores are not Google ratings.
          </span>
        </div>
        <div className="text-[10px] text-slate-400">
          Target Market: {countryCode} ({languageCode})
        </div>
      </div>
    </div>
  );
};

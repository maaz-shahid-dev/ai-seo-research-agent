'use client';

import React, { useEffect, useMemo, useRef, useState } from 'react';
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
} from 'lucide-react';
import { KeywordResult, DemoStateMode } from '@/types/seo';
import { exportKeywordsToCSV } from '@/lib/exportCsv';

interface KeywordTableProps {
  keywords: KeywordResult[];
  snapshotId: string | null;
  countryCode: string;
  languageCode: string;
  demoState: DemoStateMode;
  onInspectSerp: (keyword: KeywordResult) => void;
  onResetState: () => void;
}

type SortField = 'keyword' | 'search_volume' | 'keyword_difficulty' | 'cpc';
type SortOrder = 'asc' | 'desc';
type TableViewMode = 'table' | 'clusters';
type CopyStatus = 'success' | 'error';

interface ClusterSummary {
  name: string;
  keywords: KeywordResult[];
  totalVolume: number;
  averageDifficulty: number | null;
  dominantIntent: string;
}

interface SelectionState {
  keywordIdsKey: string;
  ids: Set<string>;
}

export const KeywordTable: React.FC<KeywordTableProps> = ({
  keywords,
  snapshotId,
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
  const [copyFeedback, setCopyFeedback] = useState<{ id: string; status: CopyStatus } | null>(null);
  const keywordIdsKey = `${snapshotId ?? 'no-snapshot'}:${JSON.stringify(keywords.map((keyword) => keyword.id))}`;
  const [selection, setSelection] = useState<SelectionState>(() => ({
    keywordIdsKey,
    ids: new Set(),
  }));
  const selectAllRef = useRef<HTMLInputElement>(null);
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const copyRequestRef = useRef(0);

  const clusterOptions = useMemo(
    () => Array.from(new Set(keywords.map((item) => item.cluster).filter((cluster): cluster is string => Boolean(cluster)))).sort(),
    [keywords],
  );
  const effectiveClusterFilter = clusterFilter === 'all' || clusterOptions.includes(clusterFilter)
    ? clusterFilter
    : 'all';

  const selectedIds = selection.keywordIdsKey === keywordIdsKey ? selection.ids : new Set<string>();

  useEffect(() => {
    return () => {
      copyRequestRef.current += 1;
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    };
  }, []);

  // Sorting handler
  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortOrder((current) => (current === 'asc' ? 'desc' : 'asc'));
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
        if (effectiveClusterFilter !== 'all' && item.cluster !== effectiveClusterFilter) {
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

        if (valA === null && valB === null) return 0;
        if (valA === null) return 1;
        if (valB === null) return -1;

        if (typeof valA === 'string' && typeof valB === 'string') {
          return sortOrder === 'asc' ? valA.localeCompare(valB) : valB.localeCompare(valA);
        }

        const numA = valA as number;
        const numB = valB as number;
        return sortOrder === 'asc' ? numA - numB : numB - numA;
      });
  }, [keywords, filterQuery, intentFilter, difficultyFilter, effectiveClusterFilter, sortField, sortOrder]);

  const visibleIds = useMemo(() => processedKeywords.map((keyword) => keyword.id), [processedKeywords]);
  const selectedVisibleCount = visibleIds.reduce(
    (count, id) => count + (selectedIds.has(id) ? 1 : 0),
    0,
  );
  const allVisibleSelected = visibleIds.length > 0 && selectedVisibleCount === visibleIds.length;
  const someVisibleSelected = selectedVisibleCount > 0 && !allVisibleSelected;

  useEffect(() => {
    if (selectAllRef.current) {
      selectAllRef.current.indeterminate = someVisibleSelected;
    }
  }, [someVisibleSelected]);

  const clusterSummaries = useMemo<ClusterSummary[]>(() => {
    const groups = new Map<string, KeywordResult[]>();

    processedKeywords.forEach((keyword) => {
      const name = keyword.cluster || 'Unclustered';
      groups.set(name, [...(groups.get(name) || []), keyword]);
    });

    return Array.from(groups, ([name, clusterKeywords]) => {
      const difficultyValues = clusterKeywords
        .map((keyword) => keyword.keyword_difficulty)
        .filter((difficulty): difficulty is number => difficulty !== null);
      const intentCounts = new Map<string, number>();

      clusterKeywords.forEach((keyword) => {
        const intent = keyword.intent || 'Unclassified';
        intentCounts.set(intent, (intentCounts.get(intent) || 0) + 1);
      });

      const dominantIntent = Array.from(intentCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || 'Unclassified';

      return {
        name,
        keywords: clusterKeywords,
        totalVolume: clusterKeywords.reduce((sum, keyword) => sum + (keyword.search_volume ?? 0), 0),
        averageDifficulty: difficultyValues.length > 0
          ? Math.round(difficultyValues.reduce((sum, difficulty) => sum + difficulty, 0) / difficultyValues.length)
          : null,
        dominantIntent,
      };
    }).sort((a, b) => a.name.localeCompare(b.name));
  }, [processedKeywords]);

  const copyKeyword = async (id: string, keyword: string) => {
    const requestId = ++copyRequestRef.current;
    if (copyTimerRef.current) clearTimeout(copyTimerRef.current);
    setCopyFeedback(null);

    try {
      if (!navigator.clipboard?.writeText) {
        throw new Error('Clipboard API unavailable');
      }
      await navigator.clipboard.writeText(keyword);
      if (requestId !== copyRequestRef.current) return;
      setCopyFeedback({ id, status: 'success' });
    } catch {
      if (requestId !== copyRequestRef.current) return;
      setCopyFeedback({ id, status: 'error' });
    }

    copyTimerRef.current = setTimeout(() => {
      if (requestId === copyRequestRef.current) setCopyFeedback(null);
    }, 2000);
  };

  // Batch Selection
  const toggleSelectAll = () => {
    setSelection((current) => {
      const next = new Set(current.keywordIdsKey === keywordIdsKey ? current.ids : []);
      visibleIds.forEach((id) => {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      });
      return { keywordIdsKey, ids: next };
    });
  };

  const toggleSelectRow = (id: string) => {
    setSelection((current) => {
      const next = new Set(current.keywordIdsKey === keywordIdsKey ? current.ids : []);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return { keywordIdsKey, ids: next };
    });
  };

  const handleExportSelectedCSV = () => {
    const targetKeywords = selectedIds.size > 0
      ? keywords.filter((keyword) => selectedIds.has(keyword.id))
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
          Demo UI preview: looking for an exact bundled research snapshot...
        </p>
      </div>
    );
  }

  // Render State 2: Error State (PRD FR-09)
  if (demoState === 'error') {
    return (
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-8 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-rose-100 text-rose-600">
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-bold text-rose-900">
          Provider Error UI Preview
        </h3>
        <p className="mx-auto mt-2 max-w-md text-xs leading-relaxed text-rose-700">
          This is a visual error-state preview. No live provider request was made, no HTTP status was received, and no replacement metrics were generated.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onResetState}
            className="flex items-center gap-2 rounded-lg bg-rose-600 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-rose-700"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Return to Loaded Snapshot
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
          <AlertTriangle className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-base font-bold text-amber-950">
          Rate-Limit UI Preview
        </h3>
        <p className="mx-auto mt-2 max-w-lg text-xs leading-relaxed text-amber-800">
          This preview demonstrates how a provider limit would be presented. No live quota, cooldown, or retry time is available in the static demo.
        </p>
        <div className="mt-5 flex justify-center gap-3">
          <button
            type="button"
            onClick={onResetState}
            className="flex items-center gap-2 rounded-lg bg-amber-700 px-4 py-2 text-xs font-semibold text-white shadow-sm transition hover:bg-amber-800"
          >
            <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
            Return to Loaded Snapshot
          </button>
        </div>
      </div>
    );
  }

  // Render State 4: Empty State
  if (demoState === 'empty' || keywords.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center shadow-xs">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-slate-100 text-slate-400">
          <Layers className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="mt-4 text-sm font-bold text-slate-800">No Keywords Discovered</h3>
        <p className="mx-auto mt-1 max-w-sm text-xs text-slate-500">
          No keyword opportunities were found for the selected seed query and market. Try broadening the search term or switching the target country.
        </p>
        {snapshotId && <div className="mt-5">
          <button
            type="button"
            onClick={onResetState}
            className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-semibold text-white shadow-sm hover:bg-indigo-700"
          >
            Return to Loaded Snapshot
          </button>
        </div>}
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white shadow-xs">
      {/* Table Toolbar */}
      <div className="flex flex-col gap-3 border-b border-slate-100 p-4 lg:flex-row lg:items-center lg:justify-between">
        {/* Left: View Mode Toggle & In-table Filter Input */}
        <div className="grid min-w-0 grid-cols-1 gap-2.5 sm:grid-cols-2 lg:flex lg:flex-wrap lg:items-center">
          {/* View mode toggle */}
          <div
            className="flex w-full items-center rounded-lg border border-slate-200 bg-slate-50 p-0.5 sm:w-auto"
            role="group"
            aria-label="Keyword display mode"
          >
            <button
              type="button"
              onClick={() => setViewMode('table')}
              aria-pressed={viewMode === 'table'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:flex-none ${
                viewMode === 'table' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <TableIcon className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Table</span>
            </button>
            <button
              type="button"
              onClick={() => setViewMode('clusters')}
              aria-pressed={viewMode === 'clusters'}
              className={`flex flex-1 items-center justify-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-semibold transition sm:flex-none ${
                viewMode === 'clusters' ? 'bg-white text-indigo-700 shadow-2xs' : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" aria-hidden="true" />
              <span>Clusters</span>
            </button>
          </div>

          <div className="relative min-w-0 sm:min-w-[200px]">
            <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" aria-hidden="true" />
            <input
              type="text"
              value={filterQuery}
              onChange={(e) => setFilterQuery(e.target.value)}
              placeholder="Filter keyword list..."
              aria-label="Filter keywords by text"
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-8 pr-3 py-1.5 text-xs text-slate-800 placeholder-slate-400 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>

          {/* Intent Filter */}
          <select
            value={intentFilter}
            onChange={(e) => setIntentFilter(e.target.value)}
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
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
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            aria-label="Filter by Keyword Difficulty"
          >
            <option value="all">KD: All Difficulties</option>
            <option value="easy">Easy (KD &lt; 30)</option>
            <option value="medium">Medium (KD 30–59)</option>
            <option value="hard">Hard (KD 60+)</option>
          </select>

          {/* Cluster Filter */}
          <select
            value={effectiveClusterFilter}
            onChange={(e) => setClusterFilter(e.target.value)}
            className="min-w-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-medium text-slate-700 focus:border-indigo-500 focus:bg-white focus:outline-none"
            aria-label="Filter by Topical Cluster"
          >
            <option value="all">Cluster: All</option>
            {clusterOptions.map((cluster) => (
              <option key={cluster} value={cluster}>
                {cluster}
              </option>
            ))}
          </select>
        </div>

        {/* Right Actions: Batch Exporter */}
        <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
          <span className="text-xs text-slate-500">
            {selectedIds.size > 0 ? (
              <strong className="text-indigo-600 font-bold">
                {selectedIds.size} selected{selectedVisibleCount !== selectedIds.size ? ` (${selectedVisibleCount} visible)` : ''}
              </strong>
            ) : (
              <span>Showing <strong className="text-slate-800">{processedKeywords.length}</strong> of {keywords.length}</span>
            )}
          </span>

          <button
            type="button"
            onClick={handleExportSelectedCSV}
            disabled={selectedIds.size === 0 && processedKeywords.length === 0}
            className="flex w-full items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs transition hover:bg-slate-50 hover:text-slate-900 disabled:opacity-50 sm:w-auto"
            title="Export to CSV"
          >
            <Download className="h-3.5 w-3.5 text-slate-500" aria-hidden="true" />
            <span>{selectedIds.size > 0
              ? `Export Selected (${selectedIds.size})`
              : `Export Filtered (${processedKeywords.length})`}</span>
          </button>
        </div>
      </div>

      {/* CLUSTERS VIEW (Alternative representation) */}
      {viewMode === 'clusters' ? (
        <div className="p-4 sm:p-5">
          {clusterSummaries.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 px-4 py-10 text-center text-xs text-slate-500">
              No keywords match the current text, intent, difficulty, and cluster filters.
            </div>
          ) : (
            <>
              <p className="mb-3 text-xs text-slate-500" aria-live="polite">
                Showing <strong className="text-slate-800">{clusterSummaries.length}</strong>{' '}
                {clusterSummaries.length === 1 ? 'cluster' : 'clusters'} from the{' '}
                <strong className="text-slate-800">{processedKeywords.length}</strong> filtered{' '}
                {processedKeywords.length === 1 ? 'keyword' : 'keywords'}.
              </p>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                {clusterSummaries.map((cluster) => (
                <div key={cluster.name} className="min-w-0 rounded-xl border border-slate-200 bg-slate-50/50 p-4 transition hover:bg-white hover:shadow-xs">
                  <div className="flex flex-wrap items-start justify-between gap-2">
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

                  <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
                    <span>{cluster.keywords.length} {cluster.keywords.length === 1 ? 'keyword' : 'keywords'}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span className="font-semibold text-emerald-700">Avg KD {cluster.averageDifficulty ?? 'N/A'}</span>
                    <span aria-hidden="true">&bull;</span>
                    <span className="text-slate-500">Dominant intent: {cluster.dominantIntent}</span>
                  </div>

                  {/* Top keywords in cluster */}
                  <div className="mt-3 space-y-1.5 border-t border-slate-200/60 pt-2.5">
                    {cluster.keywords.slice(0, 3).map((kw) => (
                      <div key={kw.id} className="flex min-w-0 items-center justify-between gap-3 text-xs text-slate-700">
                        <span className="min-w-0 truncate">{kw.keyword}</span>
                        <div className="flex items-center gap-2 shrink-0 text-[11px] font-mono text-slate-500">
                          <span>{kw.search_volume?.toLocaleString() ?? 'N/A'} vol</span>
                          <span className="font-semibold text-slate-800">KD {kw.keyword_difficulty ?? 'N/A'}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                ))}
              </div>
            </>
          )}
        </div>
      ) : (
        /* TABLE VIEW */
        <div className="overflow-x-auto" role="region" aria-label="Keyword results table" tabIndex={0}>
          <table className="w-full min-w-[980px] border-collapse text-left text-xs">
            <caption className="sr-only">
              Keyword evidence for {countryCode} in {languageCode}
            </caption>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-4 pr-2 w-8">
                  <input
                    ref={selectAllRef}
                    type="checkbox"
                    checked={allVisibleSelected}
                    onChange={toggleSelectAll}
                    disabled={visibleIds.length === 0}
                    aria-label={`${allVisibleSelected ? 'Deselect' : 'Select'} all ${visibleIds.length} visible keywords`}
                    className="h-4 w-4 rounded border-slate-300 accent-indigo-600 disabled:opacity-50"
                  />
                </th>
                <th className="py-3 px-3" aria-sort={sortField === 'keyword' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => handleSort('keyword')}
                    className="flex items-center gap-1 hover:text-slate-900 transition"
                    aria-label={`Sort by keyword ${sortField === 'keyword' && sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <span>Keyword &amp; 12-mo Trend</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right" aria-sort={sortField === 'search_volume' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => handleSort('search_volume')}
                    className="flex items-center justify-end gap-1 hover:text-slate-900 transition w-full"
                    aria-label={`Sort by search volume ${sortField === 'search_volume' && sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <span>Search Volume</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-3 text-center" aria-sort={sortField === 'keyword_difficulty' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => handleSort('keyword_difficulty')}
                    className="flex items-center justify-center gap-1 hover:text-slate-900 transition w-full"
                    aria-label={`Sort by keyword difficulty ${sortField === 'keyword_difficulty' && sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <span>Difficulty (KD)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
                  </button>
                </th>
                <th className="px-3 py-3 text-right" aria-sort={sortField === 'cpc' ? (sortOrder === 'asc' ? 'ascending' : 'descending') : 'none'}>
                  <button
                    type="button"
                    onClick={() => handleSort('cpc')}
                    className="flex items-center justify-end gap-1 hover:text-slate-900 transition w-full"
                    aria-label={`Sort by CPC ${sortField === 'cpc' && sortOrder === 'asc' ? 'descending' : 'ascending'}`}
                  >
                    <span>CPC (USD)</span>
                    <ArrowUpDown className="h-3 w-3 text-slate-400" aria-hidden="true" />
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
                    No keywords match the current text, intent, difficulty, and cluster filters.
                  </td>
                </tr>
              ) : (
                processedKeywords.map((item) => {
                  const kd = item.keyword_difficulty;
                  let kdColor = 'border-slate-200 bg-slate-50 text-slate-500';
                  let kdBarColor = 'bg-slate-300';
                  if (kd !== null && kd >= 60) {
                    kdColor = 'bg-rose-50 text-rose-700 border-rose-200';
                    kdBarColor = 'bg-rose-500';
                  } else if (kd !== null && kd >= 30) {
                    kdColor = 'bg-amber-50 text-amber-700 border-amber-200';
                    kdBarColor = 'bg-amber-500';
                  } else if (kd !== null) {
                    kdColor = 'bg-emerald-50 text-emerald-700 border-emerald-200';
                    kdBarColor = 'bg-emerald-500';
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
                        <input
                          type="checkbox"
                          checked={isRowSelected}
                          onChange={() => toggleSelectRow(item.id)}
                          aria-label={`Select ${item.keyword}`}
                          className="h-4 w-4 rounded border-slate-300 accent-indigo-600"
                        />
                      </td>

                      {/* Keyword + 12 Mo Mini Sparkline */}
                      <td className="py-3 px-3">
                        <div className="flex flex-col gap-1">
                          <div className="flex items-center gap-2">
                            <span className="font-semibold text-slate-900">{item.keyword}</span>
                            <button
                              type="button"
                              onClick={() => copyKeyword(item.id, item.keyword)}
                              className="inline-flex items-center gap-1 text-slate-400 hover:text-slate-700 transition"
                              aria-label={`Copy ${item.keyword}`}
                              title={copyFeedback?.id === item.id && copyFeedback.status === 'error' ? 'Copy failed' : 'Copy keyword'}
                            >
                              {copyFeedback?.id === item.id && copyFeedback.status === 'success' ? (
                                <Check className="h-3 w-3 text-emerald-600" aria-hidden="true" />
                              ) : copyFeedback?.id === item.id && copyFeedback.status === 'error' ? (
                                <AlertTriangle className="h-3 w-3 text-rose-600" aria-hidden="true" />
                              ) : (
                                <Copy className="h-3 w-3" aria-hidden="true" />
                              )}
                            </button>
                            {copyFeedback?.id === item.id && (
                              <span
                                className={copyFeedback.status === 'success' ? 'text-[10px] text-emerald-700' : 'text-[10px] text-rose-700'}
                                role={copyFeedback.status === 'error' ? 'alert' : 'status'}
                              >
                                {copyFeedback.status === 'success' ? 'Copied' : 'Copy failed'}
                              </span>
                            )}
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
                          type="button"
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

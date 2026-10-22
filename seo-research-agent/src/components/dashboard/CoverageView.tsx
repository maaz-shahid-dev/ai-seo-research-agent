"use client";

import { Check, ChevronDown, Copy, Download } from "lucide-react";
import { useMemo, useState } from "react";

import { buildCoverageGroups, EASY_DIFFICULTY_MAX, type CoverageGroup } from "@/features/research/coverage-groups";
import type { KeywordDto } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { toCsv } from "@/lib/csv";
import { downloadFile } from "@/lib/download";
import { formatNumber } from "@/lib/format";

type CoverageViewProps = {
  seed: string;
  keywords: KeywordDto[];
  onSelect: (keyword: KeywordDto) => void;
  exportName: string;
};

/** The collected keywords mapped by how people extend the topic, plus vertical packs. */
export function CoverageView({ seed, keywords, onSelect, exportName }: CoverageViewProps) {
  const { patterns, packs } = useMemo(() => buildCoverageGroups(seed, keywords), [seed, keywords]);
  const grouped = new Set(patterns.flatMap((group) => group.keywords.map((keyword) => keyword.id))).size;

  function exportCsv() {
    const rows = [...patterns, ...packs].flatMap((group) =>
      group.keywords.map((keyword) => [group.label, keyword.keyword, keyword.searchVolume, keyword.difficulty]));
    downloadFile(`${exportName}-coverage.csv`, toCsv(["group", "keyword", "volume", "kd"], rows), "text/csv;charset=utf-8");
  }

  if (patterns.length === 0 && packs.length === 0) {
    return <EmptyState>No keyword variations collected for this topic yet.</EmptyState>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="font-semibold text-slate-900">Content coverage</h2>
          <p className="mt-0.5 text-sm text-slate-600">
            {formatNumber(grouped)} keyword variations grouped by pattern. Easy means KD {EASY_DIFFICULTY_MAX} or less.
          </p>
        </div>
        <Button variant="secondary" size="sm" onClick={exportCsv} className="shrink-0">
          <Download className="h-4 w-4" aria-hidden="true" /> Export CSV
        </Button>
      </div>

      {patterns.map((group) => <GroupCard key={group.id} group={group} onSelect={onSelect} />)}

      {packs.length > 0 ? (
        <>
          <h2 className="pt-2 text-sm font-semibold text-slate-900">Vertical packs</h2>
          {packs.map((group) => <GroupCard key={group.id} group={group} onSelect={onSelect} />)}
        </>
      ) : null}
    </div>
  );
}

function GroupCard({ group, onSelect }: { group: CoverageGroup<KeywordDto>; onSelect: (keyword: KeywordDto) => void }) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    await navigator.clipboard.writeText(group.keywords.map((keyword) => keyword.keyword).join("\n"));
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }

  return (
    <details open className="group rounded-xl border border-slate-200 bg-white">
      <summary className="flex cursor-pointer list-none flex-wrap items-center gap-2 px-4 py-3">
        <span className="font-semibold text-slate-900">{group.label}</span>
        <Badge tone="neutral">{group.keywords.length}</Badge>
        {group.easyCount > 0 ? <Badge tone="good">{group.easyCount} easy</Badge> : null}
        <span className="text-xs text-slate-500">{group.description} · {formatNumber(group.totalVolume)} searches/mo</span>
        <span className="ml-auto flex items-center gap-1">
          <button
            type="button"
            onClick={(event) => {
              event.preventDefault();
              void copy();
            }}
            aria-label={`Copy ${group.label} keywords`}
            title="Copy keywords"
            className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
          >
            {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          </button>
          <ChevronDown className="h-4 w-4 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
        </span>
      </summary>
      <ul className="grid gap-2 border-t border-slate-100 p-3 sm:grid-cols-2 xl:grid-cols-3">
        {group.keywords.map((keyword) => (
          <li key={keyword.id}>
            <button
              type="button"
              onClick={() => onSelect(keyword)}
              className="flex w-full items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-left hover:border-indigo-300 hover:bg-slate-50"
            >
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm text-slate-900">{keyword.keyword}</span>
                <span className="block text-xs tabular-nums text-slate-500">{formatNumber(keyword.searchVolume)} searches/mo</span>
              </span>
              {keyword.difficulty === null ? null : <Badge tone={difficultyTone(keyword.difficulty)}>KD {keyword.difficulty}</Badge>}
            </button>
          </li>
        ))}
      </ul>
    </details>
  );
}

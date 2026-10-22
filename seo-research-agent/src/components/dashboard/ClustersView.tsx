"use client";

import { X } from "lucide-react";
import { useMemo, useState } from "react";

import { ARTICLE_TYPE_LABELS, buildContentPlan, type ContentCluster } from "@/features/research/coverage";
import type { KeywordDto } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { formatNumber, titleCase } from "@/lib/format";

type ClustersViewProps = {
  seed: string;
  keywords: KeywordDto[];
  /** Opens a keyword's SERP analysis. */
  onSelect: (keyword: KeywordDto) => void;
};

/** The content plan's topic clusters as cards; each opens a drawer with its keywords. */
export function ClustersView({ seed, keywords, onSelect }: ClustersViewProps) {
  const plan = useMemo(() => buildContentPlan(seed, keywords), [seed, keywords]);
  const [open, setOpen] = useState<ContentCluster<KeywordDto> | null>(null);

  if (plan.clusters.length === 0) return <EmptyState>No clusters yet. Load more keywords or try a broader topic.</EmptyState>;

  return (
    <>
      <p className="text-sm text-slate-600">
        {formatNumber(plan.clusters.length)} clusters · {formatNumber(plan.totalVolume)} searches/mo. Each cluster is one page on your site.
      </p>
      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {plan.clusters.map((cluster) => (
          <li key={cluster.topic}>
            <button
              type="button"
              onClick={() => setOpen(cluster)}
              className="flex h-full w-full flex-col rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-indigo-300 hover:bg-slate-50"
            >
              <span className="flex items-start justify-between gap-2">
                <span className="font-semibold text-slate-900">{titleCase(cluster.topic)}</span>
                <Badge tone="neutral">{ARTICLE_TYPE_LABELS[cluster.articleType]}</Badge>
              </span>
              <span className="mt-1 truncate text-xs text-slate-500">Best keyword: {cluster.mainKeyword}</span>
              <span className="mt-3 grid w-full grid-cols-3 gap-2 text-center">
                <Figure label="Keywords" value={formatNumber(cluster.keywords.length)} />
                <Figure label="Volume" value={formatNumber(cluster.totalVolume)} />
                <Figure
                  label="Avg KD"
                  value={cluster.averageDifficulty === null ? "—" : <Badge tone={difficultyTone(cluster.averageDifficulty)}>{cluster.averageDifficulty}</Badge>}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      {open ? (
        <ClusterDrawer
          cluster={open}
          onClose={() => setOpen(null)}
          onSelect={(keyword) => {
            setOpen(null);
            onSelect(keyword);
          }}
        />
      ) : null}
    </>
  );
}

function ClusterDrawer({ cluster, onClose, onSelect }: { cluster: ContentCluster<KeywordDto>; onClose: () => void; onSelect: (keyword: KeywordDto) => void }) {
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);
  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div ref={dialogRef} role="dialog" aria-modal="true" aria-labelledby="cluster-title" tabIndex={-1} className="relative flex h-full w-full max-w-lg flex-col overflow-y-auto bg-white shadow-xl">
        <header className="sticky top-0 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">{ARTICLE_TYPE_LABELS[cluster.articleType]} · {formatNumber(cluster.totalVolume)} searches/mo</p>
            <h2 id="cluster-title" className="truncate text-lg font-semibold text-slate-950">{titleCase(cluster.topic)}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>
        <ul className="divide-y divide-slate-100">
          {cluster.keywords.map((keyword) => (
            <li key={keyword.id}>
              <button type="button" onClick={() => onSelect(keyword)} className="flex w-full items-center gap-3 px-5 py-3 text-left hover:bg-slate-50">
                <span className="min-w-0 flex-1 truncate text-sm text-slate-900">{keyword.keyword}</span>
                <span className="text-xs tabular-nums text-slate-500">{formatNumber(keyword.searchVolume)}/mo</span>
                {keyword.difficulty === null ? null : <Badge tone={difficultyTone(keyword.difficulty)}>KD {keyword.difficulty}</Badge>}
              </button>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}

function Figure({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <span className="rounded-lg bg-slate-50 px-1 py-1.5">
      <span className="block text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</span>
      <span className="mt-0.5 block text-sm font-semibold tabular-nums text-slate-900">{value}</span>
    </span>
  );
}

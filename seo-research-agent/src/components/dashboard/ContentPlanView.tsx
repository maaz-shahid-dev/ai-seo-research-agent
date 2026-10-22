"use client";

import { ChevronDown } from "lucide-react";
import { useMemo } from "react";

import { ARTICLE_TYPE_LABELS, buildContentPlan, MANAGEABLE_MAX_PAGES, type CoverageSize } from "@/features/research/coverage";
import type { KeywordDto } from "@/features/research/types";
import { Badge, difficultyTone, type BadgeTone } from "@/components/ui/Badge";
import { formatNumber, sentenceCase } from "@/lib/format";

const SIZE_COPY: Record<CoverageSize, { label: string; tone: BadgeTone; detail: string }> = {
  small: { label: "Small", tone: "good", detail: "Quick to cover completely — great for a first site." },
  manageable: { label: "Manageable", tone: "good", detail: `Coverable in a few months (up to ${MANAGEABLE_MAX_PAGES} pages).` },
  large: { label: "Large", tone: "warn", detail: "Start with the strongest clusters, expand later." },
};

/** Topical map: which articles to write to cover the niche, biggest first. */
export function ContentPlanView({ seed, keywords }: { seed: string; keywords: readonly KeywordDto[] }) {
  const plan = useMemo(() => buildContentPlan(seed, keywords), [seed, keywords]);
  const size = SIZE_COPY[plan.size];

  if (keywords.length === 0) return <p className="py-6 text-sm text-slate-500">No keywords to plan yet.</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Summary label="Articles to write" value={formatNumber(plan.pages)} />
        <Summary label="Monthly searches covered" value={formatNumber(plan.totalVolume)} />
        <Summary label="Topical coverage" value={<Badge tone={size.tone}>{size.label}</Badge>} detail={size.detail} />
      </div>

      <ol className="space-y-2">
        {plan.clusters.map((cluster, index) => (
          <li key={cluster.topic}>
            <details className="group rounded-xl border border-slate-200 bg-white">
              <summary className="flex cursor-pointer list-none items-center gap-3 p-4">
                <span className="w-6 shrink-0 text-right text-sm font-semibold tabular-nums text-slate-400">{index + 1}</span>
                <div className="min-w-0 flex-1">
                  <p className="truncate font-medium text-slate-900">{sentenceCase(cluster.mainKeyword)}</p>
                  <p className="text-xs text-slate-500">
                    {cluster.keywords.length} keyword{cluster.keywords.length === 1 ? "" : "s"} · {formatNumber(cluster.totalVolume)} searches/mo
                  </p>
                </div>
                <Badge tone={cluster.articleType === "pillar" ? "accent" : "neutral"}>{ARTICLE_TYPE_LABELS[cluster.articleType]}</Badge>
                {cluster.averageDifficulty !== null ? (
                  <Badge tone={difficultyTone(cluster.averageDifficulty)} title="Average difficulty">KD {cluster.averageDifficulty}</Badge>
                ) : null}
                <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
              </summary>
              <ul className="border-t border-slate-100 px-4 py-3 text-sm text-slate-700">
                {cluster.keywords.map((item) => (
                  <li key={item.keyword} className="flex justify-between gap-3 py-1">
                    <span className="min-w-0 truncate">{item.keyword}</span>
                    <span className="shrink-0 tabular-nums text-slate-500">{formatNumber(item.searchVolume)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </li>
        ))}
      </ol>
    </div>
  );
}

function Summary({ label, value, detail }: { label: string; value: React.ReactNode; detail?: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-semibold tabular-nums text-slate-900">{value}</p>
      {detail ? <p className="mt-1 text-xs text-slate-500">{detail}</p> : null}
    </div>
  );
}

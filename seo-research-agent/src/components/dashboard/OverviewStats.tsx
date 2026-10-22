import type { Opportunity } from "@/features/research/opportunity";
import { TIER_LABELS } from "@/features/research/opportunity";
import type { KeywordDto } from "@/features/research/types";
import { formatNumber } from "@/lib/format";

type OverviewStatsProps = {
  keywords: readonly KeywordDto[];
  opportunities: ReadonlyMap<number, Opportunity>;
};

/** Headline numbers for the loaded keywords. */
export function OverviewStats({ keywords, opportunities }: OverviewStatsProps) {
  const volume = keywords.reduce((sum, keyword) => sum + (keyword.searchVolume ?? 0), 0);
  const rated = keywords.filter((keyword) => keyword.difficulty !== null);
  const averageKd = rated.length ? Math.round(rated.reduce((sum, keyword) => sum + keyword.difficulty!, 0) / rated.length) : null;
  const top = keywords
    .filter((keyword) => opportunities.has(keyword.id))
    .sort((a, b) => opportunities.get(b.id)!.score - opportunities.get(a.id)!.score)[0];
  const topOpportunity = top ? opportunities.get(top.id)! : null;

  return (
    <dl className="grid grid-cols-2 gap-3 lg:grid-cols-4">
      <Stat label="Keywords" value={formatNumber(keywords.length)} />
      <Stat label="Monthly searches" value={formatNumber(volume)} />
      <Stat label="Average KD" value={averageKd === null ? "—" : `${averageKd} / 100`} />
      <Stat
        label="Top opportunity"
        value={top?.keyword ?? "—"}
        detail={topOpportunity ? `${TIER_LABELS[topOpportunity.tier]} · ${topOpportunity.score} · ${formatNumber(top!.searchVolume)}/mo` : undefined}
        truncate
      />
    </dl>
  );
}

function Stat({ label, value, detail, truncate = false }: { label: string; value: string; detail?: string; truncate?: boolean }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4">
      <dt className="text-xs font-medium text-slate-500">{label}</dt>
      <dd className={`mt-1 font-semibold text-slate-900 ${truncate ? "truncate text-sm" : "text-xl tabular-nums"}`} title={truncate ? value : undefined}>{value}</dd>
      {detail ? <dd className="mt-0.5 truncate text-xs text-slate-500">{detail}</dd> : null}
    </div>
  );
}

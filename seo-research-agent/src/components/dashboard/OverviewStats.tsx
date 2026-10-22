import type { Opportunity } from "@/features/research/opportunity";
import { TIER_LABELS } from "@/features/research/opportunity";
import type { KeywordDto } from "@/features/research/types";
import { StatCard } from "@/components/ui/Card";
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
      <StatCard label="Keywords" value={formatNumber(keywords.length)} />
      <StatCard label="Monthly searches" value={formatNumber(volume)} />
      <StatCard label="Average KD" value={averageKd === null ? "—" : `${averageKd} / 100`} />
      <StatCard
        label="Top opportunity"
        value={<span title={top?.keyword}>{top?.keyword ?? "—"}</span>}
        detail={topOpportunity ? `${TIER_LABELS[topOpportunity.tier]} · ${topOpportunity.score} · ${formatNumber(top!.searchVolume)}/mo` : undefined}
        compact
      />
    </dl>
  );
}


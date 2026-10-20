'use client';

import React from 'react';
import { ArrowUpRight, Globe2, TrendingDown, TrendingUp } from 'lucide-react';
import type { CountryMarketComparison } from '@/types/seo';

interface MarketComparisonViewProps {
  comparisons: CountryMarketComparison[];
  seedKeyword: string;
}

export const MarketComparisonView: React.FC<MarketComparisonViewProps> = ({
  comparisons,
  seedKeyword,
}) => {
  if (comparisons.length === 0) {
    return (
      <section className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-xs" role="status">
        <Globe2 className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
        <h1 className="mt-3 text-lg font-bold text-slate-900">No market comparison data</h1>
        <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">
          The loaded snapshot does not include country-level comparison rows.
        </p>
      </section>
    );
  }

  const highestVolume = comparisons.reduce((best, current) => (
    current.seedVolume > best.seedVolume ? current : best
  ));
  const lowestDifficulty = comparisons.reduce((best, current) => (
    current.avgKd < best.avgKd ? current : best
  ));
  const highestCpc = comparisons.reduce((best, current) => (
    current.avgCpc > best.avgCpc ? current : best
  ));
  const maxVolume = Math.max(0, ...comparisons.map((comparison) => comparison.seedVolume));

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">Multi-Country Market Intelligence</h1>
            <span className="rounded-full bg-blue-100 px-2 py-0.5 text-[10px] font-bold text-blue-800">
              {comparisons.length} static demo markets
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Compare the bundled volume, CPC, difficulty, and ranking-domain fields without extrapolating beyond the fixture.
          </p>
        </div>
        <span className="max-w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
          Seed: <strong className="break-words text-indigo-600">&quot;{seedKeyword}&quot;</strong>
        </span>
      </div>

      <section className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 to-slate-900 p-5 text-white shadow-sm sm:p-6">
        <div className="flex flex-col gap-5 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0">
            <span className="text-xs font-bold uppercase tracking-[0.16em] text-indigo-200">Evidence summary</span>
            <h2 className="mt-2 text-xl font-bold">
              Lowest measured difficulty: {lowestDifficulty.countryName} (KD {lowestDifficulty.avgKd})
            </h2>
            <p className="mt-2 max-w-2xl text-sm leading-6 text-indigo-100">
              This is a direct comparison of the rows in the loaded snapshot, not a ranking forecast. Validate localization,
              search intent, and provider freshness before choosing a market.
            </p>
          </div>
          <div className="grid shrink-0 grid-cols-2 gap-2 text-center sm:grid-cols-3">
            <SummaryStat label="Markets" value={comparisons.length.toString()} />
            <SummaryStat label="Lowest KD" value={lowestDifficulty.avgKd.toString()} />
            <SummaryStat label="Top volume" value={highestVolume.seedVolume.toLocaleString()} />
          </div>
        </div>
      </section>

      <section className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xs">
        <div className="border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">Country and language comparison</h2>
          <p className="mt-1 text-xs text-slate-500">All values below come from the current static demo snapshot.</p>
        </div>
        <div
          className="overflow-x-auto focus-visible:outline-2 focus-visible:outline-offset-[-2px] focus-visible:outline-indigo-600"
          role="region"
          aria-label="Scrollable country market comparison table"
          tabIndex={0}
        >
          <table className="w-full min-w-[760px] border-collapse text-left text-xs">
            <caption className="sr-only">Market metrics for {seedKeyword}</caption>
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-5 pr-3">Market</th>
                <th className="px-3 py-3">Language</th>
                <th className="px-3 py-3">Seed volume</th>
                <th className="px-3 py-3 text-right">Average CPC</th>
                <th className="px-3 py-3 text-center">Average KD</th>
                <th className="py-3 pl-3 pr-5">Top ranking domain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {comparisons.map((comparison) => {
                const percentOfMax = maxVolume > 0
                  ? Math.min(100, Math.max(0, Math.round((comparison.seedVolume / maxVolume) * 100)))
                  : 0;

                return (
                  <tr key={`${comparison.countryCode}-${comparison.language}`} className="transition hover:bg-slate-50/80">
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-2">
                        <span className="text-lg" aria-hidden="true">{comparison.flag}</span>
                        <div>
                          <strong className="block text-slate-900">{comparison.countryName}</strong>
                          <span className="font-mono text-[10px] text-slate-400">{comparison.countryCode}</span>
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 font-medium text-slate-600">{comparison.language}</td>
                    <td className="px-3 py-3.5">
                      <div className="flex min-w-52 items-center gap-2">
                        <strong className="w-14 text-right font-mono text-slate-900">
                          {comparison.seedVolume.toLocaleString()}
                        </strong>
                        <span className="h-2 flex-1 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
                          <span className="block h-full rounded-full bg-indigo-500" style={{ width: `${percentOfMax}%` }} />
                        </span>
                        <span className="w-8 text-right font-mono text-[11px] text-slate-400">{percentOfMax}%</span>
                      </div>
                    </td>
                    <td className="px-3 py-3.5 text-right font-mono font-semibold text-slate-800">
                      ${comparison.avgCpc.toFixed(2)}
                    </td>
                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                        comparison.avgKd < 30
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : comparison.avgKd < 40
                            ? 'border-amber-200 bg-amber-50 text-amber-700'
                            : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}>
                        KD {comparison.avgKd}
                      </span>
                    </td>
                    <td className="py-3.5 pl-3 pr-5 font-mono text-[11px] text-slate-600">
                      {comparison.topRankingDomain}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section className="grid grid-cols-1 gap-4 md:grid-cols-3" aria-label="Derived market highlights">
        <HighlightCard
          icon={TrendingDown}
          iconClass="text-emerald-600"
          title="Lowest measured difficulty"
          description={`${lowestDifficulty.countryName} has the lowest fixture average at KD ${lowestDifficulty.avgKd}.`}
        />
        <HighlightCard
          icon={ArrowUpRight}
          iconClass="text-indigo-600"
          title="Highest measured CPC"
          description={`${highestCpc.countryName} has the highest fixture average CPC at $${highestCpc.avgCpc.toFixed(2)}.`}
        />
        <HighlightCard
          icon={TrendingUp}
          iconClass="text-blue-600"
          title="Largest measured demand"
          description={`${highestVolume.countryName} has the highest fixture seed volume at ${highestVolume.seedVolume.toLocaleString()} per month.`}
        />
      </section>
    </div>
  );
};

function SummaryStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/15 bg-white/10 px-3 py-3 backdrop-blur-sm">
      <strong className="block text-lg font-bold text-white">{value}</strong>
      <span className="text-[11px] font-medium text-indigo-200">{label}</span>
    </div>
  );
}

function HighlightCard({
  icon: Icon,
  iconClass,
  title,
  description,
}: {
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean }>;
  iconClass: string;
  title: string;
  description: string;
}) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
      <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
        <Icon className={`h-4 w-4 ${iconClass}`} aria-hidden={true} />
        <h2>{title}</h2>
      </div>
      <p className="mt-2 text-xs leading-relaxed text-slate-600">{description}</p>
    </article>
  );
}

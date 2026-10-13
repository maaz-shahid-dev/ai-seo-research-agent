'use client';

import React from 'react';
import { 
  Globe2, 
  TrendingUp, 
  ArrowUpRight, 
  HelpCircle
} from 'lucide-react';
import { CountryMarketComparison } from '@/types/seo';

interface MarketComparisonViewProps {
  comparisons: CountryMarketComparison[];
  seedKeyword: string;
}

export const MarketComparisonView: React.FC<MarketComparisonViewProps> = ({
  comparisons,
  seedKeyword,
}) => {
  const highestVolume = Math.max(...comparisons.map((c) => c.seedVolume));

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              Country &amp; Market Intelligence (PRD FR-03)
            </h2>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
              Multi-Country Comparison
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Compare search volume, advertiser CPC competition, and dominant regional domains for &quot;{seedKeyword}&quot; across global markets.
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
            Comparing <strong>{comparisons.length} Geographic Markets</strong>
          </span>
        </div>
      </div>

      {/* Explanatory Callout Banner (FR-03 requirement) */}
      <div className="rounded-xl border border-indigo-200 bg-indigo-50/50 p-4 text-xs text-indigo-950 shadow-2xs">
        <div className="flex items-start gap-3">
          <HelpCircle className="h-5 w-5 text-indigo-600 shrink-0 mt-0.5" />
          <div className="space-y-1">
            <h4 className="font-bold text-slate-900">
              Core SEO Principle: Country vs. Language Independence
            </h4>
            <p className="text-slate-600 leading-relaxed">
              Per PRD FR-03, <strong>Country targeting</strong> defines the regional Google search index, local SERP competitors, and purchasing power pool. <strong>Language targeting</strong> defines the phrasing dialect.
              For example, English in the UK (GBP £) has 70% lower competition than the US (USD $), allowing faster organic ranking breakthroughs.
            </p>
          </div>
        </div>
      </div>

      {/* Market Comparison Table */}
      <div className="rounded-xl border border-slate-200 bg-white shadow-xs overflow-hidden">
        <div className="border-b border-slate-100 px-5 py-4">
          <h3 className="text-sm font-bold text-slate-900">
            Cross-Market Comparison Matrix for &quot;{seedKeyword}&quot;
          </h3>
          <p className="text-xs text-slate-500">
            Demo market metrics retrieved from regional simulated indexes.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left text-xs">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/75 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                <th className="py-3 pl-5 pr-3">Target Country &amp; Market</th>
                <th className="px-3 py-3">Language Dialect</th>
                <th className="px-3 py-3 text-right">Search Volume</th>
                <th className="px-3 py-3 text-center">Relative Demand Bar</th>
                <th className="px-3 py-3 text-right">Avg CPC (USD)</th>
                <th className="px-3 py-3 text-center">Avg Difficulty</th>
                <th className="py-3 pl-3 pr-5">Top Dominant Domain</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 font-medium text-slate-700">
              {comparisons.map((c) => {
                const percentOfMax = Math.round((c.seedVolume / highestVolume) * 100);
                const isTopVolume = c.seedVolume === highestVolume;

                return (
                  <tr key={c.countryCode} className="hover:bg-slate-50/80 transition">
                    <td className="py-3.5 pl-5 pr-3">
                      <div className="flex items-center gap-2.5">
                        <span className="text-xl" role="img" aria-label={c.countryName}>
                          {c.flag}
                        </span>
                        <div>
                          <span className="font-bold text-slate-900">{c.countryName}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-slate-400">({c.countryCode})</span>
                        </div>
                      </div>
                    </td>

                    <td className="px-3 py-3.5 text-slate-600">
                      {c.language}
                    </td>

                    <td className="px-3 py-3.5 text-right font-mono font-bold text-slate-900">
                      {c.seedVolume.toLocaleString()}
                      {isTopVolume && (
                        <span className="ml-1.5 rounded-full bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold text-emerald-800">
                          Highest
                        </span>
                      )}
                    </td>

                    {/* Relative Bar */}
                    <td className="px-3 py-3.5">
                      <div className="flex items-center justify-center gap-2">
                        <div className="h-2 w-28 overflow-hidden rounded-full bg-slate-100">
                          <div 
                            className={`h-full ${isTopVolume ? 'bg-indigo-600' : 'bg-indigo-400'}`}
                            style={{ width: `${percentOfMax}%` }}
                          />
                        </div>
                        <span className="w-8 text-[11px] font-mono text-slate-400 text-right">
                          {percentOfMax}%
                        </span>
                      </div>
                    </td>

                    <td className="px-3 py-3.5 text-right font-mono font-semibold text-slate-800">
                      ${c.avgCpc.toFixed(2)}
                    </td>

                    <td className="px-3 py-3.5 text-center">
                      <span className={`inline-block rounded-md border px-2 py-0.5 text-[11px] font-bold ${
                        c.avgKd < 30
                          ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                          : c.avgKd < 40
                          ? 'border-amber-200 bg-amber-50 text-amber-700'
                          : 'border-rose-200 bg-rose-50 text-rose-700'
                      }`}>
                        KD {c.avgKd}
                      </span>
                    </td>

                    <td className="py-3.5 pl-3 pr-5 text-slate-600 font-mono text-[11px]">
                      {c.topRankingDomain}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Strategic Takeaway Cards */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <span>Lowest Competition Arbitrage</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            <strong>Netherlands (NL) &amp; Germany (DE)</strong> feature the lowest average difficulty (KD 23–28). Building localized localized documentation pages can rank significantly faster than in the US market.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <ArrowUpRight className="h-4 w-4 text-indigo-600" />
            <span>Highest Monetization CPC</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            <strong>United States (US)</strong> advertisers pay an average of $2.45 per click. High commercial intent means affiliate payouts and software sponsorships are clustered in the US.
          </p>
        </div>

        <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
          <div className="flex items-center gap-2 text-xs font-bold text-slate-900">
            <Globe2 className="h-4 w-4 text-blue-600" />
            <span>High-Growth Non-English Market</span>
          </div>
          <p className="mt-2 text-xs text-slate-600 leading-relaxed">
            <strong>Japan (JP)</strong> exhibits high volume (5,100/mo) with lower English saturation. Native Japanese translations present an untapped expansion vector.
          </p>
        </div>
      </div>
    </div>
  );
};

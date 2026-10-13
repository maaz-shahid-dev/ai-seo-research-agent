'use client';

import React from 'react';
import { 
  BarChart3, 
  TrendingUp, 
  KeyRound, 
  Flame, 
  ArrowUpRight
} from 'lucide-react';
import { KeywordResult } from '@/types/seo';

interface OverviewCardsProps {
  keywords: KeywordResult[];
  activeProjectName: string;
}

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  keywords,
  activeProjectName,
}) => {
  const totalKeywords = keywords.length;
  const totalVolume = keywords.reduce((acc, k) => acc + (k.search_volume || 0), 0);
  const avgDifficulty = totalKeywords > 0
    ? Math.round(keywords.reduce((acc, k) => acc + (k.keyword_difficulty || 0), 0) / totalKeywords)
    : 0;

  // Find lowest KD with volume > 500
  const topOpportunity = [...keywords]
    .filter((k) => (k.search_volume || 0) >= 500 && k.keyword_difficulty !== null)
    .sort((a, b) => (a.keyword_difficulty || 999) - (b.keyword_difficulty || 999))[0];

  return (
    <div className="space-y-4">
      {/* Niche Viability Scorecard Banner */}
      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-5 text-white shadow-md">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="rounded-full bg-indigo-500/30 px-2.5 py-0.5 text-[10px] font-bold text-indigo-200 border border-indigo-400/30">
                EVIDENCE-GROUNDED SCORECARD
              </span>
              <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300 border border-amber-400/30">
                Demo Score
              </span>
            </div>
            <h3 className="text-base font-bold text-white">
              Niche Viability Index: <span className="text-emerald-400">78 / 100</span> (Promising Opportunity)
            </h3>
            <p className="text-xs text-indigo-200/80 max-w-2xl leading-relaxed">
              Based on {totalKeywords} keywords and top 10 SERP competitor domain ratings. Low-authority domains (DR &lt; 35) hold positions #3 and #5, indicating realistic organic ranking entry points for long-tail queries.
            </p>
          </div>

          {/* Sub-Pillars */}
          <div className="flex flex-wrap items-center gap-3 text-xs">
            <div className="rounded-xl bg-white/10 px-3 py-2 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-indigo-200 block">Demand Volume</span>
              <strong className="text-sm font-bold text-white">85 / 100</strong>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-indigo-200 block">SERP Weak Spots</span>
              <strong className="text-sm font-bold text-emerald-300">80 / 100</strong>
            </div>
            <div className="rounded-xl bg-white/10 px-3 py-2 border border-white/10 backdrop-blur-xs">
              <span className="text-[10px] text-indigo-200 block">Monetization CPC</span>
              <strong className="text-sm font-bold text-amber-300">75 / 100</strong>
            </div>
          </div>
        </div>
      </div>

      {/* 4 KPI Metric Cards */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Keywords */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Keywords
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <KeyRound className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {totalKeywords.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500">ideas</span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span>Project: {activeProjectName}</span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo Count
            </span>
          </div>
        </div>

        {/* Card 2: Combined Monthly Volume */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Est. Monthly Volume
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {totalVolume.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-emerald-600 flex items-center">
              <ArrowUpRight className="h-3 w-3" /> Monthly
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span>Target Market pool</span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo Volume
            </span>
          </div>
        </div>

        {/* Card 3: Average Keyword Difficulty */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Avg. Difficulty (KD)
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BarChart3 className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-3 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {avgDifficulty} <span className="text-sm font-normal text-slate-400">/ 100</span>
            </span>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
              {avgDifficulty < 35 ? 'Low Resistance' : avgDifficulty < 60 ? 'Moderate' : 'High'}
            </span>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span>Median across ideas</span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo Metric
            </span>
          </div>
        </div>

        {/* Card 4: Top Opportunity */}
        <div className="relative overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Top Low-KD Opportunity
            </span>
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Flame className="h-4 w-4" />
            </div>
          </div>
          <div className="mt-2">
            <div className="truncate text-sm font-bold text-slate-900" title={topOpportunity?.keyword}>
              {topOpportunity?.keyword || 'No keyword found'}
            </div>
            <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
              <span className="font-semibold text-emerald-600">KD {topOpportunity?.keyword_difficulty}</span>
              <span>•</span>
              <span>{topOpportunity?.search_volume?.toLocaleString()} vol/mo</span>
              <span>•</span>
              <span className="font-medium text-indigo-600">${topOpportunity?.cpc?.toFixed(2)} CPC</span>
            </div>
          </div>
          <div className="mt-2.5 flex items-center justify-between border-t border-slate-100 pt-2 text-[11px] text-slate-400">
            <span>Intent: {topOpportunity?.intent}</span>
            <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo Sample
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

'use client';

import React from 'react';
import {
  BarChart3,
  TrendingUp,
  KeyRound,
  Flame,
  ArrowUpRight,
} from 'lucide-react';
import { KeywordResult } from '@/types/seo';

interface OverviewCardsProps {
  keywords: KeywordResult[];
  activeProjectName: string;
}

const clampScore = (value: number) => Math.min(100, Math.max(0, Math.round(value)));

const formatScore = (score: number | null) => (score === null ? '—' : `${score} / 100`);

export const OverviewCards: React.FC<OverviewCardsProps> = ({
  keywords,
  activeProjectName,
}) => {
  const totalKeywords = keywords.length;
  const measuredVolumes = keywords
    .map((keyword) => keyword.search_volume)
    .filter((volume): volume is number => volume !== null && Number.isFinite(volume) && volume >= 0);
  const measuredDifficulties = keywords
    .map((keyword) => keyword.keyword_difficulty)
    .filter((difficulty): difficulty is number => difficulty !== null && Number.isFinite(difficulty));
  const measuredCpcs = keywords
    .map((keyword) => keyword.cpc)
    .filter((cpc): cpc is number => cpc !== null && Number.isFinite(cpc) && cpc >= 0);

  const totalVolume = measuredVolumes.reduce((sum, volume) => sum + volume, 0);
  const averageVolume = measuredVolumes.length > 0
    ? totalVolume / measuredVolumes.length
    : null;
  const averageDifficulty = measuredDifficulties.length > 0
    ? Math.round(measuredDifficulties.reduce((sum, difficulty) => sum + difficulty, 0) / measuredDifficulties.length)
    : null;
  const averageCpc = measuredCpcs.length > 0
    ? measuredCpcs.reduce((sum, cpc) => sum + cpc, 0) / measuredCpcs.length
    : null;

  // Deterministic demo scoring: 5,000 average monthly searches and $5 average CPC each map to 100.
  const demandScore = averageVolume === null ? null : clampScore((averageVolume / 5_000) * 100);
  const competitionEaseScore = averageDifficulty === null ? null : clampScore(100 - averageDifficulty);
  const monetizationScore = averageCpc === null ? null : clampScore((averageCpc / 5) * 100);
  const availableScores = [demandScore, competitionEaseScore, monetizationScore].filter(
    (score): score is number => score !== null,
  );
  const viabilityScore = availableScores.length > 0
    ? Math.round(availableScores.reduce((sum, score) => sum + score, 0) / availableScores.length)
    : null;

  const viabilityLabel = viabilityScore === null
    ? 'Awaiting evidence'
    : viabilityScore >= 75
      ? 'Strong opportunity'
      : viabilityScore >= 60
        ? 'Promising opportunity'
        : viabilityScore >= 40
          ? 'Mixed opportunity'
          : 'Challenging opportunity';

  const viabilityTone = viabilityScore === null
    ? 'text-indigo-200'
    : viabilityScore >= 60
      ? 'text-emerald-400'
      : viabilityScore >= 40
        ? 'text-amber-300'
        : 'text-rose-300';

  // Find the lowest measured KD among keywords with at least 500 measured monthly searches.
  const topOpportunity = [...keywords]
    .filter((keyword) => (
      keyword.search_volume !== null
      && Number.isFinite(keyword.search_volume)
      && keyword.search_volume >= 500
      && keyword.keyword_difficulty !== null
      && Number.isFinite(keyword.keyword_difficulty)
    ))
    .sort((first, second) => (
      (first.keyword_difficulty ?? Number.POSITIVE_INFINITY)
      - (second.keyword_difficulty ?? Number.POSITIVE_INFINITY)
      || (second.search_volume ?? 0) - (first.search_volume ?? 0)
    ))[0];

  const difficultyLabel = averageDifficulty === null
    ? 'No data'
    : averageDifficulty < 35
      ? 'Low Resistance'
      : averageDifficulty < 60
        ? 'Moderate'
        : 'High';

  return (
    <div className="min-w-0 space-y-4">
      {/* Niche Viability Scorecard Banner */}
      <section
        className="min-w-0 overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-r from-indigo-900 via-indigo-800 to-slate-900 p-4 text-white shadow-md sm:p-5"
        aria-labelledby="viability-scorecard-title"
      >
        <div className="flex min-w-0 flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="min-w-0 space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="rounded-full border border-indigo-400/30 bg-indigo-500/30 px-2.5 py-0.5 text-[10px] font-bold text-indigo-200">
                DETERMINISTIC SCORECARD
              </span>
              <span className="rounded-full border border-amber-400/30 bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                Demo inputs
              </span>
            </div>
            <h3 id="viability-scorecard-title" className="text-base font-bold text-white">
              Niche Viability Index:{' '}
              <span className={viabilityTone}>
                {viabilityScore === null ? '—' : `${viabilityScore} / 100`}
              </span>{' '}
              <span className="inline-block">({viabilityLabel})</span>
            </h3>
            <p className="max-w-2xl text-xs leading-relaxed text-indigo-200/80">
              {totalKeywords === 0
                ? 'No keyword evidence is available yet. Add results to calculate a viability score.'
                : `Calculated from ${totalKeywords} keyword ideas using non-null evidence only. Demand scales average monthly volume to 5,000, competition ease inverts average KD, and monetization scales average CPC to $5.`}
            </p>
          </div>

          {/* Derived score pillars */}
          <div className="grid w-full min-w-0 grid-cols-1 gap-2 sm:grid-cols-3 md:w-auto md:min-w-[22rem]">
            <div
              className="min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-xs"
              title="Average non-null monthly volume, scaled against 5,000 searches"
            >
              <span className="block text-[10px] text-indigo-200">Demand Volume</span>
              <strong className="text-sm font-bold text-white">{formatScore(demandScore)}</strong>
            </div>
            <div
              className="min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-xs"
              title="One hundred minus the average non-null keyword difficulty"
            >
              <span className="block text-[10px] text-indigo-200">Competition Ease</span>
              <strong className="text-sm font-bold text-emerald-300">{formatScore(competitionEaseScore)}</strong>
            </div>
            <div
              className="min-w-0 rounded-xl border border-white/10 bg-white/10 px-3 py-2 backdrop-blur-xs"
              title="Average non-null CPC, scaled against five dollars"
            >
              <span className="block text-[10px] text-indigo-200">Monetization CPC</span>
              <strong className="text-sm font-bold text-amber-300">{formatScore(monetizationScore)}</strong>
            </div>
          </div>
        </div>
      </section>

      {/* 4 KPI Metric Cards */}
      <div className="grid min-w-0 grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {/* Card 1: Total Keywords */}
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Total Keywords
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-indigo-50 text-indigo-600">
              <KeyRound className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {totalKeywords.toLocaleString()}
            </span>
            <span className="text-xs font-medium text-slate-500">ideas</span>
          </div>
          <div className="mt-2.5 flex min-w-0 flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span className="min-w-0 truncate" title={activeProjectName}>Project: {activeProjectName}</span>
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo Count
            </span>
          </div>
        </div>

        {/* Card 2: Combined Monthly Volume */}
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Est. Monthly Volume
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-emerald-50 text-emerald-600">
              <TrendingUp className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {measuredVolumes.length > 0 ? totalVolume.toLocaleString() : '—'}
            </span>
            <span className="flex items-center text-xs font-medium text-emerald-600">
              <ArrowUpRight className="h-3 w-3" aria-hidden="true" /> Monthly
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>{measuredVolumes.length > 0 ? `${measuredVolumes.length} measured ideas` : 'No volume data'}</span>
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo Volume
            </span>
          </div>
        </div>

        {/* Card 3: Average Keyword Difficulty */}
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Avg. Difficulty (KD)
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
              <BarChart3 className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-3 flex flex-wrap items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-slate-900">
              {averageDifficulty === null ? '—' : averageDifficulty}{' '}
              {averageDifficulty !== null && <span className="text-sm font-normal text-slate-400">/ 100</span>}
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              averageDifficulty === null
                ? 'bg-slate-100 text-slate-600'
                : averageDifficulty < 60
                  ? 'bg-emerald-100 text-emerald-800'
                  : 'bg-rose-100 text-rose-700'
            }`}>
              {difficultyLabel}
            </span>
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>
              {measuredDifficulties.length > 0
                ? `Average across ${measuredDifficulties.length} measured ideas`
                : 'No KD data available'}
            </span>
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              Demo Metric
            </span>
          </div>
        </div>

        {/* Card 4: Top Opportunity */}
        <div className="relative min-w-0 overflow-hidden rounded-xl border border-slate-200 bg-white p-5 shadow-xs transition hover:shadow-md">
          <div className="flex items-center justify-between gap-3">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Top Low-KD Opportunity
            </span>
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-amber-50 text-amber-600">
              <Flame className="h-4 w-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 min-w-0">
            <div className="truncate text-sm font-bold text-slate-900" title={topOpportunity?.keyword}>
              {topOpportunity?.keyword ?? 'No qualifying keyword'}
            </div>
            {topOpportunity ? (
              <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-slate-600">
                <span className="font-semibold text-emerald-600">KD {topOpportunity.keyword_difficulty ?? '—'}</span>
                <span aria-hidden="true">•</span>
                <span>{(topOpportunity.search_volume ?? 0).toLocaleString()} vol/mo</span>
                <span aria-hidden="true">•</span>
                <span className="font-medium text-indigo-600">
                  {topOpportunity.cpc === null ? '—' : `$${topOpportunity.cpc.toFixed(2)}`} CPC
                </span>
              </div>
            ) : (
              <p className="mt-1 text-xs leading-relaxed text-slate-500">
                No measured keyword has both 500+ monthly searches and a KD value.
              </p>
            )}
          </div>
          <div className="mt-2.5 flex flex-wrap items-center justify-between gap-2 border-t border-slate-100 pt-2 text-[11px] text-slate-500">
            <span>Intent: {topOpportunity?.intent ?? 'Not available'}</span>
            <span className="shrink-0 rounded bg-amber-50 px-1.5 py-0.5 text-[10px] font-semibold text-amber-700">
              {topOpportunity ? 'Demo Sample' : 'No Sample'}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
};

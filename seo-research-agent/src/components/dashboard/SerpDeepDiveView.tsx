'use client';

import React, { useState } from 'react';
import { 
  Sparkles, 
  ExternalLink, 
  ShieldAlert, 
  HelpCircle, 
  CheckCircle2, 
  Layers, 
  ChevronDown, 
  ChevronUp
} from 'lucide-react';
import { KeywordResult, SERPResult } from '@/types/seo';
import { DEMO_SERP_DATA } from '@/data/demo-data';

interface SerpDeepDiveViewProps {
  keywords: KeywordResult[];
  activeKeyword: KeywordResult;
  onSelectKeyword: (kw: KeywordResult) => void;
  countryCode: string;
  languageCode: string;
}

export const SerpDeepDiveView: React.FC<SerpDeepDiveViewProps> = ({
  keywords,
  activeKeyword,
  onSelectKeyword,
  countryCode,
  languageCode,
}) => {
  const [showPaa, setShowPaa] = useState(true);
  const [openPaaIndex, setOpenPaaIndex] = useState<number | null>(0);

  const serpList: SERPResult[] = DEMO_SERP_DATA[activeKeyword.keyword] || DEMO_SERP_DATA['best ai tools for productivity'];

  const paaQuestions = [
    {
      q: 'What are the top rated AI tools for daily work in 2026?',
      a: 'Top evaluated solutions include Zapier Central for cross-app automation, Notion AI for workspace notes, and ClickUp Brain for team task coordination.',
    },
    {
      q: 'Can open-source AI tools match proprietary productivity software?',
      a: 'Yes, local models running via Ollama and whisper.cpp provide zero-cost dictation and text synthesis without sending enterprise data to external cloud APIs.',
    },
    {
      q: 'How much does enterprise AI productivity software cost per user?',
      a: 'Standard business tiers range between $10 and $30 per seat monthly, with transactional CPCs for enterprise search terms reaching $9.40 in the US.',
    },
    {
      q: 'Do Google AI Overviews replace traditional listicle blogs?',
      a: 'AI Overviews often summarize surface-level definitions, but users evaluating specific comparison matrices and hands-on screenshots continue to click into in-depth reviews.',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-slate-900">
              SERP Competitor Deep Dive (PRD FR-04)
            </h2>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
              10 Competitors Analyzed
            </span>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Demo Snapshot
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Inspect ranking page titles, content formats, third-party authority metrics, and SERP feature presence.
          </p>
        </div>

        {/* Market Context Badge */}
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
            Market: <strong>{countryCode} ({languageCode})</strong>
          </span>
        </div>
      </div>

      {/* Keyword Selector Bar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs">
        <label className="text-xs font-semibold text-slate-700">
          Select Keyword to Inspect Ranking SERP:
        </label>
        <div className="mt-2.5 flex flex-wrap gap-2">
          {keywords.slice(0, 8).map((kw) => {
            const isSelected = kw.id === activeKeyword.id;
            return (
              <button
                key={kw.id}
                onClick={() => onSelectKeyword(kw)}
                className={`rounded-lg border px-3 py-1.5 text-xs font-medium transition ${
                  isSelected
                    ? 'border-indigo-600 bg-indigo-50 text-indigo-700 font-bold shadow-2xs'
                    : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                }`}
              >
                {kw.keyword} <span className="text-[10px] text-slate-400 font-mono">(KD {kw.keyword_difficulty})</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* SERP Features Detected Panel */}
      <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-xs">
        <div className="flex items-center justify-between border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <Layers className="h-4 w-4 text-indigo-600" />
            <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
              SERP Features &amp; SERP Layout Detected
            </h3>
          </div>
          <span className="text-[11px] text-slate-400">
            Simulated Google Search Engine Page #1
          </span>
        </div>

        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-lg border border-indigo-100 bg-indigo-50/40 p-3">
            <span className="text-[11px] font-semibold text-indigo-900">AI Overview</span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-indigo-700">
              <Sparkles className="h-3.5 w-3.5" /> Present at Top
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Generates brief answer card</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-[11px] font-semibold text-slate-700">Featured Snippet</span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-emerald-700">
              <CheckCircle2 className="h-3.5 w-3.5" /> Captured by #1
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Zapier list table format</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-[11px] font-semibold text-slate-700">People Also Ask</span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-indigo-700">
              <HelpCircle className="h-3.5 w-3.5" /> 4 Questions Box
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Between position #3 and #4</p>
          </div>

          <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
            <span className="text-[11px] font-semibold text-slate-700">Sponsored Ads</span>
            <div className="mt-1 flex items-center gap-1.5 text-xs font-bold text-slate-800">
              3 Paid Ads Active
            </div>
            <p className="mt-1 text-[10px] text-slate-500">Commercial buyer intent</p>
          </div>
        </div>

        {/* People Also Ask Accordion */}
        <div className="mt-4 border-t border-slate-100 pt-3">
          <button
            onClick={() => setShowPaa(!showPaa)}
            className="flex w-full items-center justify-between text-xs font-bold text-slate-800 hover:text-indigo-600"
          >
            <span className="flex items-center gap-1.5">
              <HelpCircle className="h-4 w-4 text-indigo-600" />
              People Also Ask (PAA Questions)
            </span>
            {showPaa ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>

          {showPaa && (
            <div className="mt-3 space-y-2">
              {paaQuestions.map((item, idx) => (
                <div key={idx} className="rounded-lg border border-slate-100 bg-slate-50/50 p-3 text-xs">
                  <button
                    onClick={() => setOpenPaaIndex(openPaaIndex === idx ? null : idx)}
                    className="flex w-full items-center justify-between font-semibold text-slate-800 text-left"
                  >
                    <span>{item.q}</span>
                    <span className="text-slate-400">{openPaaIndex === idx ? '−' : '+'}</span>
                  </button>
                  {openPaaIndex === idx && (
                    <p className="mt-2 text-slate-600 leading-relaxed border-t border-slate-200/60 pt-2 text-[11px]">
                      {item.a}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Provenance Disclaimer */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950 flex items-start gap-2.5">
        <ShieldAlert className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
        <p>
          <strong>Data Provenance Notice (PRD FR-04):</strong> Domain authority scores (e.g., Domain Rating / DR) are third-party vendor estimations, not official Google ranking signals. If a metric is unavailable, it is marked &quot;Not available&quot; rather than guessed.
        </p>
      </div>

      {/* Top 10 Competitors List */}
      <div className="space-y-3">
        {serpList.map((item) => {
          const isLowAuthorityOpportunity = item.authority_metric_value !== null && item.authority_metric_value < 40;

          return (
            <div
              key={item.id}
              className={`rounded-xl border p-4 transition shadow-xs ${
                isLowAuthorityOpportunity
                  ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-500/10'
                  : 'border-slate-200 bg-white hover:border-slate-300'
              }`}
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                {/* Left position & details */}
                <div className="flex items-start gap-3">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white shadow-xs">
                    #{item.position}
                  </span>

                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-mono text-xs font-semibold text-slate-700">{item.domain}</span>
                      {item.contentType && (
                        <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                          {item.contentType}
                        </span>
                      )}
                      {isLowAuthorityOpportunity && (
                        <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                          <Sparkles className="h-3 w-3" /> Low-DR Opportunity Gap
                        </span>
                      )}
                    </div>

                    <h4 className="mt-1 text-sm font-bold text-slate-900 hover:text-indigo-600">
                      <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5">
                        {item.title}
                        <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                      </a>
                    </h4>

                    <p className="mt-1 text-xs text-slate-600 leading-relaxed max-w-3xl">
                      {item.snippet}
                    </p>

                    <div className="mt-2.5 flex flex-wrap items-center gap-4 text-[11px] text-slate-400">
                      <span className="font-mono truncate max-w-md">{item.url}</span>
                      <span>•</span>
                      <span>Est. Backlinks: <strong className="text-slate-700">{item.estimated_backlinks?.toLocaleString() ?? 'N/A'}</strong></span>
                      <span>•</span>
                      <span>Monthly Traffic: <strong className="text-slate-700">{item.estimated_organic_traffic?.toLocaleString() ?? 'N/A'}</strong></span>
                    </div>
                  </div>
                </div>

                {/* Right Authority Pill */}
                <div className="shrink-0 text-right sm:border-l sm:border-slate-100 sm:pl-4">
                  <span className="text-[10px] font-medium text-slate-500 uppercase tracking-wider">
                    {item.authority_metric_name}
                  </span>
                  <div className="mt-0.5 flex items-baseline justify-end gap-1">
                    <span className={`text-xl font-bold font-mono ${
                      isLowAuthorityOpportunity ? 'text-emerald-700' : 'text-slate-900'
                    }`}>
                      {item.authority_metric_value ?? 'N/A'}
                    </span>
                    <span className="text-xs text-slate-400">/ 100</span>
                  </div>
                  <span className="mt-1 block text-[10px] text-slate-400">
                    Source: {item.source}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
};

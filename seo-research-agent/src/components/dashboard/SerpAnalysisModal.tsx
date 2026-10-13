'use client';

import React from 'react';
import { 
  X, 
  ExternalLink, 
  ShieldAlert, 
  Globe, 
  Clock, 
  Database,
  Sparkles
} from 'lucide-react';
import { KeywordResult, SERPResult } from '@/types/seo';

interface SerpAnalysisModalProps {
  keyword: KeywordResult | null;
  serpResults: SERPResult[];
  onClose: () => void;
  countryCode: string;
  languageCode: string;
}

export const SerpAnalysisModal: React.FC<SerpAnalysisModalProps> = ({
  keyword,
  serpResults,
  onClose,
  countryCode,
  languageCode,
}) => {
  if (!keyword) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-xs"
      onClick={onClose}
      aria-modal="true"
      role="dialog"
    >
      <div 
        className="flex max-h-[90vh] w-full max-w-4xl flex-col rounded-2xl border border-slate-200 bg-white shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between border-b border-slate-100 p-5">
          <div>
            <div className="flex items-center gap-2">
              <span className="rounded-md bg-indigo-100 px-2 py-0.5 text-xs font-bold text-indigo-800">
                SERP Analysis (FR-04)
              </span>
              <span className="rounded-md bg-amber-100 px-2 py-0.5 text-xs font-bold text-amber-800">
                Demo Snapshot
              </span>
            </div>
            <h3 className="mt-2 text-lg font-bold text-slate-900">
              Top Search Engine Competitors for: <span className="text-indigo-600 font-mono">&quot;{keyword.keyword}&quot;</span>
            </h3>
            <div className="mt-1 flex flex-wrap items-center gap-3 text-xs text-slate-500">
              <span className="flex items-center gap-1">
                <Globe className="h-3.5 w-3.5 text-slate-400" /> Market: {countryCode} ({languageCode})
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Clock className="h-3.5 w-3.5 text-slate-400" /> Freshness: {serpResults[0]?.retrieved_at || '2026-10-13 07:46 UTC'}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                <Database className="h-3.5 w-3.5 text-slate-400" /> Source: {serpResults[0]?.source || 'Mock SERP Provider'}
              </span>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-700 transition"
            aria-label="Close SERP modal"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* PRD Compliance Disclaimer Banner */}
        <div className="border-b border-amber-200 bg-amber-50/80 px-5 py-2.5 text-xs text-amber-900">
          <div className="flex items-center gap-2">
            <ShieldAlert className="h-4 w-4 shrink-0 text-amber-600" />
            <p>
              <strong>Data Provenance Notice:</strong> Domain authority scores (e.g. Domain Rating / DR) are third-party vendor estimations, not official Google ranking signals. Metrics are shown without fabrication.
            </p>
          </div>
        </div>

        {/* Competitor SERP Table */}
        <div className="flex-1 overflow-y-auto p-5">
          <div className="space-y-3">
            {serpResults.length === 0 ? (
              <div className="py-12 text-center text-xs text-slate-500">
                No SERP results cached for this keyword yet.
              </div>
            ) : (
              serpResults.map((item) => {
                const isLowAuthorityOpportunity = item.authority_metric_value !== null && item.authority_metric_value < 40;

                return (
                  <div
                    key={item.id}
                    className={`rounded-xl border p-4 transition ${
                      isLowAuthorityOpportunity
                        ? 'border-emerald-300 bg-emerald-50/30'
                        : 'border-slate-200 bg-white hover:border-slate-300'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-4">
                      <div className="flex items-start gap-3">
                        <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white shadow-xs">
                          #{item.position}
                        </span>
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-slate-500">{item.domain}</span>
                            {isLowAuthorityOpportunity && (
                              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                                <Sparkles className="h-3 w-3" /> Low-DR Ranking Opportunity
                              </span>
                            )}
                          </div>
                          <h4 className="mt-1 text-sm font-bold text-slate-900 hover:text-indigo-600">
                            <a href={item.url} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1">
                              {item.title}
                              <ExternalLink className="h-3.5 w-3.5 text-slate-400" />
                            </a>
                          </h4>
                          <p className="mt-1 text-xs text-slate-600 line-clamp-2">
                            {item.snippet || 'Snippet not retrieved from provider payload.'}
                          </p>
                          <div className="mt-2 text-[11px] font-mono text-slate-400 truncate max-w-xl">
                            {item.url}
                          </div>
                        </div>
                      </div>

                      {/* Right Authority Metric Badge */}
                      <div className="shrink-0 text-right">
                        <div className="text-[11px] font-medium text-slate-500">
                          {item.authority_metric_name || 'Authority Metric'}
                        </div>
                        <div className="mt-0.5 flex items-baseline justify-end gap-1">
                          <span className={`text-lg font-bold font-mono ${
                            isLowAuthorityOpportunity ? 'text-emerald-700' : 'text-slate-900'
                          }`}>
                            {item.authority_metric_value !== null ? item.authority_metric_value : 'Not available'}
                          </span>
                          <span className="text-xs text-slate-400">/ 100</span>
                        </div>
                        <div className="mt-1 text-[10px] text-slate-400">
                          Provider: {item.source}
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/75 p-4 text-xs">
          <span className="text-slate-500">
            Clicking external links opens live competitors in a new browser tab.
          </span>
          <button
            onClick={onClose}
            className="rounded-lg bg-slate-900 px-4 py-2 font-semibold text-white transition hover:bg-slate-800"
          >
            Close Inspector
          </button>
        </div>
      </div>
    </div>
  );
};

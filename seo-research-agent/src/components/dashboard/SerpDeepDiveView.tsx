'use client';

import React from 'react';
import { ExternalLink, HelpCircle, Layers, ShieldAlert, Sparkles } from 'lucide-react';
import type { KeywordResult, SERPResult } from '@/types/seo';

interface SerpDeepDiveViewProps {
  keywords: KeywordResult[];
  activeKeyword: KeywordResult;
  onSelectKeyword: (keyword: KeywordResult) => void;
  countryCode: string;
  languageCode: string;
  serpResultsByKeyword: Readonly<Record<string, readonly SERPResult[]>>;
}

export const SerpDeepDiveView: React.FC<SerpDeepDiveViewProps> = ({
  keywords,
  activeKeyword,
  onSelectKeyword,
  countryCode,
  languageCode,
  serpResultsByKeyword,
}) => {
  const serpList = serpResultsByKeyword[activeKeyword.keyword] ?? [];
  const hasSnapshot = serpList.length > 0;

  return (
    <div className="min-w-0 space-y-6">
      <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">SERP Competitor Deep Dive</h1>
            <span className="rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-bold text-indigo-800">
              {serpList.length} {serpList.length === 1 ? 'competitor' : 'competitors'} captured
            </span>
            <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
              hasSnapshot ? 'bg-amber-100 text-amber-800' : 'bg-slate-100 text-slate-600'
            }`}>
              {hasSnapshot ? 'Snapshot available' : 'No snapshot'}
            </span>
          </div>
          <p className="mt-1 text-xs text-slate-500">
            Inspect captured ranking pages, formats, authority estimates, and source provenance.
          </p>
        </div>
        <span className="shrink-0 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 shadow-2xs">
          Market: {countryCode} ({languageCode})
        </span>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-xs" aria-labelledby="serp-keyword-label">
        <label id="serp-keyword-label" htmlFor="serp-keyword-select" className="text-xs font-semibold text-slate-700">
          Keyword snapshot
        </label>
        <select
          id="serp-keyword-select"
          value={activeKeyword.id}
          onChange={(event) => {
            const nextKeyword = keywords.find((keyword) => keyword.id === event.target.value);
            if (nextKeyword) onSelectKeyword(nextKeyword);
          }}
          className="mt-2 min-h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-800 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100 sm:max-w-2xl"
        >
          {keywords.map((keyword) => (
            <option key={keyword.id} value={keyword.id}>
              {keyword.keyword} - KD {keyword.keyword_difficulty ?? 'N/A'}
            </option>
          ))}
        </select>
      </section>

      {!hasSnapshot ? (
        <section className="rounded-xl border border-dashed border-slate-300 bg-white px-5 py-12 text-center shadow-xs" role="status">
          <Layers className="mx-auto h-8 w-8 text-slate-400" aria-hidden="true" />
          <h2 className="mt-3 text-sm font-bold text-slate-900">No SERP snapshot for this keyword</h2>
          <p className="mx-auto mt-1 max-w-lg text-xs leading-relaxed text-slate-500">
            No captured ranking results are bundled for &quot;{activeKeyword.keyword}&quot; in {countryCode} ({languageCode}).
            The app will not substitute results from another keyword.
          </p>
        </section>
      ) : (
        <>
          <section className="rounded-xl border border-slate-200 bg-white p-5 text-xs text-slate-600 shadow-xs">
            <div className="flex items-start gap-2">
              <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" aria-hidden="true" />
              <div>
                <h2 className="font-bold text-slate-900">SERP feature metadata not included</h2>
                <p className="mt-1 leading-relaxed">
                  This snapshot contains competitor rows only. It does not verify AI Overviews, featured snippets,
                  People Also Ask boxes, or paid ads, so this view does not infer them.
                </p>
              </div>
            </div>
          </section>

          <div className="flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50/70 p-4 text-xs text-amber-950">
            <ShieldAlert className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" aria-hidden="true" />
            <p>
              <strong>Provenance notice:</strong> Authority scores are third-party estimates, not official Google
              ranking signals. Missing metrics remain marked as unavailable.
            </p>
          </div>

          <section className="space-y-3" aria-label="Captured SERP competitors">
            {serpList.map((item) => {
              const hasLowerAuthorityEstimate = item.authority_metric_value !== null
                && item.authority_metric_value < 40;

              return (
                <article
                  key={item.id}
                  className={`min-w-0 rounded-xl border p-4 shadow-xs transition ${
                    hasLowerAuthorityEstimate
                      ? 'border-emerald-300 bg-emerald-50/20 ring-1 ring-emerald-500/10'
                      : 'border-slate-200 bg-white hover:border-slate-300'
                  }`}
                >
                  <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    <div className="flex min-w-0 items-start gap-3">
                      <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-slate-900 text-xs font-bold text-white shadow-xs">
                        #{item.position}
                      </span>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="break-all font-mono text-xs font-semibold text-slate-700">{item.domain}</span>
                          {item.contentType && (
                            <span className="rounded bg-slate-100 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                              {item.contentType}
                            </span>
                          )}
                          {hasLowerAuthorityEstimate && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                              <Sparkles className="h-3 w-3" aria-hidden="true" /> Lower authority estimate
                            </span>
                          )}
                        </div>
                        <h3 className="mt-1 text-sm font-bold text-slate-900">
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-start gap-1.5 break-words hover:text-indigo-600"
                          >
                            {item.title}
                            <ExternalLink className="mt-0.5 h-3.5 w-3.5 shrink-0 text-slate-400" aria-hidden="true" />
                          </a>
                        </h3>
                        {item.snippet && (
                          <p className="mt-1 max-w-3xl text-xs leading-relaxed text-slate-600">{item.snippet}</p>
                        )}
                        <div className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-[11px] text-slate-500">
                          <span className="max-w-full break-all font-mono">{item.url}</span>
                          <span>Estimated backlinks: <strong className="text-slate-700">{item.estimated_backlinks?.toLocaleString() ?? 'N/A'}</strong></span>
                          <span>Estimated traffic: <strong className="text-slate-700">{item.estimated_organic_traffic?.toLocaleString() ?? 'N/A'}</strong></span>
                        </div>
                      </div>
                    </div>

                    <div className="shrink-0 text-left sm:border-l sm:border-slate-100 sm:pl-4 sm:text-right">
                      <span className="text-[10px] font-medium uppercase tracking-wider text-slate-500">
                        {item.authority_metric_name ?? 'Authority metric'}
                      </span>
                      <div className="mt-0.5 flex items-baseline gap-1 sm:justify-end">
                        {item.authority_metric_value === null ? (
                          <span className="text-sm font-semibold text-slate-500">Not available</span>
                        ) : (
                          <>
                            <span className={`font-mono text-xl font-bold ${
                              hasLowerAuthorityEstimate ? 'text-emerald-700' : 'text-slate-900'
                            }`}>
                              {item.authority_metric_value}
                            </span>
                            <span className="text-xs text-slate-400">/ 100</span>
                          </>
                        )}
                      </div>
                      <span className="mt-1 block max-w-48 break-words text-[10px] text-slate-400">Source: {item.source}</span>
                    </div>
                  </div>
                </article>
              );
            })}
          </section>
        </>
      )}
    </div>
  );
};

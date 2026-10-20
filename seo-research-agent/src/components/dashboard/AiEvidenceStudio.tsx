'use client';

import React, { useEffect, useRef, useState } from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRightCircle, 
  RefreshCw,
  BookOpen,
  Briefcase,
  Code
} from 'lucide-react';
import { AIAnalysis } from '@/types/seo';
import { DEMO_AI_ANALYSIS_VARIANTS } from '@/data/demo-data';

export const AiEvidenceStudio: React.FC = () => {
  const [activePerspective, setActivePerspective] = useState<'creator' | 'saas' | 'agency'>('creator');
  const [isStreaming, setIsStreaming] = useState(false);
  const [analysis, setAnalysis] = useState<AIAnalysis>(DEMO_AI_ANALYSIS_VARIANTS.creator);
  const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleSwitchPerspective = (key: 'creator' | 'saas' | 'agency') => {
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    setActivePerspective(key);
    setAnalysis(DEMO_AI_ANALYSIS_VARIANTS[key]);
    setIsStreaming(true);
    animationTimerRef.current = setTimeout(() => {
      setIsStreaming(false);
      animationTimerRef.current = null;
    }, 600);
  };

  useEffect(() => () => {
    if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-lg font-bold text-slate-900">
              AI Niche Evidence Studio (PRD FR-05)
            </h1>
            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
              Evidence-Grounded Demo
            </span>
          </div>
          <p className="text-xs text-slate-500">
            Interprets the static keyword and competitor snapshot while keeping unsupported evidence gaps explicit.
          </p>
        </div>

        {/* Perspective Switcher */}
        <div
          className="flex flex-wrap items-center gap-1.5 rounded-xl border border-slate-200 bg-white p-1 shadow-2xs"
          role="group"
          aria-label="Analysis perspective"
        >
          <button
            type="button"
            onClick={() => handleSwitchPerspective('creator')}
            aria-pressed={activePerspective === 'creator'}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePerspective === 'creator'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <BookOpen className="h-3.5 w-3.5" />
            <span>Content Creator</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPerspective('saas')}
            aria-pressed={activePerspective === 'saas'}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePerspective === 'saas'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Code className="h-3.5 w-3.5" />
            <span>SaaS Founder</span>
          </button>
          <button
            type="button"
            onClick={() => handleSwitchPerspective('agency')}
            aria-pressed={activePerspective === 'agency'}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
              activePerspective === 'agency'
                ? 'bg-indigo-600 text-white shadow-xs'
                : 'text-slate-600 hover:bg-slate-50'
            }`}
          >
            <Briefcase className="h-3.5 w-3.5" />
            <span>Consultant / Agency</span>
          </button>
        </div>
      </div>

      {/* Main Analysis Card */}
      <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/40 to-white shadow-xs">
        {/* Banner */}
        <div className="border-b border-indigo-100 bg-white p-5">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
                <Sparkles className="h-5 w-5" />
              </div>
              <div>
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-slate-900">
                    Niche Evaluation Lens: <span className="text-indigo-600 font-semibold">{analysis.perspective}</span>
                  </h3>
                  <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800">
                    Static demo analysis
                  </span>
                </div>
                <p className="text-xs text-slate-500">
                  Model: {analysis.model_name} • Timestamp: {analysis.created_at}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleSwitchPerspective(activePerspective)}
                disabled={isStreaming}
                className="flex items-center gap-1.5 rounded-lg border border-indigo-200 bg-indigo-50 px-3 py-1.5 text-xs font-semibold text-indigo-700 hover:bg-indigo-100 transition"
              >
                <RefreshCw className={`h-3.5 w-3.5 ${isStreaming ? 'animate-spin' : ''}`} />
                <span>Re-Synthesize Evidence</span>
              </button>
            </div>
          </div>

          {/* Executive Summary Box */}
          <div className="mt-4 rounded-xl border border-indigo-100 bg-white p-4 text-xs leading-relaxed text-slate-700 shadow-2xs">
            {isStreaming ? (
              <div className="flex items-center gap-2 text-indigo-600" role="status" aria-live="polite">
                <RefreshCw className="h-4 w-4 animate-spin" aria-hidden="true" />
                <span>Updating the static demo analysis for this perspective...</span>
              </div>
            ) : (
              <>
                <strong className="text-indigo-900 font-semibold">Strategic Conclusion: </strong>
                {analysis.summary}
              </>
            )}
          </div>
        </div>

        {/* 4 Pillars of Evidence (FR-05) */}
        <div className="grid grid-cols-1 gap-5 p-5 md:grid-cols-2">
          {/* 1. Opportunity Signals */}
          <div className="rounded-xl border border-emerald-200 bg-emerald-50/30 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
              <CheckCircle2 className="h-4 w-4 text-emerald-600" />
              <span>1. Opportunity &amp; SERP Weakness Signals</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {analysis.opportunity_signals.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 2. Risks & Uncertainty */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/30 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
              <AlertTriangle className="h-4 w-4 text-amber-600" />
              <span>2. Risks &amp; Commercial Uncertainty</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {analysis.risks.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 3. Evidence Gaps */}
          <div className="rounded-xl border border-blue-200 bg-blue-50/30 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
              <HelpCircle className="h-4 w-4 text-blue-600" />
              <span>3. Missing Evidence (Data Gaps to Verify)</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {analysis.missing_evidence.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          {/* 4. Actionable Next Checks */}
          <div className="rounded-xl border border-indigo-200 bg-indigo-50/30 p-4">
            <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
              <ArrowRightCircle className="h-4 w-4 text-indigo-600" />
              <span>4. Actionable Human Validation Steps</span>
            </div>
            <ul className="mt-3 space-y-2 text-xs text-slate-700">
              {analysis.next_steps.map((item, idx) => (
                <li key={idx} className="flex items-start gap-2">
                  <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Footer Principles */}
        <div className="border-t border-indigo-100 bg-white/70 px-5 py-3 text-[11px] text-slate-500 flex flex-wrap items-center justify-between gap-2">
          <span>
            <strong>Product Principle #1:</strong> Evidence before AI conclusions. AI outputs are recommendations to test, never guarantees.
          </span>
          <span className="font-mono text-indigo-600">No metrics generated by this view</span>
        </div>
      </div>
    </div>
  );
};

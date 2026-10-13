'use client';

import React from 'react';
import { 
  Sparkles, 
  CheckCircle2, 
  AlertTriangle, 
  HelpCircle, 
  ArrowRightCircle, 
  Cpu, 
  Clock
} from 'lucide-react';
import { AIAnalysis } from '@/types/seo';

interface AiEvaluationCardProps {
  analysis: AIAnalysis;
}

export const AiEvaluationCard: React.FC<AiEvaluationCardProps> = ({ analysis }) => {
  return (
    <div className="overflow-hidden rounded-2xl border border-indigo-200 bg-gradient-to-b from-indigo-50/50 to-white shadow-xs">
      {/* Card Header with Clear Demo AI Tag */}
      <div className="border-b border-indigo-100 bg-white/80 p-5 backdrop-blur-xs">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-indigo-600 text-white shadow-sm shadow-indigo-200">
              <Sparkles className="h-5 w-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-sm font-bold text-slate-900">
                  AI Niche Evaluation (FR-05 Preview)
                </h3>
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-800">
                  Demo Mock Analysis
                </span>
              </div>
              <p className="text-xs text-slate-500">
                Grounding evidence strictly in retrieved keyword &amp; SERP data — no fabricated metrics.
              </p>
            </div>
          </div>

          <div className="flex items-center gap-3 text-xs text-slate-500">
            <span className="flex items-center gap-1 font-mono text-[11px]">
              <Cpu className="h-3.5 w-3.5 text-indigo-500" /> {analysis.model_name}
            </span>
            <span>•</span>
            <span className="flex items-center gap-1 text-[11px]">
              <Clock className="h-3.5 w-3.5 text-slate-400" /> {analysis.created_at}
            </span>
          </div>
        </div>

        {/* Executive Summary */}
        <div className="mt-4 rounded-xl border border-indigo-100/80 bg-white p-4 text-xs leading-relaxed text-slate-700 shadow-2xs">
          <strong className="text-indigo-900 font-semibold">Executive Assessment: </strong>
          {analysis.summary}
        </div>
      </div>

      {/* Grid of Evidence Findings */}
      <div className="grid grid-cols-1 gap-6 p-5 md:grid-cols-2">
        {/* Opportunity Signals */}
        <div className="rounded-xl border border-emerald-200/80 bg-emerald-50/30 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-emerald-900">
            <CheckCircle2 className="h-4 w-4 text-emerald-600" />
            <span>Opportunity &amp; SERP Weakness Signals</span>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {analysis.opportunity_signals.map((sig, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                <span>{sig}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Risks & Uncertainty */}
        <div className="rounded-xl border border-amber-200/80 bg-amber-50/30 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-amber-900">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <span>Risks &amp; Uncertainties</span>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {analysis.risks.map((risk, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-amber-500" />
                <span>{risk}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Evidence Gaps */}
        <div className="rounded-xl border border-blue-200/80 bg-blue-50/30 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-blue-900">
            <HelpCircle className="h-4 w-4 text-blue-600" />
            <span>Missing Evidence (Identified Gaps)</span>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {analysis.missing_evidence.map((gap, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                <span>{gap}</span>
              </li>
            ))}
          </ul>
        </div>

        {/* Next Recommended Checks */}
        <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-4">
          <div className="flex items-center gap-2 text-xs font-bold text-indigo-900">
            <ArrowRightCircle className="h-4 w-4 text-indigo-600" />
            <span>Recommended Next Human Checks</span>
          </div>
          <ul className="mt-3 space-y-2 text-xs text-slate-700">
            {analysis.next_steps.map((step, idx) => (
              <li key={idx} className="flex items-start gap-2">
                <span className="mt-1 h-1.5 w-1.5 shrink-0 rounded-full bg-indigo-500" />
                <span>{step}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Footer Disclaimer */}
      <div className="border-t border-indigo-100 bg-white/60 px-5 py-2.5 text-[11px] text-slate-500">
        <span className="font-semibold text-slate-700">PRD Principle: </span>
        Evidence before conclusions. AI recommendations are proposals to verify with real searchers, not ranking guarantees.
      </div>
    </div>
  );
};

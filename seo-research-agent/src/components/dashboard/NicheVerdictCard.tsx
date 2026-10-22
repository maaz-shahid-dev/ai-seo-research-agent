"use client";

import type { KeywordDto } from "@/features/research/types";

import { NicheVerdict } from "./NicheVerdict";
import { useSerpAnalysis } from "./useSerpAnalysis";

/** The headline answer for the searched topic: is this niche easy? */
export function NicheVerdictCard({ runId, keyword }: { runId: string; keyword: KeywordDto }) {
  const { data: serp, error } = useSerpAnalysis(runId, keyword.id);

  return (
    <section aria-labelledby="verdict-title" className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 id="verdict-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Is “{keyword.keyword}” easy to rank for?
      </h2>
      <div className="mt-3">
        <NicheVerdict keyword={keyword} serp={serp} error={error} />
      </div>
    </section>
  );
}

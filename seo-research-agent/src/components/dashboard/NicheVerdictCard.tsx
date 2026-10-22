import type { KeywordDto, SerpAnalysisDto } from "@/features/research/types";

import { NicheVerdict } from "./NicheVerdict";
import { Card } from "@/components/ui/Card";

/** The headline answer for the searched topic: is this niche easy? */
export function NicheVerdictCard({ keyword, serp, error, rpmUsd }: { keyword: KeywordDto; serp: SerpAnalysisDto | null; error: string | null; rpmUsd?: number }) {
  return (
    <Card as="section" aria-labelledby="verdict-title">
      <h2 id="verdict-title" className="text-xs font-semibold uppercase tracking-wide text-slate-500">
        Is “{keyword.keyword}” easy to rank for?
      </h2>
      <div className="mt-3">
        <NicheVerdict keyword={keyword} serp={serp} error={error} rpmUsd={rpmUsd} />
      </div>
    </Card>
  );
}

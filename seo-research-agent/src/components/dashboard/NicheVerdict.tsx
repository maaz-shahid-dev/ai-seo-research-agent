import { Loader2 } from "lucide-react";

import {
  authorityBands,
  EASY_TARGET_AUTHORITY_MAX,
  nicheVerdict,
  revenueEstimate,
  type NicheVerdict as Verdict,
} from "@/features/research/niche";
import { isJobInProgress, type KeywordDto, type SerpAnalysisDto } from "@/features/research/types";
import { nicheTone, type BadgeTone } from "@/components/ui/Badge";
import { ScoreRing } from "@/components/ui/ScoreRing";
import { formatNumber } from "@/lib/format";

const VERDICT_COPY: Record<Verdict, { title: string; tone: string }> = {
  ideal: { title: "Ideal — low-hanging fruit", tone: "text-emerald-700" },
  ok: { title: "OK — good chance", tone: "text-emerald-700" },
  maybe: { title: "Maybe — still possible", tone: "text-amber-700" },
  hard: { title: "Hard — strong sites only", tone: "text-rose-700" },
};

const usd = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

type NicheVerdictProps = {
  keyword: KeywordDto;
  serp: SerpAnalysisDto | null;
  error: string | null;
  /** Show the revenue estimate (the main card does; the side panel keeps it compact). */
  showRevenue?: boolean;
};

/** "Is this niche easy?" — verdict, authority spread and revenue for one keyword's top 10. */
export function NicheVerdict({ keyword, serp, error, showRevenue = true }: NicheVerdictProps) {
  if (error && !serp) return <p className="text-sm text-amber-700" role="status">{error}</p>;
  if (!serp || isJobInProgress(serp)) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
        <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
        Checking who ranks for “{keyword.keyword}”…
      </p>
    );
  }
  if (serp.status === "failed") return <p className="text-sm text-rose-700" role="alert">{serp.errorMessage}</p>;

  const verdict = nicheVerdict(serp.results);
  const bands = authorityBands(serp.results);
  const easy = serp.results.filter((result) => result.authority !== null && result.authority <= EASY_TARGET_AUTHORITY_MAX).length;
  const dedicated = serp.results.filter((result) => result.isHomepage).length;
  const revenue = showRevenue ? revenueEstimate(keyword.searchVolume) : [];

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-5">
        {serp.nicheScore !== null ? (
          <ScoreRing value={serp.nicheScore} label="Niche score" tone={toneForRing(nicheTone(serp.nicheScore))} />
        ) : null}
        <div className="min-w-0">
          {verdict ? (
            <p className={`text-2xl font-semibold ${VERDICT_COPY[verdict].tone}`}>{VERDICT_COPY[verdict].title}</p>
          ) : (
            <p className="text-2xl font-semibold text-slate-700">No authority data yet</p>
          )}
          <p className="mt-1 text-sm text-slate-600">
            {easy === 0 ? "No" : easy} {easy === 1 ? "site" : "sites"} under authority {EASY_TARGET_AUTHORITY_MAX + 1} in the top 10
            {dedicated > 0 ? `, ${dedicated} dedicated ${dedicated === 1 ? "site" : "sites"} ranking` : ""}
            {keyword.searchVolume !== null ? `. ${formatNumber(keyword.searchVolume)} searches a month.` : "."}
          </p>
          <p className="mt-1 text-xs text-slate-400">Niche score: easier keywords and weaker page-1 sites score higher.</p>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-5">
        <Stat label="High (>50)" value={bands.high} />
        <Stat label="Mid (30–50)" value={bands.mid} />
        <Stat label="Low (<30)" value={bands.low} highlight={bands.low > 0} />
        <Stat label="Dedicated sites" value={dedicated} />
        <Stat label="AI Overview" value={serp.hasAiOverview === null ? "—" : serp.hasAiOverview ? "Yes" : "No"} />
      </dl>

      {revenue.length > 0 ? (
        <div>
          <p className="text-xs font-medium text-slate-500">If you rank #1–#3 (display ads, estimate)</p>
          <div className="mt-2 grid grid-cols-3 gap-2">
            {revenue.map((estimate) => (
              <div key={estimate.rank} className="rounded-lg border border-slate-200 px-3 py-2 text-center">
                <p className="text-xs text-slate-500">Rank #{estimate.rank}</p>
                <p className="text-base font-semibold text-emerald-700">{usd.format(estimate.monthlyUsd)}<span className="text-xs font-normal text-slate-500">/mo</span></p>
                <p className="text-[11px] text-slate-400">{usd.format(estimate.lowUsd)} – {usd.format(estimate.highUsd)}</p>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}

function Stat({ label, value, highlight = false }: { label: string; value: React.ReactNode; highlight?: boolean }) {
  return (
    <div className={`rounded-lg px-3 py-2 ${highlight ? "bg-emerald-50" : "bg-slate-50"}`}>
      <dt className="text-[11px] text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

function toneForRing(tone: BadgeTone): "good" | "warn" | "bad" {
  return tone === "good" || tone === "warn" ? tone : "bad";
}

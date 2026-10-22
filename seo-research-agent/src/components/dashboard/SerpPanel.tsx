"use client";

import { ExternalLink, Loader2, X } from "lucide-react";

import { ISKILLS_BEATABLE_AUTHORITY_MAX } from "@/features/research/iskills";
import { competitionLevel, WEAK_SPOT_LABELS } from "@/features/research/niche";
import { isJobInProgress, type KeywordDto, type SerpResultDto } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { useDialogFocus } from "@/hooks/useDialogFocus";
import { RETRYING_MESSAGE } from "@/hooks/usePolling";
import { formatCurrencyMicros, formatNumber } from "@/lib/format";
import { safeExternalUrl } from "@/lib/url";

import { NicheVerdict } from "./NicheVerdict";
import { SerpInsights } from "./SerpInsights";
import { useSerpAnalysis } from "./useSerpAnalysis";

type SerpPanelProps = {
  runId: string;
  keyword: KeywordDto;
  onClose: () => void;
};

/** Side panel with a keyword's metrics, 12-month trend and analyzed top 10. */
export function SerpPanel({ runId, keyword, onClose }: SerpPanelProps) {
  const dialogRef = useDialogFocus<HTMLDivElement>(true, onClose);
  const { data: serp, error } = useSerpAnalysis(runId, keyword.id);
  const weakCount = serp?.results.filter((result) => result.weakSpots.length > 0).length ?? 0;
  const lowestAuthority = lowestAuthorityRank(serp?.results ?? []);

  return (
    <div className="fixed inset-0 z-40 flex justify-end">
      <div className="absolute inset-0 bg-black/30" onClick={onClose} aria-hidden="true" />
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="serp-title"
        tabIndex={-1}
        className="relative flex h-full w-full max-w-2xl flex-col overflow-y-auto bg-white shadow-xl"
      >
        <header className="sticky top-0 z-10 flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-5 py-4">
          <div className="min-w-0">
            <p className="text-xs text-slate-500">SERP analysis</p>
            <h2 id="serp-title" className="truncate text-lg font-semibold text-slate-950">{keyword.keyword}</h2>
          </div>
          <Button variant="ghost" size="sm" onClick={onClose} aria-label="Close">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        </header>

        <div className="space-y-5 p-5">
          <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Metric label="Volume" value={formatNumber(keyword.searchVolume)} />
            <Metric
              label="Difficulty"
              value={keyword.difficulty === null ? "—" : <Badge tone={difficultyTone(keyword.difficulty)}>{keyword.difficulty}</Badge>}
            />
            <Metric label="CPC" value={formatCurrencyMicros(keyword.cpcMicros)} />
            <Metric label="Competition" value={competitionLevel(keyword.competition) ?? "—"} />
          </dl>

          {serp?.status === "completed" ? <NicheVerdict keyword={keyword} serp={serp} error={null} showRevenue={false} /> : null}

          {serp?.status === "completed" ? <SerpInsights results={serp.results} /> : null}

          <TrendBars trend={keyword.trend} />

          <section aria-labelledby="top10-title">
            <div className="flex items-baseline justify-between">
              <h3 id="top10-title" className="text-sm font-semibold text-slate-900">Top 10 results</h3>
              {serp?.status === "completed" ? (
                <p className="text-xs text-slate-500">{weakCount} of {serp.results.length} are weak spots</p>
              ) : null}
            </div>

            {error && serp ? <p className="mt-3 text-sm text-amber-700" role="status">{error}</p> : null}
            {error && !serp && error !== RETRYING_MESSAGE ? (
              <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p>
            ) : !serp || isJobInProgress(serp) ? (
              <p className="mt-3 flex items-center gap-2 text-sm text-slate-600" role="status">
                <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" />
                Analyzing the top 10…
              </p>
            ) : serp.status === "failed" ? (
              <p className="mt-3 text-sm text-rose-700" role="alert">{serp.errorMessage ?? "SERP analysis failed."}</p>
            ) : (
              <ol aria-labelledby="top10-title" className="mt-3 divide-y divide-slate-100 rounded-xl border border-slate-200">
                {serp.results.map((result) => (
                  <SerpRow key={result.rank} result={result} isLowest={result.rank === lowestAuthority} />
                ))}
              </ol>
            )}
          </section>
        </div>
      </div>
    </div>
  );
}

function SerpRow({ result, isLowest }: { result: SerpResultDto; isLowest: boolean }) {
  const href = safeExternalUrl(result.url);
  // Green rows (DR 20 or less) are realistic targets, as in classic niche-hunting tools.
  const easy = result.authority !== null && result.authority <= ISKILLS_BEATABLE_AUTHORITY_MAX;
  return (
    <li className={`flex gap-3 p-3 ${easy ? "bg-emerald-50/60" : ""}`}>
      <span className="w-6 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-slate-400">{result.rank}</span>
      <div className="min-w-0 flex-1">
        {href ? (
          <a href={href} target="_blank" rel="noopener noreferrer" className="group inline-flex max-w-full items-center gap-1 text-sm font-medium text-slate-900 hover:text-indigo-700">
            <span className="truncate">{result.title}</span>
            <ExternalLink className="h-3 w-3 shrink-0 text-slate-400 group-hover:text-indigo-600" aria-hidden="true" />
          </a>
        ) : (
          <p className="truncate text-sm font-medium text-slate-900">{result.title}</p>
        )}
        <p className="truncate text-xs text-slate-500">{result.domain}</p>
        <div className="mt-1.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-600">
          <span>Authority <strong className="font-semibold text-slate-900">{result.authority ?? "—"}</strong></span>
          <span>Traffic <strong className="font-semibold text-slate-900">{formatNumber(result.monthlyTraffic)}</strong></span>
          <span>Age <strong className="font-semibold text-slate-900">{formatAge(result.domainAgeYears)}</strong></span>
          <span>Backlinks <strong className="font-semibold text-slate-900">{formatCompact(result.backlinks)}</strong></span>
          <span>Ref. domains <strong className="font-semibold text-slate-900">{formatCompact(result.referringDomains)}</strong></span>
          {result.isHomepage ? <Badge tone="accent">Dedicated site</Badge> : null}
          {isLowest ? <Badge tone="good">Lowest authority</Badge> : null}
          {result.weakSpots.map((spot) => <Badge key={spot} tone="good">{WEAK_SPOT_LABELS[spot]}</Badge>)}
        </div>
      </div>
    </li>
  );
}

function Metric({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-3 py-2">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{value}</dd>
    </div>
  );
}

const MONTH_LABEL = new Intl.DateTimeFormat("en-US", { month: "short", timeZone: "UTC" });

/** Last 12 months of search volume as bars; SVG attributes only (CSP-safe). */
function TrendBars({ trend }: { trend: KeywordDto["trend"] }) {
  const points = trend ? [...trend].sort((a, b) => a.month.localeCompare(b.month)).slice(-12) : [];
  if (points.length < 2) return null;
  const max = Math.max(...points.map((point) => point.volume), 1);
  const barWidth = 100 / points.length;

  return (
    <section aria-labelledby="trend-title">
      <h3 id="trend-title" className="text-sm font-semibold text-slate-900">Search trend</h3>
      <svg viewBox="0 0 100 40" preserveAspectRatio="none" className="mt-2 h-24 w-full" role="img" aria-label="Monthly search volume for the last 12 months">
        {points.map((point, index) => {
          const height = Math.max((point.volume / max) * 38, 1);
          return (
            <rect key={point.month} x={index * barWidth + barWidth * 0.15} y={40 - height} width={barWidth * 0.7} height={height} rx="0.6" className="fill-indigo-500">
              <title>{`${point.month}: ${formatNumber(point.volume)}`}</title>
            </rect>
          );
        })}
      </svg>
      <div className="mt-1 flex text-[10px] text-slate-400">
        {points.map((point) => (
          <span key={point.month} className="flex-1 text-center">{MONTH_LABEL.format(new Date(`${point.month}-01T00:00:00Z`))}</span>
        ))}
      </div>
    </section>
  );
}

function formatAge(years: number | null) {
  if (years === null) return "—";
  return years < 1 ? "<1 yr" : `${Math.floor(years)} yr`;
}

const compact = new Intl.NumberFormat("en-US", { notation: "compact", maximumFractionDigits: 1 });

function formatCompact(value: number | null) {
  return value === null ? "—" : compact.format(value);
}

/** Rank of the result with the lowest known authority, or null when none is known. */
function lowestAuthorityRank(results: readonly SerpResultDto[]) {
  let lowest: SerpResultDto | null = null;
  for (const result of results) {
    if (result.authority !== null && (lowest === null || result.authority < lowest.authority!)) lowest = result;
  }
  return lowest?.rank ?? null;
}

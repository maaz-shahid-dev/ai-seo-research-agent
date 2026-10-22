"use client";

import { CheckCircle2, CircleHelp, TriangleAlert, XCircle } from "lucide-react";
import { useMemo } from "react";

import { buildContentPlan } from "@/features/research/coverage";
import { iskillsChecklist, type CheckStatus } from "@/features/research/iskills";
import type { KeywordDto, SerpAnalysisDto } from "@/features/research/types";
import { formatNumber } from "@/lib/format";

const STATUS_ICON: Record<CheckStatus, { icon: typeof CheckCircle2; className: string; label: string }> = {
  pass: { icon: CheckCircle2, className: "text-emerald-600", label: "Pass" },
  warn: { icon: TriangleAlert, className: "text-amber-500", label: "Caution" },
  fail: { icon: XCircle, className: "text-rose-600", label: "Fail" },
  unknown: { icon: CircleHelp, className: "text-slate-400", label: "Not checked yet" },
};

const VERDICT_COPY = {
  go: { title: "Go for it", detail: "This niche fits the iSkills selection rules.", className: "border-emerald-200 bg-emerald-50 text-emerald-900" },
  maybe: { title: "Possible, with care", detail: "Some rules aren't met — read the cautions before committing.", className: "border-amber-200 bg-amber-50 text-amber-900" },
  avoid: { title: "Avoid this niche", detail: "It breaks key iSkills rules. Pick a safer, more specific angle.", className: "border-rose-200 bg-rose-50 text-rose-900" },
} as const;

const NICHES_TO_AVOID = [
  "Betting / gambling", "Adult", "Piracy, cracks, .exe downloads", "Movie / MP3 downloads",
  "Copyright infringement", "Health for beginners", "Finance for beginners", "High-risk YMYL (your money or your life)",
];

type IskillsViewProps = {
  seed: KeywordDto;
  keywords: readonly KeywordDto[];
  serp: SerpAnalysisDto | null;
};

/** The iSkills niche-selection checklist, rule by rule, for the searched topic. */
export function IskillsView({ seed, keywords, serp }: IskillsViewProps) {
  const pages = useMemo(() => buildContentPlan(seed.keyword, keywords).pages, [seed.keyword, keywords]);
  const result = iskillsChecklist({
    seed: seed.keyword,
    seedVolume: seed.searchVolume,
    keywords,
    contentPages: pages,
    serp: serp?.status === "completed" ? serp : null,
  });
  const verdict = VERDICT_COPY[result.verdict];

  return (
    <div className="space-y-4">
      <div className={`rounded-xl border p-4 ${verdict.className}`} role="status">
        <p className="text-lg font-semibold">{verdict.title}</p>
        <p className="text-sm opacity-90">{verdict.detail} Niche selection is the biggest success or failure factor.</p>
      </div>

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {result.items.map((item) => {
          const status = STATUS_ICON[item.status];
          const Icon = status.icon;
          return (
            <li key={item.id} className="flex gap-3 p-3">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${status.className}`} aria-label={status.label} />
              <div className="min-w-0">
                <p className="text-sm font-medium text-slate-900">{item.label}</p>
                <p className="text-sm text-slate-600">{item.detail}</p>
              </div>
            </li>
          );
        })}
      </ul>

      {result.weakestSites.length > 0 ? (
        <section aria-labelledby="weakest-title" className="rounded-xl border border-slate-200 bg-white">
          <h3 id="weakest-title" className="border-b border-slate-100 px-4 py-3 text-sm font-semibold text-slate-900">
            Weakest page-1 sites {serp?.hasAiOverview ? "(AI Overview present — check they still get traffic)" : ""}
          </h3>
          <div className="relative overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500">
                <tr>
                  <th scope="col" className="px-4 py-2 font-medium">Site</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Authority</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Organic traffic</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Ranking keywords</th>
                  <th scope="col" className="px-4 py-2 text-right font-medium">Age</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {result.weakestSites.map((site) => (
                  <tr key={site.domain}>
                    <td className="px-4 py-2 font-medium text-slate-900">{site.domain}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{site.authority ?? "—"}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(site.monthlyTraffic)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{formatNumber(site.rankingKeywords)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{site.domainAgeYears === null ? "—" : `${Math.floor(site.domainAgeYears)} yr`}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <details className="rounded-xl border border-slate-200 bg-white p-4 text-sm text-slate-700">
        <summary className="cursor-pointer font-medium text-slate-900">Niches to avoid</summary>
        <ul className="mt-2 grid list-disc gap-1 pl-5 sm:grid-cols-2">
          {NICHES_TO_AVOID.map((item) => <li key={item}>{item}</li>)}
        </ul>
      </details>
    </div>
  );
}

"use client";

import { CalendarDays, CheckCircle2, ChevronDown, Download, FileText, Globe, Network, Rocket, Zap } from "lucide-react";
import { useMemo, useState, type ReactNode } from "react";

import { buildBlueprint, launchSteps, type ContentBrief } from "@/features/research/blueprint";
import { blueprintToMarkdown, launchPlanFileName } from "@/features/research/blueprint-export";
import { NICHE_TYPE_PROFILES, type NicheType } from "@/features/research/niche-types";
import type { KeywordDto } from "@/features/research/types";
import { ARTICLE_TYPE_LABELS } from "@/features/research/coverage";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { StatCard } from "@/components/ui/Card";
import { useStoredChecklist } from "@/hooks/useStoredChecklist";
import { downloadFile } from "@/lib/download";
import { formatNumber } from "@/lib/format";
import { Card } from "@/components/ui/Card";

/** Briefs shown before "Show all", so the plan stays scannable. */
const BRIEFS_PREVIEW = 10;

type LaunchPlanViewProps = {
  /** Ticked steps are remembered per search. */
  runId: string;
  seed: string;
  keywords: readonly KeywordDto[];
  nicheType: NicheType;
};

/** From niche to income: steps, domain, structure, briefs and a 12-week calendar. */
export function LaunchPlanView({ runId, seed, keywords, nicheType }: LaunchPlanViewProps) {
  const blueprint = useMemo(() => buildBlueprint(seed, keywords, nicheType), [seed, keywords, nicheType]);
  const steps = useMemo(() => launchSteps(nicheType), [nicheType]);
  const [showAllBriefs, setShowAllBriefs] = useState(false);
  const progress = useStoredChecklist(`seo-research:launch:${runId}`);
  const doneCount = steps.filter((step) => progress.done.has(step.title)).length;

  function exportPlan() {
    downloadFile(launchPlanFileName(blueprint.seed), blueprintToMarkdown(blueprint, steps, progress.done), "text/markdown;charset=utf-8");
  }

  if (blueprint.briefs.length === 0) return <p className="py-6 text-sm text-slate-500">No keywords to plan yet.</p>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <Button variant="secondary" size="sm" onClick={exportPlan}>
          <Download className="h-4 w-4" aria-hidden="true" /> Export plan
        </Button>
      </div>
      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="Niche type" value={NICHE_TYPE_PROFILES[nicheType].label} compact />
        <StatCard label="Articles" value={formatNumber(blueprint.totals.articles)} />
        <StatCard label="Quick wins" value={formatNumber(blueprint.totals.quickWins)} />
        <StatCard label="Words to write" value={formatNumber(blueprint.totals.words)} />
      </dl>

      <Section icon={Rocket} title="Launch steps, A to Z" note={`${doneCount} of ${steps.length} done`}>
        <progress value={doneCount} max={steps.length} aria-label="Launch progress" className="mb-3 h-1.5 w-full overflow-hidden rounded-full [&::-moz-progress-bar]:bg-emerald-500 [&::-webkit-progress-bar]:bg-slate-100 [&::-webkit-progress-value]:bg-emerald-500" />
        <ol className="space-y-3">
          {steps.map((step, index) => {
            const done = progress.done.has(step.title);
            const id = `launch-step-${index}`;
            return (
              <li key={step.title} className="flex gap-3">
                <input
                  id={id}
                  type="checkbox"
                  checked={done}
                  onChange={() => progress.toggle(step.title)}
                  className="mt-0.5 h-5 w-5 shrink-0 cursor-pointer rounded border-slate-300 accent-emerald-600"
                />
                <label htmlFor={id} className="cursor-pointer">
                  <span className={`block text-sm font-medium ${done ? "text-slate-500 line-through" : "text-slate-900"}`}>{index + 1}. {step.title}</span>
                  <span className="block text-sm text-slate-600">{step.detail}</span>
                </label>
              </li>
            );
          })}
        </ol>
      </Section>

      <Section icon={Globe} title="Domain name ideas" note="Check availability before buying.">
        <ul className="flex flex-wrap gap-2">
          {blueprint.domains.map((domain) => (
            <li key={domain.name} className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm">
              <span className="font-medium text-slate-900">{domain.name}</span>
              <span className="ml-2 text-xs capitalize text-slate-500">{domain.style}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section icon={Network} title="Site structure" note="Every article links to its pillar and two related articles.">
        <div className="grid gap-3 md:grid-cols-2">
          {blueprint.silos.map((silo) => (
            <div key={silo.name} className="rounded-lg border border-slate-200 p-3">
              <p className="text-sm font-semibold text-slate-900">{silo.name} <span className="font-normal text-slate-500">{silo.path}</span></p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {silo.articles.slice(0, 6).map((article) => <li key={article.url} className="truncate">{article.url}</li>)}
                {silo.articles.length > 6 ? <li className="text-xs text-slate-500">+{silo.articles.length - 6} more</li> : null}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={CalendarDays} title="12-week publishing calendar" note="Pillar first, then quick wins.">
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {blueprint.calendar.map((week) => (
            <div key={week.week} className="rounded-lg border border-slate-200 p-3">
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Week {week.week}</p>
              <ul className="mt-1.5 space-y-1 text-sm text-slate-700">
                {week.articles.map((article) => (
                  <li key={article.url} className="flex items-start gap-1.5">
                    {article.quickWin ? <Zap className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-500" aria-label="Quick win" /> : <span className="w-3.5 shrink-0" />}
                    <span className="min-w-0">{article.title}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      </Section>

      <Section icon={FileText} title="Content briefs" note={`${blueprint.briefs.length} ready-to-write briefs.`}>
        <ol className="space-y-2">
          {(showAllBriefs ? blueprint.briefs : blueprint.briefs.slice(0, BRIEFS_PREVIEW)).map((brief) => (
            <BriefItem key={brief.url} brief={brief} />
          ))}
        </ol>
        {blueprint.briefs.length > BRIEFS_PREVIEW ? (
          <div className="mt-3 text-center">
            <Button variant="secondary" size="sm" onClick={() => setShowAllBriefs((current) => !current)}>
              {showAllBriefs ? "Show fewer" : `Show all ${blueprint.briefs.length} briefs`}
            </Button>
          </div>
        ) : null}
      </Section>
    </div>
  );
}

function BriefItem({ brief }: { brief: ContentBrief }) {
  return (
    <li>
      <details className="group rounded-lg border border-slate-200">
        <summary className="flex cursor-pointer list-none items-center gap-3 p-3">
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-medium text-slate-900">{brief.title}</p>
            <p className="truncate text-xs text-slate-500">{brief.url} · {formatNumber(brief.monthlyVolume)} searches/mo · ~{formatNumber(brief.wordCount)} words</p>
          </div>
          {brief.quickWin ? <Badge tone="good">Quick win</Badge> : null}
          <Badge tone="neutral">{ARTICLE_TYPE_LABELS[brief.articleType]}</Badge>
          {brief.difficulty !== null ? <Badge tone={difficultyTone(brief.difficulty)} title="Average difficulty">KD {brief.difficulty}</Badge> : null}
          <ChevronDown className="h-4 w-4 shrink-0 text-slate-400 transition group-open:rotate-180" aria-hidden="true" />
        </summary>
        <div className="grid gap-4 border-t border-slate-100 p-3 text-sm sm:grid-cols-2">
          <BriefBlock title="Target keyword"><p className="text-slate-800">{brief.targetKeyword}</p></BriefBlock>
          <BriefBlock title="Secondary keywords">
            <p className="text-slate-700">{brief.secondaryKeywords.join(", ") || "—"}</p>
          </BriefBlock>
          <BriefBlock title="Outline (H2s)">
            <ol className="list-decimal space-y-0.5 pl-4 text-slate-700">{brief.outline.map((heading) => <li key={heading}>{heading}</li>)}</ol>
          </BriefBlock>
          <BriefBlock title="Questions to answer">
            {brief.questions.length > 0 ? (
              <ul className="space-y-0.5 text-slate-700">
                {brief.questions.map((question) => (
                  <li key={question} className="flex gap-1.5"><CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" aria-hidden="true" />{question}</li>
                ))}
              </ul>
            ) : <p className="text-slate-500">—</p>}
          </BriefBlock>
          <BriefBlock title="Internal links"><p className="break-words text-slate-700">{brief.internalLinks.join(" · ") || "—"}</p></BriefBlock>
        </div>
      </details>
    </li>
  );
}

function Section({ icon: Icon, title, note, children }: { icon: typeof Rocket; title: string; note?: string; children: ReactNode }) {
  return (
    <Card as="section">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-indigo-600" aria-hidden="true" /> {title}
        </h3>
        {note ? <p className="text-xs text-slate-500">{note}</p> : null}
      </div>
      {children}
    </Card>
  );
}

function BriefBlock({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
      <div className="mt-1">{children}</div>
    </div>
  );
}

"use client";

import { CalendarDays, CheckCircle2, ChevronDown, FileText, Globe, Network, Rocket, Zap } from "lucide-react";
import { useMemo, type ReactNode } from "react";

import { buildBlueprint, launchSteps, type ContentBrief } from "@/features/research/blueprint";
import { NICHE_TYPE_PROFILES, type NicheType } from "@/features/research/niche-types";
import type { KeywordDto } from "@/features/research/types";
import { ARTICLE_TYPE_LABELS } from "@/features/research/coverage";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { formatNumber } from "@/lib/format";

type LaunchPlanViewProps = { seed: string; keywords: readonly KeywordDto[]; nicheType: NicheType };

/** From niche to income: steps, domain, structure, briefs and a 12-week calendar. */
export function LaunchPlanView({ seed, keywords, nicheType }: LaunchPlanViewProps) {
  const blueprint = useMemo(() => buildBlueprint(seed, keywords, nicheType), [seed, keywords, nicheType]);
  const steps = useMemo(() => launchSteps(nicheType), [nicheType]);

  if (blueprint.briefs.length === 0) return <p className="py-6 text-sm text-slate-500">No keywords to plan yet.</p>;

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-4">
        <Total label="Niche type" value={NICHE_TYPE_PROFILES[nicheType].label} />
        <Total label="Articles" value={formatNumber(blueprint.totals.articles)} />
        <Total label="Quick wins" value={formatNumber(blueprint.totals.quickWins)} />
        <Total label="Words to write" value={formatNumber(blueprint.totals.words)} />
      </div>

      <Section icon={Rocket} title="Launch steps, A to Z">
        <ol className="space-y-3">
          {steps.map((step, index) => (
            <li key={step.title} className="flex gap-3">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-indigo-50 text-xs font-semibold text-indigo-700">{index + 1}</span>
              <div>
                <p className="text-sm font-medium text-slate-900">{step.title}</p>
                <p className="text-sm text-slate-600">{step.detail}</p>
              </div>
            </li>
          ))}
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
              <p className="text-sm font-semibold text-slate-900">{silo.name} <span className="font-normal text-slate-400">{silo.path}</span></p>
              <ul className="mt-2 space-y-1 text-sm text-slate-600">
                {silo.articles.slice(0, 6).map((article) => <li key={article.url} className="truncate">{article.url}</li>)}
                {silo.articles.length > 6 ? <li className="text-xs text-slate-400">+{silo.articles.length - 6} more</li> : null}
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
          {blueprint.briefs.map((brief) => <BriefItem key={brief.url} brief={brief} />)}
        </ol>
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
            ) : <p className="text-slate-400">—</p>}
          </BriefBlock>
          <BriefBlock title="Internal links"><p className="break-words text-slate-700">{brief.internalLinks.join(" · ") || "—"}</p></BriefBlock>
        </div>
      </details>
    </li>
  );
}

function Section({ icon: Icon, title, note, children }: { icon: typeof Rocket; title: string; note?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="flex items-center gap-2 text-sm font-semibold text-slate-900">
          <Icon className="h-4 w-4 text-indigo-600" aria-hidden="true" /> {title}
        </h3>
        {note ? <p className="text-xs text-slate-500">{note}</p> : null}
      </div>
      {children}
    </section>
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

function Total({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-lg font-semibold text-slate-900">{value}</p>
    </div>
  );
}

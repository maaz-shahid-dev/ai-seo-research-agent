"use client";

import { Lightbulb, Loader2, Search } from "lucide-react";
import { useState } from "react";

import {
  DEFAULT_IDEA_FILTERS,
  filterAndSortIdeas,
  hasLowAuthorityGap,
  ISKILLS_BEATABLE_AUTHORITY_MAX,
  LOW_AUTHORITY_SITES_TARGET,
  type IdeaFilters,
  type IdeaSort,
} from "@/features/research/daily-ideas";
import { marketFor } from "@/features/research/markets";
import { NICHE_TYPE_PROFILES, NICHE_TYPES } from "@/features/research/niche-types";
import type { NicheIdeaDto, NicheIdeasResponse } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePolling } from "@/hooks/usePolling";
import { apiRequest } from "@/lib/api-client";
import { formatNumber } from "@/lib/format";

const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

const SORTS: { value: IdeaSort; label: string }[] = [
  { value: "opportunity", label: "Best opportunity" },
  { value: "volume", label: "Highest volume" },
  { value: "difficulty", label: "Lowest difficulty" },
];

const selectClass = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700";

type CheckNiche = (seed: string, countryCode: string) => void;

/** Fresh, pre-checked niche ideas each morning; one click checks a niche in its own country. */
export function DailyNichesView({ onCheck }: { onCheck: CheckNiche }) {
  const [filters, setFilters] = useState<IdeaFilters>(DEFAULT_IDEA_FILTERS);
  const { data, error } = usePolling(
    "/api/niche-ideas",
    (signal) => apiRequest<NicheIdeasResponse>("/api/niche-ideas", { signal }),
    () => null,
  );
  const ideas = data?.ideas ?? [];
  const visible = filterAndSortIdeas(ideas, filters);
  const types = NICHE_TYPES.filter((type) => ideas.some((idea) => idea.nicheType === type));
  const countries = [...new Set(ideas.map((idea) => idea.countryCode))].sort();
  const update = (change: Partial<IdeaFilters>) => setFilters((current) => ({ ...current, ...change }));

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
          <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
          Daily niches
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {data?.date ? `Ideas for ${dateFormat.format(new Date(`${data.date}T00:00:00Z`))}. ` : ""}
          Each idea is pre-checked in its country: monthly searches, difficulty and how many page-1 sites have DR {ISKILLS_BEATABLE_AUTHORITY_MAX} or less.
          Risky topics (gambling, adult, piracy, YMYL) are never suggested.
        </p>
      </div>

      {ideas.length > 0 ? (
        <div className="space-y-3 rounded-xl border border-slate-200 bg-white p-3">
          <div className="flex flex-wrap items-center gap-2">
            <FilterChip active={filters.lowAuthorityOnly} onClick={() => update({ lowAuthorityOnly: !filters.lowAuthorityOnly })}>
              Low DR ({LOW_AUTHORITY_SITES_TARGET}+ sites ≤ {ISKILLS_BEATABLE_AUTHORITY_MAX})
            </FilterChip>
            <label className="sr-only" htmlFor="idea-sort">Sort ideas</label>
            <select id="idea-sort" value={filters.sort} onChange={(event) => update({ sort: event.target.value as IdeaSort })} className={selectClass}>
              {SORTS.map((sort) => <option key={sort.value} value={sort.value}>{sort.label}</option>)}
            </select>
            {countries.length > 1 ? (
              <>
                <label className="sr-only" htmlFor="idea-country">Country</label>
                <select id="idea-country" value={filters.countryCode} onChange={(event) => update({ countryCode: event.target.value })} className={selectClass}>
                  <option value="all">All countries</option>
                  {countries.map((code) => <option key={code} value={code}>{countryLabel(code)}</option>)}
                </select>
              </>
            ) : null}
          </div>
          {types.length > 1 ? (
            <div role="group" aria-label="Filter by niche type" className="flex flex-wrap gap-2">
              <FilterChip active={filters.nicheType === "all"} onClick={() => update({ nicheType: "all" })}>All types ({ideas.length})</FilterChip>
              {types.map((type) => (
                <FilterChip key={type} active={filters.nicheType === type} onClick={() => update({ nicheType: type })}>
                  {NICHE_TYPE_PROFILES[type].label} ({ideas.filter((idea) => idea.nicheType === type).length})
                </FilterChip>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {error && !data ? <ErrorState>{error}</ErrorState> : null}
      {!data && !error ? (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" /> Loading today’s ideas…
        </p>
      ) : null}
      {data && ideas.length === 0 ? (
        <EmptyState>New ideas appear every morning. Check back tomorrow.</EmptyState>
      ) : null}
      {ideas.length > 0 && visible.length === 0 ? (
        <EmptyState action={<Button variant="secondary" size="sm" onClick={() => setFilters(DEFAULT_IDEA_FILTERS)}>Clear filters</Button>}>
          No ideas match these filters today.
        </EmptyState>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((idea) => <IdeaCard key={idea.id} idea={idea} onCheck={onCheck} />)}
      </ul>
    </div>
  );
}

function IdeaCard({ idea, onCheck }: { idea: NicheIdeaDto; onCheck: CheckNiche }) {
  const low = idea.lowAuthorityCount;
  return (
    <li className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-900">{idea.niche}</p>
        <Badge tone="accent">{NICHE_TYPE_PROFILES[idea.nicheType].label}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-600">{idea.problem}</p>
      <p className="mt-2 text-xs text-slate-500">For {idea.audience} · {countryLabel(idea.countryCode)}</p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Volume">{formatNumber(idea.searchVolume)}</Metric>
        <Metric label="KD">
          {idea.difficulty === null ? "—" : <Badge tone={difficultyTone(idea.difficulty)}>{idea.difficulty}</Badge>}
        </Metric>
        <Metric label={`Sites ≤ DR${ISKILLS_BEATABLE_AUTHORITY_MAX}`}>
          {low === null ? "—" : <Badge tone={hasLowAuthorityGap(idea) ? "good" : low > 0 ? "warn" : "bad"}>{low}/10</Badge>}
        </Metric>
      </dl>
      <div className="mt-3 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
        <code className="truncate rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{idea.seedKeyword}</code>
        <Button size="sm" variant="secondary" onClick={() => onCheck(idea.seedKeyword, idea.countryCode)}>
          <Search className="h-4 w-4" aria-hidden="true" /> Check niche
        </Button>
      </div>
    </li>
  );
}

function Metric({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1 py-1.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}

function countryLabel(countryCode: string) {
  const market = marketFor(countryCode);
  return market ? market.name : countryCode;
}

function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`rounded-full border px-3 py-1 text-xs font-medium transition ${
        active ? "border-indigo-600 bg-indigo-600 text-on-accent" : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
      }`}
    >
      {children}
    </button>
  );
}

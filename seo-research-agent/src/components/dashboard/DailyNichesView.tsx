"use client";

import { Lightbulb, Loader2 } from "lucide-react";
import { useState } from "react";

import {
  DEFAULT_IDEA_FILTERS,
  filterAndSortIdeas,
  ISKILLS_BEATABLE_AUTHORITY_MAX,
  LOW_AUTHORITY_SITES_TARGET,
  type IdeaFilters,
  type IdeaSort,
} from "@/features/research/daily-ideas";
import { NICHE_TYPE_PROFILES, NICHE_TYPES } from "@/features/research/niche-types";
import type { NicheIdeaDto, NicheIdeasResponse } from "@/features/research/types";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";
import { usePolling } from "@/hooks/usePolling";
import { apiRequest, errorMessage } from "@/lib/api-client";

import { countryLabel, FilterChip, IdeaCard, type CheckNiche, type Reaction } from "./DailyNicheParts";

const dateFormat = new Intl.DateTimeFormat("en-US", { weekday: "long", month: "long", day: "numeric", timeZone: "UTC" });

const SORTS: { value: IdeaSort; label: string }[] = [
  { value: "opportunity", label: "Best opportunity" },
  { value: "volume", label: "Highest volume" },
  { value: "difficulty", label: "Lowest difficulty" },
];

const selectClass = "rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700";

/** Fresh, pre-checked niche ideas each morning, past days and favorites; one click checks a niche in its own country. */
export function DailyNichesView({ onCheck }: { onCheck: CheckNiche }) {
  const [filters, setFilters] = useState<IdeaFilters>(DEFAULT_IDEA_FILTERS);
  const [source, setSource] = useState<"day" | "favorites">("day");
  // Null shows the latest day (today once generated).
  const [date, setDate] = useState<string | null>(null);
  const [showDismissed, setShowDismissed] = useState(false);
  // Reactions changed in this visit, applied over the loaded ideas.
  const [reactions, setReactions] = useState<ReadonlyMap<string, Reaction>>(new Map());
  const [reactionError, setReactionError] = useState<string | null>(null);

  const url = source === "favorites" ? "/api/niche-ideas?view=favorites" : date ? `/api/niche-ideas?date=${date}` : "/api/niche-ideas";
  const { data, error } = usePolling(url, (signal) => apiRequest<NicheIdeasResponse>(url, { signal }), () => null);

  const ideas = (data?.ideas ?? []).map((idea) => (reactions.has(idea.id) ? { ...idea, reaction: reactions.get(idea.id)! } : idea));
  const dismissedCount = ideas.filter((idea) => idea.reaction === "dismissed").length;
  const shown = ideas.filter((idea) =>
    source === "favorites" ? idea.reaction === "favorite" : showDismissed || idea.reaction !== "dismissed");
  const visible = filterAndSortIdeas(shown, filters);
  const types = NICHE_TYPES.filter((type) => shown.some((idea) => idea.nicheType === type));
  const countries = [...new Set(shown.map((idea) => idea.countryCode))].sort();
  const update = (change: Partial<IdeaFilters>) => setFilters((current) => ({ ...current, ...change }));

  async function react(idea: NicheIdeaDto, reaction: Reaction) {
    const previous = idea.reaction;
    setReactions((current) => new Map(current).set(idea.id, reaction));
    setReactionError(null);
    try {
      await apiRequest(`/api/niche-ideas/${encodeURIComponent(idea.id)}/reaction`, { method: "PUT", body: JSON.stringify({ status: reaction }) });
    } catch (failure) {
      setReactions((current) => new Map(current).set(idea.id, previous));
      setReactionError(errorMessage(failure));
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="flex items-center gap-2 text-xl font-semibold text-slate-950">
          <Lightbulb className="h-5 w-5 text-amber-500" aria-hidden="true" />
          Daily niches
        </h1>
        <p className="mt-1 text-sm text-slate-600">
          {source === "favorites" ? "Your favorite ideas from every day. " : data?.date ? `Ideas for ${dateFormat.format(new Date(`${data.date}T00:00:00Z`))}. ` : ""}
          Each idea is pre-checked in its country: monthly searches, difficulty and how many page-1 sites have DR {ISKILLS_BEATABLE_AUTHORITY_MAX} or less.
          Risky topics (gambling, adult, piracy, YMYL) are never suggested.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div role="group" aria-label="Show" className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
          {(["day", "favorites"] as const).map((option) => (
            <button
              key={option}
              type="button"
              aria-pressed={source === option}
              onClick={() => setSource(option)}
              className={`rounded-md px-3 py-1 text-xs font-medium ${source === option ? "bg-indigo-600 text-on-accent" : "text-slate-600 hover:bg-slate-50"}`}
            >
              {option === "day" ? "Daily ideas" : "Favorites"}
            </button>
          ))}
        </div>
        {source === "day" && (data?.dates.length ?? 0) > 1 ? (
          <>
            <label className="sr-only" htmlFor="idea-date">Day</label>
            <select id="idea-date" value={date ?? data?.date ?? ""} onChange={(event) => setDate(event.target.value)} className={selectClass}>
              {data!.dates.map((day) => <option key={day} value={day}>{dateFormat.format(new Date(`${day}T00:00:00Z`))}</option>)}
            </select>
          </>
        ) : null}
        {source === "day" && dismissedCount > 0 ? (
          <FilterChip active={showDismissed} onClick={() => setShowDismissed((current) => !current)}>Show dismissed ({dismissedCount})</FilterChip>
        ) : null}
      </div>

      {shown.length > 0 ? (
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
              <FilterChip active={filters.nicheType === "all"} onClick={() => update({ nicheType: "all" })}>All types ({shown.length})</FilterChip>
              {types.map((type) => (
                <FilterChip key={type} active={filters.nicheType === type} onClick={() => update({ nicheType: type })}>
                  {NICHE_TYPE_PROFILES[type].label} ({shown.filter((idea) => idea.nicheType === type).length})
                </FilterChip>
              ))}
            </div>
          ) : null}
        </div>
      ) : null}

      {reactionError ? <ErrorState>{reactionError}</ErrorState> : null}
      {error && !data ? <ErrorState>{error}</ErrorState> : null}
      {!data && !error ? (
        <p className="flex items-center gap-2 text-sm text-slate-600" role="status">
          <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" /> Loading ideas…
        </p>
      ) : null}
      {data && shown.length === 0 ? (
        <EmptyState>
          {source === "favorites"
            ? "No favorites yet. Star an idea to keep it here."
            : ideas.length > 0 ? "You dismissed every idea for this day." : "New ideas appear every morning. Check back tomorrow."}
        </EmptyState>
      ) : null}
      {shown.length > 0 && visible.length === 0 ? (
        <EmptyState action={<Button variant="secondary" size="sm" onClick={() => setFilters(DEFAULT_IDEA_FILTERS)}>Clear filters</Button>}>
          No ideas match these filters.
        </EmptyState>
      ) : null}

      <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {visible.map((idea) => (
          <IdeaCard key={idea.id} idea={idea} onCheck={onCheck} onReact={(item, reaction) => void react(item, reaction)} showDate={source === "favorites"} />
        ))}
      </ul>
    </div>
  );
}

"use client";

import { Eye, EyeOff, Search, Star } from "lucide-react";
import type { ReactNode } from "react";

import { hasLowAuthorityGap, ISKILLS_BEATABLE_AUTHORITY_MAX } from "@/features/research/daily-ideas";
import { marketFor } from "@/features/research/markets";
import { NICHE_TYPE_PROFILES } from "@/features/research/niche-types";
import type { NicheIdeaDto } from "@/features/research/types";
import { Badge, difficultyTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { formatNumber } from "@/lib/format";

export type Reaction = NicheIdeaDto["reaction"];
export type CheckNiche = (seed: string, countryCode: string) => void;

const shortDate = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", timeZone: "UTC" });

export function IdeaCard({ idea, onCheck, onReact, showDate }: {
  idea: NicheIdeaDto;
  onCheck: CheckNiche;
  onReact: (idea: NicheIdeaDto, reaction: Reaction) => void;
  /** Favorites mix days, so each card shows its own. */
  showDate: boolean;
}) {
  const low = idea.lowAuthorityCount;
  const favorite = idea.reaction === "favorite";
  const dismissed = idea.reaction === "dismissed";
  return (
    <li className={`flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm ${dismissed ? "opacity-60" : ""}`}>
      <div className="flex items-start justify-between gap-2">
        <p className="font-semibold text-slate-900">{idea.niche}</p>
        <Badge tone="accent">{NICHE_TYPE_PROFILES[idea.nicheType].label}</Badge>
      </div>
      <p className="mt-1 text-sm text-slate-600">{idea.problem}</p>
      <p className="mt-2 text-xs text-slate-500">
        For {idea.audience} · {countryLabel(idea.countryCode)}
        {showDate ? ` · ${shortDate.format(new Date(`${idea.ideaDate}T00:00:00Z`))}` : ""}
      </p>
      <dl className="mt-3 grid grid-cols-3 gap-2 text-center">
        <Metric label="Volume">{formatNumber(idea.searchVolume)}</Metric>
        <Metric label="KD">
          {idea.difficulty === null ? "—" : <Badge tone={difficultyTone(idea.difficulty)}>{idea.difficulty}</Badge>}
        </Metric>
        <Metric label={`Sites ≤ DR${ISKILLS_BEATABLE_AUTHORITY_MAX}`}>
          {low === null ? "—" : <Badge tone={hasLowAuthorityGap(idea) ? "good" : low > 0 ? "warn" : "bad"}>{low}/10</Badge>}
        </Metric>
      </dl>
      <div className="mt-3 flex items-center gap-1 border-t border-slate-100 pt-3">
        <code className="min-w-0 flex-1 truncate rounded bg-slate-50 px-2 py-0.5 text-xs text-slate-700">{idea.seedKeyword}</code>
        <IconButton
          label={favorite ? `Remove “${idea.niche}” from favorites` : `Add “${idea.niche}” to favorites`}
          pressed={favorite}
          onClick={() => onReact(idea, favorite ? null : "favorite")}
        >
          <Star className={`h-4 w-4 ${favorite ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" />
        </IconButton>
        <IconButton
          label={dismissed ? `Restore “${idea.niche}”` : `Dismiss “${idea.niche}”`}
          pressed={dismissed}
          onClick={() => onReact(idea, dismissed ? null : "dismissed")}
        >
          {dismissed ? <Eye className="h-4 w-4" aria-hidden="true" /> : <EyeOff className="h-4 w-4" aria-hidden="true" />}
        </IconButton>
        <Button size="sm" variant="secondary" onClick={() => onCheck(idea.seedKeyword, idea.countryCode)}>
          <Search className="h-4 w-4" aria-hidden="true" /> Check niche
        </Button>
      </div>
    </li>
  );
}

function IconButton({ label, pressed, onClick, children }: { label: string; pressed: boolean; onClick: () => void; children: ReactNode }) {
  return (
    <button type="button" aria-label={label} title={label} aria-pressed={pressed} onClick={onClick} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100 hover:text-slate-700">
      {children}
    </button>
  );
}

function Metric({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="rounded-lg bg-slate-50 px-1 py-1.5">
      <dt className="text-[10px] font-medium uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="mt-0.5 text-sm font-semibold tabular-nums text-slate-900">{children}</dd>
    </div>
  );
}

export function countryLabel(countryCode: string) {
  const market = marketFor(countryCode);
  return market ? market.name : countryCode;
}

export function FilterChip({ active, onClick, children }: { active: boolean; onClick: () => void; children: ReactNode }) {
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

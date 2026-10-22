"use client";

import { Check, Copy, Download, Star } from "lucide-react";
import { useState } from "react";

import { TIER_LABELS, type Opportunity, type OpportunityTier } from "@/features/research/opportunity";
import type { KeywordDto } from "@/features/research/types";
import { Badge, type BadgeTone } from "@/components/ui/Badge";
import { Button } from "@/components/ui/Button";
import { pick } from "@/lib/url-state";

export type KeywordFilters = {
  text: string;
  maxDifficulty: string;
  intent: string;
  tier: OpportunityTier | "";
  favoritesOnly: boolean;
};

export const EMPTY_FILTERS: KeywordFilters = { text: "", maxDifficulty: "", intent: "", tier: "", favoritesOnly: false };

export type Sort = { key: "searchVolume" | "difficulty" | "cpcMicros" | "opportunity"; direction: "asc" | "desc" } | null;

const SORT_KEYS = ["searchVolume", "difficulty", "cpcMicros", "opportunity"] as const;
const DIFFICULTY_LIMITS = ["", "20", "30", "50"] as const;
const MAX_TEXT = 100;

export function filtersFromUrl(read: (name: string) => string | null): KeywordFilters {
  return {
    text: (read("q") ?? "").slice(0, MAX_TEXT),
    intent: pick(read("intent"), ["", ...INTENTS], ""),
    maxDifficulty: pick(read("kd"), DIFFICULTY_LIMITS, ""),
    tier: pick(read("tier"), ["", ...(Object.keys(TIER_LABELS) as OpportunityTier[])], ""),
    favoritesOnly: read("fav") === "1",
  };
}

export function filtersToUrl(filters: KeywordFilters) {
  return { q: filters.text.trim() || null, intent: filters.intent || null, kd: filters.maxDifficulty || null, tier: filters.tier || null, fav: filters.favoritesOnly ? "1" : null };
}

/** "volume-desc" style values; "none" means the user cleared sorting. Undefined keeps the default. */
export function sortFromUrl(value: string | null): Sort | undefined {
  if (value === "none") return null;
  const [key, direction] = (value ?? "").split("-");
  return (SORT_KEYS as readonly string[]).includes(key ?? "") && (direction === "asc" || direction === "desc")
    ? { key: key as (typeof SORT_KEYS)[number], direction }
    : undefined;
}

export function sortToUrl(sort: Sort | undefined) {
  return sort === undefined ? null : sort === null ? "none" : `${sort.key}-${sort.direction}`;
}

const TIER_TONES: Record<OpportunityTier, BadgeTone> = { prime: "good", solid: "accent", tough: "warn", fortress: "neutral" };
const TIER_BARS: Record<OpportunityTier, string> = {
  prime: "[&::-webkit-progress-value]:bg-emerald-500 [&::-moz-progress-bar]:bg-emerald-500",
  solid: "[&::-webkit-progress-value]:bg-indigo-500 [&::-moz-progress-bar]:bg-indigo-500",
  tough: "[&::-webkit-progress-value]:bg-amber-500 [&::-moz-progress-bar]:bg-amber-500",
  fortress: "[&::-webkit-progress-value]:bg-slate-400 [&::-moz-progress-bar]:bg-slate-400",
};
const INTENTS = ["informational", "commercial", "transactional", "navigational"] as const;
const selectClass = "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-700";

export function FilterBar({ filters, onChange, showTier, showFavorites }: {
  filters: KeywordFilters;
  onChange: (change: Partial<KeywordFilters>) => void;
  showTier: boolean;
  showFavorites: boolean;
}) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <label htmlFor="keyword-filter" className="sr-only">Filter keywords</label>
      <input
        id="keyword-filter"
        type="search"
        value={filters.text}
        onChange={(event) => onChange({ text: event.target.value })}
        placeholder="Filter keywords"
        className="min-w-0 flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm sm:max-w-64"
      />
      <label htmlFor="keyword-intent" className="sr-only">Intent</label>
      <select id="keyword-intent" value={filters.intent} onChange={(event) => onChange({ intent: event.target.value })} className={selectClass}>
        <option value="">All intents</option>
        {INTENTS.map((intent) => <option key={intent} value={intent}>{intent[0]!.toUpperCase() + intent.slice(1)}</option>)}
      </select>
      <label htmlFor="max-difficulty" className="sr-only">Maximum difficulty</label>
      <select id="max-difficulty" value={filters.maxDifficulty} onChange={(event) => onChange({ maxDifficulty: event.target.value })} className={selectClass}>
        <option value="">Any difficulty</option>
        <option value="20">KD ≤ 20</option>
        <option value="30">KD ≤ 30</option>
        <option value="50">KD ≤ 50</option>
      </select>
      {showTier ? (
        <>
          <label htmlFor="keyword-tier" className="sr-only">Opportunity</label>
          <select id="keyword-tier" value={filters.tier} onChange={(event) => onChange({ tier: event.target.value as OpportunityTier | "" })} className={selectClass}>
            <option value="">All opportunities</option>
            {(Object.keys(TIER_LABELS) as OpportunityTier[]).map((tier) => <option key={tier} value={tier}>{TIER_LABELS[tier]}</option>)}
          </select>
        </>
      ) : null}
      {showFavorites ? (
        <button
          type="button"
          aria-pressed={filters.favoritesOnly}
          onClick={() => onChange({ favoritesOnly: !filters.favoritesOnly })}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-3 py-2 text-sm ${
            filters.favoritesOnly ? "border-amber-300 bg-amber-50 text-amber-800" : "border-slate-300 bg-white text-slate-700"
          }`}
        >
          <Star className={`h-4 w-4 ${filters.favoritesOnly ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" />
          Favorites
        </button>
      ) : null}
    </div>
  );
}

/** Copy and download exactly the rows currently shown. */
export function ExportActions({ count, onCopy, onCsv, onJson }: { count: number; onCopy: () => Promise<void>; onCsv: () => void; onJson: () => void }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    await onCopy();
    setCopied(true);
    setTimeout(() => setCopied(false), 2_000);
  }
  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-slate-500">{count} shown</span>
      <Button variant="secondary" size="sm" onClick={() => void copy()} disabled={count === 0}>
        {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
        {copied ? "Copied" : "Copy"}
      </Button>
      <Button variant="secondary" size="sm" onClick={onCsv} disabled={count === 0}>
        <Download className="h-4 w-4" aria-hidden="true" /> CSV
      </Button>
      <Button variant="secondary" size="sm" onClick={onJson} disabled={count === 0}>
        <Download className="h-4 w-4" aria-hidden="true" /> JSON
      </Button>
    </div>
  );
}

export function OpportunityCell({ value }: { value: Opportunity | undefined }) {
  if (!value) return <span className="text-slate-400">—</span>;
  return (
    <div className="flex items-center justify-end gap-2">
      <progress
        value={value.score}
        max={100}
        aria-hidden="true"
        className={`hidden h-1.5 w-14 overflow-hidden rounded-full sm:block [&::-webkit-progress-bar]:bg-slate-100 ${TIER_BARS[value.tier]}`}
      />
      <span className="w-6 text-right font-semibold tabular-nums text-slate-900">{value.score}</span>
      <Badge tone={TIER_TONES[value.tier]}>{TIER_LABELS[value.tier]}</Badge>
    </div>
  );
}

export function FavoriteButton({ keyword, active, onToggle }: { keyword: KeywordDto; active: boolean; onToggle: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={active}
      aria-label={active ? `Remove “${keyword.keyword}” from favorites` : `Add “${keyword.keyword}” to favorites`}
      onClick={(event) => {
        event.stopPropagation();
        onToggle();
      }}
      className="rounded p-1 text-slate-300 hover:text-amber-500"
    >
      <Star className={`h-4 w-4 ${active ? "fill-amber-400 text-amber-500" : ""}`} aria-hidden="true" />
    </button>
  );
}

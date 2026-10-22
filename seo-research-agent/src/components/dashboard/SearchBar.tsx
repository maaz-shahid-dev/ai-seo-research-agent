"use client";

import { Loader2, Search } from "lucide-react";
import type { FormEvent } from "react";

import { Button } from "@/components/ui/Button";
import { MARKETS } from "@/features/research/markets";

const EXAMPLES = ["bearded dragon tank setup", "sourdough starter problems", "betta fish tank setup"];

type SearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  /** Market to research in (ISO country code). */
  country: string;
  onCountryChange: (countryCode: string) => void;
  onSubmit: (query?: string) => void;
  pending: boolean;
  error: string | null;
  /** Show example topics (first visit, nothing searched yet). */
  showExamples: boolean;
};

/** The main entry point: one topic in, a full niche analysis out. */
export function SearchBar({ query, onQueryChange, country, onCountryChange, onSubmit, pending, error, showExamples }: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
      <h1 className="text-lg font-semibold text-slate-950 sm:text-xl">Find a niche you can rank for</h1>
      <p className="mt-1 text-sm text-slate-500">
        Enter a specific topic. We collect keywords, check Google’s page 1 and score the niche for you.
      </p>
      <form onSubmit={handleSubmit} className="mt-4 flex flex-col gap-2 sm:flex-row">
        <div className="relative min-w-0 flex-1">
          <label htmlFor="topic" className="sr-only">Topic or keyword</label>
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden="true" />
          <input
            id="topic"
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            required
            minLength={2}
            maxLength={200}
            placeholder="e.g. bearded dragon tank setup"
            autoComplete="off"
            className="w-full rounded-xl border border-slate-300 bg-white py-3 pl-10 pr-3 text-slate-950 placeholder:text-slate-400"
          />
        </div>
        <div className="relative">
          <label htmlFor="country" className="sr-only">Country</label>
          <select
            id="country"
            value={country}
            onChange={(event) => onCountryChange(event.target.value)}
            className="w-full rounded-xl border border-slate-300 bg-white px-3 py-3 text-sm text-slate-700 sm:w-auto"
          >
            {MARKETS.map((market) => (
              <option key={market.countryCode} value={market.countryCode}>{market.flag} {market.name}</option>
            ))}
          </select>
        </div>
        <Button type="submit" disabled={pending} className="rounded-xl px-6 py-3">
          {pending ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
          Search
        </Button>
      </form>
      {error ? <p className="mt-3 text-sm text-rose-700" role="alert">{error}</p> : null}
      {showExamples ? (
        <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-slate-500">
          <span>Try:</span>
          {EXAMPLES.map((example) => (
            <button
              key={example}
              type="button"
              onClick={() => onSubmit(example)}
              className="rounded-full border border-slate-200 px-3 py-1 text-slate-600 transition hover:border-indigo-300 hover:text-indigo-700"
            >
              {example}
            </button>
          ))}
        </div>
      ) : null}
    </section>
  );
}

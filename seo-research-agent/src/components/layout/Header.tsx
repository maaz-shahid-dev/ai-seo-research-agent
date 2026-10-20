'use client';

import React, { useState } from 'react';
import {
  Search,
  Globe2,
  Languages,
  HelpCircle,
  Menu,
  Play,
  RefreshCw,
} from 'lucide-react';
import { CountryOption, LanguageOption, DemoStateMode } from '@/types/seo';

interface HeaderProps {
  seedKeyword: string;
  onSeedKeywordChange: (val: string) => void;
  selectedCountry: string;
  onCountryChange: (val: string) => void;
  countries: CountryOption[];
  selectedLanguage: string;
  onLanguageChange: (val: string) => void;
  languages: LanguageOption[];
  demoState: DemoStateMode;
  onDemoStateChange: (mode: DemoStateMode) => void;
  onRunResearch: () => void;
  isRunning: boolean;
  onOpenMobileMenu: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  seedKeyword,
  onSeedKeywordChange,
  selectedCountry,
  onCountryChange,
  countries,
  selectedLanguage,
  onLanguageChange,
  languages,
  demoState,
  onDemoStateChange,
  onRunResearch,
  isRunning,
  onOpenMobileMenu,
}) => {
  const [showMarketTip, setShowMarketTip] = useState(false);

  const quickSeeds = [
    'best ai tools for productivity',
    'cloud cost optimization tools',
    'smart thermostats energy saving',
    'local dental clinic sydney',
  ];

  return (
    <header className="sticky top-0 z-30 flex max-w-full min-w-0 flex-col border-b border-slate-200 bg-white/95 shadow-xs backdrop-blur-sm">
      {/* Top Banner: Explicit Demo Notice & State Switcher */}
      <div className="flex min-w-0 flex-col gap-2 border-b border-amber-200/60 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 sm:flex-row sm:items-center sm:justify-between sm:px-4 sm:py-1.5">
        <div className="flex min-w-0 items-start gap-2 sm:items-center">
          <span
            className="mt-1 flex h-2 w-2 shrink-0 rounded-full bg-amber-500 motion-safe:animate-pulse sm:mt-0"
            aria-hidden="true"
          />
          <div className="min-w-0 leading-relaxed sm:flex sm:items-center sm:gap-2">
            <span className="block text-[11px] font-semibold uppercase tracking-wide">
              Milestone 1 Demo Mode:
            </span>
            <span className="hidden text-amber-800 sm:inline">
              All keywords, SERP positions, and metrics below are static demo evidence. Live SEO/AI APIs are disconnected.
            </span>
            <span className="block text-amber-800 sm:hidden">Demo evidence active (no live APIs).</span>
          </div>
        </div>

        <div className="flex w-full min-w-0 items-center gap-2 sm:w-auto sm:shrink-0">
          <label htmlFor="state-switcher" className="hidden text-[11px] font-medium text-amber-900 md:inline">
            Test UI State:
          </label>
          <select
            id="state-switcher"
            value={demoState}
            onChange={(event) => onDemoStateChange(event.target.value as DemoStateMode)}
            aria-label="Demo interface state"
            className="min-h-9 w-full min-w-0 max-w-full rounded border border-amber-300 bg-white px-2 py-1 text-[11px] font-medium text-amber-950 focus:outline-none focus:ring-2 focus:ring-amber-500 sm:w-auto"
          >
            <option value="normal">State: Normal Demo Data</option>
            <option value="loading">State: Loading Spinner</option>
            <option value="empty">State: Empty Results</option>
            <option value="error">State: Provider Error (504)</option>
            <option value="rate_limit">State: Rate Limit Warning (429)</option>
          </select>
        </div>
      </div>

      {/* Main Bar */}
      <div className="flex min-w-0 flex-col items-stretch gap-3 px-3 py-3 sm:px-4 xl:flex-row xl:items-center xl:justify-between xl:px-6">
        {/* Left: Mobile hamburger & Seed Search */}
        <div className="flex w-full min-w-0 items-center gap-2 sm:gap-3 xl:flex-1">
          <button
            type="button"
            onClick={onOpenMobileMenu}
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg border border-slate-200 text-slate-600 transition hover:bg-slate-50 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 lg:hidden"
            aria-label="Open navigation menu"
            aria-controls="primary-sidebar"
          >
            <Menu className="h-5 w-5" aria-hidden="true" />
          </button>

          {/* Seed Keyword Input */}
          <div className="relative min-w-0 flex-1 xl:max-w-lg">
            <Search
              className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"
              aria-hidden="true"
            />
            <label htmlFor="seed-keyword" className="sr-only">
              Seed keyword
            </label>
            <input
              id="seed-keyword"
              type="text"
              value={seedKeyword}
              onChange={(event) => onSeedKeywordChange(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === 'Enter' && !isRunning) onRunResearch();
              }}
              placeholder="Enter seed keyword (e.g., ai tools, cloud finops)..."
              className="min-h-11 w-full min-w-0 rounded-lg border border-slate-200 bg-slate-50/70 py-2 pl-9 pr-3 text-xs font-medium text-slate-800 transition placeholder:text-slate-400 hover:bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Right: Target Market Selectors (Country & Language) & Run Button */}
        <div className="grid w-full min-w-0 grid-cols-[minmax(0,1fr)_minmax(0,1fr)_2.75rem] items-center gap-2 sm:flex sm:flex-wrap sm:gap-2.5 xl:w-auto xl:shrink-0 xl:justify-end">
          {/* Country Selector */}
          <div className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs sm:min-w-40">
            <Globe2 className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <label htmlFor="country-select" className="sr-only">
              Target Country
            </label>
            <select
              id="country-select"
              value={selectedCountry}
              onChange={(event) => onCountryChange(event.target.value)}
              className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {countries.map((country) => (
                <option key={country.code} value={country.code}>
                  {country.flag} {country.name} ({country.code})
                </option>
              ))}
            </select>
          </div>

          {/* Language Selector */}
          <div className="flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs sm:min-w-32">
            <Languages className="h-4 w-4 shrink-0 text-slate-400" aria-hidden="true" />
            <label htmlFor="language-select" className="sr-only">
              Target Language
            </label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(event) => onLanguageChange(event.target.value)}
              className="w-full min-w-0 bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {languages.map((language) => (
                <option key={language.code} value={language.code}>
                  {language.name}
                </option>
              ))}
            </select>
          </div>

          {/* Market Targeting Tooltip / Info (PRD FR-03 Requirement) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMarketTip((isVisible) => !isVisible)}
              className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2"
              title="Learn about Country vs Language targeting"
              aria-label="Country and language targeting info"
              aria-expanded={showMarketTip}
              aria-controls="market-targeting-tip"
            >
              <HelpCircle className="h-4 w-4" aria-hidden="true" />
            </button>

            {showMarketTip && (
              <div
                id="market-targeting-tip"
                role="dialog"
                aria-labelledby="market-targeting-title"
                className="absolute right-0 top-12 z-50 w-[min(20rem,calc(100vw-1.5rem))] rounded-xl border border-slate-200 bg-white p-4 shadow-xl"
              >
                <div className="flex items-start justify-between gap-3">
                  <h4 id="market-targeting-title" className="text-xs font-bold text-slate-900">
                    Country vs Language Targeting
                  </h4>
                  <button
                    type="button"
                    onClick={() => setShowMarketTip(false)}
                    className="-mr-2 -mt-2 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-sm font-semibold text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 focus-visible:ring-2 focus-visible:ring-indigo-500"
                    aria-label="Close targeting information"
                  >
                    &times;
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Per PRD FR-03, <strong>country</strong> determines the geographical Google index and search volume
                  pool, while <strong>language</strong> specifies the idiom used in search queries.
                </p>
                <div className="mt-2.5 rounded bg-indigo-50 p-2 text-[11px] text-indigo-900">
                  <strong>Example:</strong> Researching <em>Canada (CA)</em> with <em>French (fr)</em> yields different
                  search volume than <em>France (FR)</em> with French.
                </div>
              </div>
            )}
          </div>

          {/* Run Research Button (Simulates retrieval) */}
          <button
            type="button"
            onClick={onRunResearch}
            disabled={isRunning}
            className="col-span-3 flex min-h-11 w-full items-center justify-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 focus-visible:ring-2 focus-visible:ring-indigo-500 focus-visible:ring-offset-2 active:scale-95 disabled:cursor-not-allowed disabled:opacity-60 sm:w-auto"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 motion-safe:animate-spin" aria-hidden="true" />
                <span>Fetching Demo...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" aria-hidden="true" />
                <span>Simulate Research</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Seed Suggestion Chips Bar */}
      <div
        className="flex max-w-full min-w-0 flex-wrap items-center gap-2 border-t border-slate-100 bg-slate-50 px-3 py-2 text-[11px] sm:flex-nowrap sm:overflow-x-auto sm:px-4 sm:py-1.5"
        aria-label="Quick seed keyword ideas"
      >
        <span className="shrink-0 font-medium text-slate-400">Quick Seed Niche Ideas:</span>
        {quickSeeds.map((seed) => (
          <button
            key={seed}
            type="button"
            onClick={() => onSeedKeywordChange(seed)}
            aria-pressed={seedKeyword === seed}
            className="min-h-8 shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] text-slate-600 transition hover:border-indigo-300 hover:text-indigo-600 focus-visible:ring-2 focus-visible:ring-indigo-500 aria-pressed:border-indigo-300 aria-pressed:bg-indigo-50 aria-pressed:text-indigo-700"
          >
            {seed}
          </button>
        ))}
      </div>
    </header>
  );
};

'use client';

import React, { useState } from 'react';
import { 
  Search, 
  Globe2, 
  Languages, 
  HelpCircle, 
  Menu, 
  Play, 
  RefreshCw
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
    'local dental clinic sydney'
  ];

  return (
    <header className="sticky top-0 z-30 flex flex-col border-b border-slate-200 bg-white/95 backdrop-blur-sm shadow-xs">
      {/* Top Banner: Explicit Demo Notice & State Switcher */}
      <div className="flex items-center justify-between bg-amber-500/10 px-4 py-1.5 text-xs text-amber-900 border-b border-amber-200/60">
        <div className="flex items-center gap-2">
          <span className="flex h-2 w-2 rounded-full bg-amber-500 animate-pulse" />
          <span className="font-semibold tracking-wide uppercase text-[11px]">Milestone 1 Demo Mode:</span>
          <span className="hidden sm:inline text-amber-800">
            All keywords, SERP positions, and metrics below are static demo evidence. Live SEO/AI APIs are disconnected.
          </span>
          <span className="sm:hidden text-amber-800">Demo evidence active (no live APIs).</span>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="state-switcher" className="text-[11px] font-medium text-amber-900 hidden md:inline">
            Test UI State:
          </label>
          <select
            id="state-switcher"
            value={demoState}
            onChange={(e) => onDemoStateChange(e.target.value as DemoStateMode)}
            className="rounded border border-amber-300 bg-white px-2 py-0.5 text-[11px] font-medium text-amber-950 focus:outline-none focus:ring-1 focus:ring-amber-500"
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
      <div className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 lg:px-6">
        {/* Left: Mobile hamburger & Seed Search */}
        <div className="flex flex-1 items-center gap-3 min-w-[280px]">
          <button
            onClick={onOpenMobileMenu}
            className="rounded-lg border border-slate-200 p-2 text-slate-600 hover:bg-slate-50 lg:hidden"
            aria-label="Toggle navigation menu"
          >
            <Menu className="h-5 w-5" />
          </button>

          {/* Seed Keyword Input */}
          <div className="relative flex-1 max-w-lg">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={seedKeyword}
              onChange={(e) => onSeedKeywordChange(e.target.value)}
              placeholder="Enter seed keyword (e.g., ai tools, cloud finops)..."
              className="w-full rounded-lg border border-slate-200 bg-slate-50/70 pl-9 pr-3 py-2 text-xs font-medium text-slate-800 placeholder-slate-400 transition hover:bg-slate-50 focus:border-indigo-500 focus:bg-white focus:outline-none focus:ring-2 focus:ring-indigo-100"
            />
          </div>
        </div>

        {/* Right: Target Market Selectors (Country & Language) & Run Button */}
        <div className="flex flex-wrap items-center gap-2.5">
          {/* Country Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs">
            <Globe2 className="h-4 w-4 text-slate-400" />
            <label htmlFor="country-select" className="sr-only">Target Country</label>
            <select
              id="country-select"
              value={selectedCountry}
              onChange={(e) => onCountryChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {countries.map((c) => (
                <option key={c.code} value={c.code}>
                  {c.flag} {c.name} ({c.code})
                </option>
              ))}
            </select>
          </div>

          {/* Language Selector */}
          <div className="flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 shadow-2xs">
            <Languages className="h-4 w-4 text-slate-400" />
            <label htmlFor="language-select" className="sr-only">Target Language</label>
            <select
              id="language-select"
              value={selectedLanguage}
              onChange={(e) => onLanguageChange(e.target.value)}
              className="bg-transparent text-xs font-semibold text-slate-800 focus:outline-none"
            >
              {languages.map((l) => (
                <option key={l.code} value={l.code}>
                  {l.name}
                </option>
              ))}
            </select>
          </div>

          {/* Market Targeting Tooltip / Info (PRD FR-03 Requirement) */}
          <div className="relative">
            <button
              type="button"
              onClick={() => setShowMarketTip(!showMarketTip)}
              className="rounded-lg p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
              title="Learn about Country vs Language targeting"
              aria-label="Country and language targeting info"
            >
              <HelpCircle className="h-4 w-4" />
            </button>

            {showMarketTip && (
              <div className="absolute right-0 top-10 z-50 w-80 rounded-xl border border-slate-200 bg-white p-4 shadow-xl">
                <div className="flex items-start justify-between">
                  <h4 className="text-xs font-bold text-slate-900">Country vs Language Targeting</h4>
                  <button
                    onClick={() => setShowMarketTip(false)}
                    className="text-slate-400 hover:text-slate-600 text-xs font-semibold"
                  >
                    ✕
                  </button>
                </div>
                <p className="mt-2 text-xs leading-relaxed text-slate-600">
                  Per PRD FR-03, <strong>country</strong> determines the geographical Google index and search volume pool, while <strong>language</strong> specifies the idiom used in search queries.
                </p>
                <div className="mt-2.5 rounded bg-indigo-50 p-2 text-[11px] text-indigo-900">
                  💡 For example, researching <em>Canada (CA)</em> with <em>French (fr)</em> yields different search volume than <em>France (FR)</em> with French.
                </div>
              </div>
            )}
          </div>

          {/* Run Research Button (Simulates retrieval) */}
          <button
            onClick={onRunResearch}
            disabled={isRunning}
            className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-2 text-xs font-semibold text-white shadow-sm shadow-indigo-200 transition hover:bg-indigo-700 active:scale-95 disabled:opacity-60"
          >
            {isRunning ? (
              <>
                <RefreshCw className="h-3.5 w-3.5 animate-spin" />
                <span>Fetching Demo...</span>
              </>
            ) : (
              <>
                <Play className="h-3.5 w-3.5 fill-current" />
                <span>Simulate Research</span>
              </>
            )}
          </button>
        </div>
      </div>

      {/* Quick Seed Suggestion Chips Bar */}
      <div className="flex items-center gap-2 px-4 py-1.5 bg-slate-50 border-t border-slate-100 text-[11px] overflow-x-auto">
        <span className="text-slate-400 shrink-0 font-medium">Quick Seed Niche Ideas:</span>
        {quickSeeds.map((seed, i) => (
          <button
            key={i}
            onClick={() => onSeedKeywordChange(seed)}
            className="shrink-0 rounded-full border border-slate-200 bg-white px-2.5 py-0.5 text-[11px] text-slate-600 hover:border-indigo-300 hover:text-indigo-600 transition"
          >
            {seed}
          </button>
        ))}
      </div>
    </header>
  );
};

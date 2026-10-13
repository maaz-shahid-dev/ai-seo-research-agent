'use client';

import React, { useState } from 'react';
import { 
  DEMO_COUNTRIES, 
  DEMO_LANGUAGES, 
  DEMO_PROJECTS, 
  DEMO_KEYWORDS, 
  DEMO_SERP_DATA, 
  DEMO_AI_ANALYSIS,
  DEMO_COUNTRY_COMPARISON 
} from '@/data/demo-data';
import { 
  ViewTab, 
  DemoStateMode, 
  KeywordResult, 
  Project, 
  SERPResult,
  UserRole 
} from '@/types/seo';
import { Sidebar } from '@/components/layout/Sidebar';
import { Header } from '@/components/layout/Header';
import { OverviewCards } from '@/components/dashboard/OverviewCards';
import { KeywordTable } from '@/components/dashboard/KeywordTable';
import { AiEvaluationCard } from '@/components/dashboard/AiEvaluationCard';
import { SerpAnalysisModal } from '@/components/dashboard/SerpAnalysisModal';
import { SerpDeepDiveView } from '@/components/dashboard/SerpDeepDiveView';
import { AiEvidenceStudio } from '@/components/dashboard/AiEvidenceStudio';
import { MarketComparisonView } from '@/components/dashboard/MarketComparisonView';
import { ProjectsView } from '@/components/dashboard/ProjectsView';
import { ReportsView } from '@/components/dashboard/ReportsView';
import { SettingsAdminView } from '@/components/dashboard/SettingsAdminView';
import { AuthModal } from '@/components/dashboard/AuthModal';

export default function Home() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('overview');
  const [seedKeyword, setSeedKeyword] = useState<string>('best ai tools for productivity');
  const [selectedCountry, setSelectedCountry] = useState<string>('US');
  const [selectedLanguage, setSelectedLanguage] = useState<string>('en');
  const [demoState, setDemoState] = useState<DemoStateMode>('normal');
  const [activeProject, setActiveProject] = useState<Project>(DEMO_PROJECTS[0]);
  const [projectsList, setProjectsList] = useState<Project[]>(DEMO_PROJECTS);
  const [keywordsList, setKeywordsList] = useState<KeywordResult[]>(DEMO_KEYWORDS);
  const [selectedSerpKeyword, setSelectedSerpKeyword] = useState<KeywordResult | null>(null);
  const [isRunning, setIsRunning] = useState<boolean>(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState<boolean>(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState<boolean>(false);

  // Simulated Research Run action
  const handleRunResearch = () => {
    setIsRunning(true);
    setDemoState('loading');
    setTimeout(() => {
      setIsRunning(false);
      setDemoState('normal');
      // If user typed custom keyword, update the first item for interactive preview
      if (seedKeyword.trim() && seedKeyword.trim() !== 'best ai tools for productivity') {
        const updatedKw: KeywordResult = {
          id: `kw_custom_${Date.now()}`,
          research_run_id: 'run_custom',
          keyword: seedKeyword.trim().toLowerCase(),
          search_volume: Math.floor(Math.random() * 8000) + 1200,
          keyword_difficulty: Math.floor(Math.random() * 45) + 18,
          cpc: +(Math.random() * 4 + 0.8).toFixed(2),
          intent: 'Commercial',
          cluster: 'Custom Research',
          source: 'Demo Mock Adapter (Provider Offline)',
          retrieved_at: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
          trend: [40, 45, 50, 55, 60, 65, 70, 75, 80, 85, 90, 95],
        };
        setKeywordsList([updatedKw, ...DEMO_KEYWORDS]);
      } else {
        setKeywordsList(DEMO_KEYWORDS);
      }
    }, 1100);
  };

  const handleCreateProjectDemo = (name: string, country: string, language: string) => {
    const newP: Project = {
      id: `proj_demo_${Date.now()}`,
      user_id: 'usr_demo_01',
      name,
      description: `Targeting ${country} (${language}) market for keyword opportunities.`,
      target_country: country,
      target_language: language,
      created_at: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      updated_at: new Date().toISOString().replace('T', ' ').substring(0, 19) + ' UTC',
      keyword_count: 0,
      runs_count: 0,
    };
    setProjectsList([newP, ...projectsList]);
    setActiveProject(newP);
    setSelectedCountry(country);
    setSelectedLanguage(language);
  };

  // SERP Results for the selected keyword
  const currentSerpResults: SERPResult[] = selectedSerpKeyword
    ? (DEMO_SERP_DATA[selectedSerpKeyword.keyword] || [
        {
          id: `serp_fallback_1`,
          research_run_id: 'run_demo_01',
          keyword: selectedSerpKeyword.keyword,
          position: 1,
          title: `Ultimate Guide to ${selectedSerpKeyword.keyword} (2026 Edition)`,
          url: `https://example-domain.com/${selectedSerpKeyword.keyword.replace(/\s+/g, '-')}`,
          domain: 'example-domain.com',
          contentType: 'Listicle',
          authority_metric_name: 'Domain Rating (DR)',
          authority_metric_value: 78,
          estimated_backlinks: 1200,
          estimated_organic_traffic: 18000,
          source: 'Mock SERP Provider (Demo)',
          retrieved_at: '2026-10-13 07:46 UTC',
          snippet: `A comprehensive evaluation and benchmarking of ${selectedSerpKeyword.keyword} with implementation notes and pricing tables.`,
        },
        {
          id: `serp_fallback_2`,
          research_run_id: 'run_demo_01',
          keyword: selectedSerpKeyword.keyword,
          position: 2,
          title: `Why ${selectedSerpKeyword.keyword} is Transforming Productivity`,
          url: `https://indie-builder.co/notes/${selectedSerpKeyword.keyword.replace(/\s+/g, '-')}`,
          domain: 'indie-builder.co',
          contentType: 'In-depth Review',
          authority_metric_name: 'Domain Rating (DR)',
          authority_metric_value: 31,
          estimated_backlinks: 24,
          estimated_organic_traffic: 3400,
          source: 'Mock SERP Provider (Demo)',
          retrieved_at: '2026-10-13 07:46 UTC',
          snippet: `Real-world case study from a solo developer demonstrating workflows, time savings, and setup costs.`,
        },
      ])
    : [];

  return (
    <div className="flex min-h-screen bg-slate-50 font-sans text-slate-900 antialiased">
      {/* Sidebar Navigation */}
      <Sidebar
        currentTab={currentTab}
        onSelectTab={setCurrentTab}
        activeProject={activeProject}
        projects={projectsList}
        onSelectProject={(p) => {
          setActiveProject(p);
          setSelectedCountry(p.target_country);
          setSelectedLanguage(p.target_language);
        }}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        currentRole={currentRole}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex flex-1 flex-col overflow-hidden">
        {/* Sticky Header with Search, Country & Language Selectors */}
        <Header
          seedKeyword={seedKeyword}
          onSeedKeywordChange={setSeedKeyword}
          selectedCountry={selectedCountry}
          onCountryChange={setSelectedCountry}
          countries={DEMO_COUNTRIES}
          selectedLanguage={selectedLanguage}
          onLanguageChange={setSelectedLanguage}
          languages={DEMO_LANGUAGES}
          demoState={demoState}
          onDemoStateChange={setDemoState}
          onRunResearch={handleRunResearch}
          isRunning={isRunning}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        {/* Scrollable Main Viewport */}
        <main className="flex-1 overflow-y-auto p-4 md:p-6 lg:p-8">
          <div className="mx-auto max-w-7xl space-y-6">
            
            {/* 1. TAB: Overview */}
            {currentTab === 'overview' && (
              <>
                <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h1 className="text-xl font-bold tracking-tight text-slate-900">
                      SEO Intelligence Overview
                    </h1>
                    <p className="text-xs text-slate-500">
                      Project: <span className="font-semibold text-slate-700">{activeProject.name}</span> • Target: <span className="font-semibold text-slate-700">{selectedCountry} ({selectedLanguage})</span>
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
                      Seed: <span className="text-indigo-600">&quot;{seedKeyword}&quot;</span>
                    </span>
                  </div>
                </div>

                {/* 4 KPI Overview Cards + Niche Viability Index */}
                <OverviewCards
                  keywords={keywordsList}
                  activeProjectName={activeProject.name}
                />

                {/* Keyword Research Table */}
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <h2 className="text-sm font-bold text-slate-900">
                      Discovered Keyword Opportunities (Demo Table)
                    </h2>
                    <span className="text-xs text-slate-500">
                      Showing results for market <strong className="text-slate-700">{selectedCountry}</strong>
                    </span>
                  </div>
                  <KeywordTable
                    keywords={keywordsList}
                    countryCode={selectedCountry}
                    languageCode={selectedLanguage}
                    demoState={demoState}
                    onInspectSerp={(kw) => setSelectedSerpKeyword(kw)}
                    onResetState={() => setDemoState('normal')}
                  />
                </div>

                {/* AI Evaluation Evidence Summary */}
                <AiEvaluationCard analysis={DEMO_AI_ANALYSIS} />
              </>
            )}

            {/* 2. TAB: Keyword Research (Dedicated view with clustering & batch actions) */}
            {currentTab === 'keywords' && (
              <div className="space-y-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    Keyword Research Table &amp; Clustering
                  </h1>
                  <p className="text-xs text-slate-500">
                    Search, filter, and inspect keyword difficulty, volume, and CPC across selected markets (PRD FR-02).
                  </p>
                </div>
                <KeywordTable
                  keywords={keywordsList}
                  countryCode={selectedCountry}
                  languageCode={selectedLanguage}
                  demoState={demoState}
                  onInspectSerp={(kw) => setSelectedSerpKeyword(kw)}
                  onResetState={() => setDemoState('normal')}
                />
              </div>
            )}

            {/* 3. TAB: SERP Deep Dive (Dedicated full-screen explorer) */}
            {currentTab === 'serp' && (
              <SerpDeepDiveView
                keywords={keywordsList}
                activeKeyword={selectedSerpKeyword || keywordsList[0]}
                onSelectKeyword={(kw) => setSelectedSerpKeyword(kw)}
                countryCode={selectedCountry}
                languageCode={selectedLanguage}
              />
            )}

            {/* 4. TAB: AI Evidence Studio (Interactive perspective evaluator) */}
            {currentTab === 'ai_studio' && (
              <AiEvidenceStudio />
            )}

            {/* 5. TAB: Market Intelligence (Cross-country comparison) */}
            {currentTab === 'market_comparison' && (
              <MarketComparisonView
                comparisons={DEMO_COUNTRY_COMPARISON}
                seedKeyword={seedKeyword}
              />
            )}

            {/* 6. TAB: Projects & Run History */}
            {currentTab === 'projects' && (
              <ProjectsView
                projects={projectsList}
                activeProject={activeProject}
                onSelectProject={(p) => {
                  setActiveProject(p);
                  setSelectedCountry(p.target_country);
                  setSelectedLanguage(p.target_language);
                  setCurrentTab('overview');
                }}
                onCreateProjectDemo={handleCreateProjectDemo}
              />
            )}

            {/* 7. TAB: Reports & CSV Export */}
            {currentTab === 'reports' && (
              <ReportsView
                keywords={keywordsList}
                countryCode={selectedCountry}
                languageCode={selectedLanguage}
              />
            )}

            {/* 8. TAB: Settings & Admin */}
            {currentTab === 'admin' && (
              <SettingsAdminView />
            )}

          </div>
        </main>
      </div>

      {/* SERP Modal */}
      {selectedSerpKeyword && (
        <SerpAnalysisModal
          keyword={selectedSerpKeyword}
          serpResults={currentSerpResults}
          onClose={() => setSelectedSerpKeyword(null)}
          countryCode={selectedCountry}
          languageCode={selectedLanguage}
        />
      )}

      {/* Role / Auth Modal */}
      <AuthModal
        isOpen={isAuthModalOpen}
        onClose={() => setIsAuthModalOpen(false)}
        currentRole={currentRole}
        onRoleChange={setCurrentRole}
      />
    </div>
  );
}

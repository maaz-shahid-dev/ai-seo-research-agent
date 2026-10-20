'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AlertTriangle, CheckCircle2, DatabaseZap, Info } from 'lucide-react';
import {
  DEMO_COUNTRIES,
  DEMO_LANGUAGES,
  DEMO_PRIMARY_SNAPSHOT,
  DEMO_PROJECTS,
  DEMO_RESEARCH_RUNS,
  DEMO_RESEARCH_SNAPSHOTS,
} from '@/data/demo-data';
import type {
  DemoStateMode,
  KeywordResult,
  Project,
  ResearchRun,
  ResearchSnapshot,
  UserRole,
  ViewTab,
} from '@/types/seo';
import { cloneResearchSnapshot, findDemoSnapshot, normalizeSeedKeyword } from '@/lib/demoResearch';
import { canAccessView, isViewTab } from '@/lib/navigation';
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
import { ContentCoverageView } from '@/components/dashboard/ContentCoverageView';

type NoticeTone = 'info' | 'success' | 'error';

interface PageNotice {
  tone: NoticeTone;
  text: string;
}

const VIEW_TITLES: Record<ViewTab, string> = {
  overview: 'Overview',
  keywords: 'Keyword Research',
  coverage: 'Content Coverage',
  serp: 'SERP Analysis',
  ai_studio: 'AI Evidence Studio',
  market_comparison: 'Market Intelligence',
  projects: 'Projects and Runs',
  reports: 'Reports and Export',
  admin: 'Settings and Admin',
};

function sessionTimestamp(): string {
  return `${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`;
}

export default function Home() {
  const [currentTab, setCurrentTab] = useState<ViewTab>('overview');
  const [seedKeyword, setSeedKeyword] = useState(DEMO_PRIMARY_SNAPSHOT.seed_keyword);
  const [selectedCountry, setSelectedCountry] = useState(DEMO_PRIMARY_SNAPSHOT.country);
  const [selectedLanguage, setSelectedLanguage] = useState(DEMO_PRIMARY_SNAPSHOT.language);
  const [demoState, setDemoState] = useState<DemoStateMode>('normal');
  const [activeProject, setActiveProject] = useState<Project>(DEMO_PROJECTS[0]);
  const [projectsList, setProjectsList] = useState<Project[]>(DEMO_PROJECTS);
  const [activeSnapshot, setActiveSnapshot] = useState<ResearchSnapshot | null>(() =>
    cloneResearchSnapshot(DEMO_PRIMARY_SNAPSHOT)
  );
  const [activeSerpKeywordId, setActiveSerpKeywordId] = useState<string | null>(
    DEMO_PRIMARY_SNAPSHOT.keywords[0]?.id ?? null
  );
  const [inspectorKeyword, setInspectorKeyword] = useState<KeywordResult | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isMobileSidebarOpen, setIsMobileSidebarOpen] = useState(false);
  const [currentRole, setCurrentRole] = useState<UserRole>('admin');
  const [isAuthModalOpen, setIsAuthModalOpen] = useState(false);
  const [notice, setNotice] = useState<PageNotice | null>(null);
  const researchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mainRef = useRef<HTMLElement>(null);

  const visibleProjects = useMemo(
    () => projectsList.filter((project) => !project.archived_at),
    [projectsList]
  );
  const snapshotKeywords = activeSnapshot?.keywords ?? [];
  const hasVisibleEvidence = activeSnapshot !== null && demoState === 'normal';
  const loadedCountry = activeSnapshot?.country ?? selectedCountry;
  const loadedLanguage = activeSnapshot?.language ?? selectedLanguage;
  const loadedSeed = activeSnapshot?.seed_keyword ?? seedKeyword.trim();
  const tableState: DemoStateMode = activeSnapshot
    ? demoState
    : demoState === 'loading' || demoState === 'error' || demoState === 'rate_limit'
      ? demoState
      : 'empty';
  const isQueryDirty = activeSnapshot !== null && (
    normalizeSeedKeyword(seedKeyword) !== normalizeSeedKeyword(activeSnapshot.seed_keyword)
    || selectedCountry.toUpperCase() !== activeSnapshot.country.toUpperCase()
    || selectedLanguage.toLowerCase() !== activeSnapshot.language.toLowerCase()
  );
  const activeSerpKeyword = snapshotKeywords.find(
    (keyword) => keyword.id === activeSerpKeywordId
  ) ?? snapshotKeywords[0] ?? null;
  const currentSerpResults = inspectorKeyword && activeSnapshot
    ? activeSnapshot.serp_results[inspectorKeyword.keyword] ?? []
    : [];

  const clearResearchTimer = useCallback(() => {
    if (researchTimerRef.current) {
      clearTimeout(researchTimerRef.current);
      researchTimerRef.current = null;
    }
  }, []);

  useEffect(() => clearResearchTimer, [clearResearchTimer]);

  const handleSelectTab = useCallback((requestedTab: ViewTab) => {
    const nextTab = canAccessView(currentRole, requestedTab) ? requestedTab : 'overview';
    setCurrentTab(nextTab);
    setIsMobileSidebarOpen(false);

    const url = new URL(window.location.href);
    const currentUrlTab = isViewTab(url.searchParams.get('view'))
      ? url.searchParams.get('view')
      : 'overview';
    if (nextTab === 'overview') url.searchParams.delete('view');
    else url.searchParams.set('view', nextTab);
    if (currentUrlTab !== nextTab) {
      window.history.pushState({ view: nextTab }, '', url);
    }

    window.requestAnimationFrame(() => mainRef.current?.focus({ preventScroll: true }));
  }, [currentRole]);

  useEffect(() => {
    const syncTabFromUrl = () => {
      const requested = new URL(window.location.href).searchParams.get('view');
      const nextTab = isViewTab(requested) && canAccessView(currentRole, requested)
        ? requested
        : 'overview';
      setCurrentTab(nextTab);

      if (requested && requested !== nextTab) {
        const url = new URL(window.location.href);
        url.searchParams.delete('view');
        window.history.replaceState({ view: nextTab }, '', url);
      }
    };

    syncTabFromUrl();
    window.addEventListener('popstate', syncTabFromUrl);
    return () => window.removeEventListener('popstate', syncTabFromUrl);
  }, [currentRole]);

  useEffect(() => {
    document.title = `${VIEW_TITLES[currentTab]} | AI SEO Research Agent`;
  }, [currentTab]);

  const loadSnapshot = useCallback((snapshot: ResearchSnapshot) => {
    const nextSnapshot = cloneResearchSnapshot(snapshot);
    setActiveSnapshot(nextSnapshot);
    setActiveSerpKeywordId(nextSnapshot.keywords[0]?.id ?? null);
    setInspectorKeyword(null);
    setDemoState('normal');
  }, []);

  const clearEvidence = useCallback(() => {
    setActiveSnapshot(null);
    setActiveSerpKeywordId(null);
    setInspectorKeyword(null);
    setDemoState('empty');
  }, []);

  const handleRunResearch = () => {
    const trimmedSeed = seedKeyword.trim();
    if (!trimmedSeed) {
      setNotice({ tone: 'error', text: 'Enter a seed keyword before running research.' });
      return;
    }

    clearResearchTimer();
    setInspectorKeyword(null);
    setIsRunning(true);
    setDemoState('loading');
    setNotice({
      tone: 'info',
      text: `Looking for an exact bundled snapshot for ${selectedCountry} (${selectedLanguage}).`,
    });

    const query = {
      projectId: activeProject.id,
      seedKeyword: trimmedSeed,
      country: selectedCountry,
      language: selectedLanguage,
    };

    researchTimerRef.current = setTimeout(() => {
      const match = findDemoSnapshot(DEMO_RESEARCH_SNAPSHOTS, query);
      setIsRunning(false);
      researchTimerRef.current = null;

      if (match) {
        loadSnapshot(match);
        setNotice({
          tone: 'success',
          text: `Loaded ${match.keywords.length} evidence-backed demo keywords retrieved ${match.retrieved_at}.`,
        });
        return;
      }

      clearEvidence();
      setNotice({
        tone: 'info',
        text: 'No complete demo snapshot exists for that exact project, seed, country, and language. No metrics were generated or substituted.',
      });
    }, 850);
  };

  const handleDemoStateChange = (mode: DemoStateMode) => {
    clearResearchTimer();
    setIsRunning(false);
    setInspectorKeyword(null);
    setDemoState(mode === 'normal' && !activeSnapshot ? 'empty' : mode);
    setNotice(null);
  };

  const selectProject = (project: Project) => {
    clearResearchTimer();
    setIsRunning(false);
    setActiveProject(project);
    setSelectedCountry(project.target_country);
    setSelectedLanguage(project.target_language);

    const bundledSnapshot = DEMO_RESEARCH_SNAPSHOTS.find(
      (snapshot) => snapshot.project_id === project.id
    );
    const latestRun = DEMO_RESEARCH_RUNS.find((run) => run.project_id === project.id);

    if (bundledSnapshot) {
      setSeedKeyword(bundledSnapshot.seed_keyword);
      loadSnapshot(bundledSnapshot);
      setNotice({ tone: 'success', text: `Loaded the complete bundled snapshot for ${project.name}.` });
    } else {
      setSeedKeyword(latestRun?.seed_keyword ?? '');
      clearEvidence();
      setNotice({
        tone: 'info',
        text: `${project.name} has metadata only in this demo. Run an exact bundled query or connect a provider to load evidence.`,
      });
    }

    handleSelectTab('overview');
  };

  const handleCreateProjectDemo = (name: string, country: string, language: string) => {
    const now = sessionTimestamp();
    const newProject: Project = {
      id: `proj_session_${Date.now()}`,
      user_id: 'usr_demo_01',
      name,
      description: `Session-only research workspace targeting ${country} (${language}).`,
      target_country: country,
      target_language: language,
      created_at: now,
      updated_at: now,
      keyword_count: 0,
      runs_count: 0,
    };

    setProjectsList((projects) => [newProject, ...projects]);
    setActiveProject(newProject);
    setSelectedCountry(country);
    setSelectedLanguage(language);
    setSeedKeyword('');
    clearEvidence();
    setNotice({
      tone: 'success',
      text: `${name} was created for this browser session. Add a seed keyword to check for bundled evidence.`,
    });
    handleSelectTab('overview');
  };

  const handleRenameProject = (project: Project) => {
    const nextName = window.prompt('Rename project', project.name)?.trim();
    if (!nextName || nextName === project.name) return;

    const updatedProject = { ...project, name: nextName, updated_at: sessionTimestamp() };
    setProjectsList((projects) => projects.map((item) => (
      item.id === project.id ? updatedProject : item
    )));
    setActiveProject((current) => current.id === project.id ? updatedProject : current);
    setNotice({ tone: 'success', text: `Renamed the project to ${nextName}.` });
  };

  const handleArchiveProject = (project: Project) => {
    const remainingProjects = projectsList.filter((item) => (
      item.id !== project.id && !item.archived_at
    ));
    if (remainingProjects.length === 0) {
      setNotice({ tone: 'error', text: 'At least one active project must remain in the workspace.' });
      return;
    }
    if (!window.confirm(`Archive ${project.name}? This only affects the current browser session.`)) return;

    const archivedAt = sessionTimestamp();
    setProjectsList((projects) => projects.map((item) => (
      item.id === project.id ? { ...item, archived_at: archivedAt, updated_at: archivedAt } : item
    )));

    if (activeProject.id === project.id && remainingProjects[0]) {
      selectProject(remainingProjects[0]);
    } else {
      setNotice({ tone: 'success', text: `${project.name} was archived for this session.` });
    }
  };

  const handleReopenRun = (run: ResearchRun) => {
    const project = projectsList.find((item) => item.id === run.project_id && !item.archived_at);
    if (!project) {
      setNotice({ tone: 'error', text: 'The project linked to this run is unavailable or archived.' });
      return;
    }

    clearResearchTimer();
    setIsRunning(false);
    setActiveProject(project);
    setSeedKeyword(run.seed_keyword);
    setSelectedCountry(run.country);
    setSelectedLanguage(run.language);
    const snapshot = findDemoSnapshot(DEMO_RESEARCH_SNAPSHOTS, {
      projectId: run.project_id,
      seedKeyword: run.seed_keyword,
      country: run.country,
      language: run.language,
    });

    if (snapshot) {
      loadSnapshot(snapshot);
      setNotice({ tone: 'success', text: `Reopened the complete snapshot for run ${run.id}.` });
    } else {
      clearEvidence();
      setNotice({
        tone: 'info',
        text: `Run ${run.id} contains metadata only; its keyword and SERP payloads are not bundled.`,
      });
    }
    handleSelectTab('overview');
  };

  const handleInspectSerp = (keyword: KeywordResult) => {
    setActiveSerpKeywordId(keyword.id);
    setInspectorKeyword(keyword);
  };

  const handleRoleChange = (role: UserRole) => {
    setCurrentRole(role);
    setIsAuthModalOpen(false);
    if (role === 'researcher' && currentTab === 'admin') {
      setCurrentTab('overview');
      const url = new URL(window.location.href);
      url.searchParams.delete('view');
      window.history.replaceState({ view: 'overview' }, '', url);
    }
  };

  return (
    <div className="flex min-h-dvh min-w-0 overflow-x-hidden bg-slate-50 font-sans text-slate-900 antialiased">
      <a
        href="#main-content"
        className="fixed left-3 top-3 z-[70] -translate-y-20 rounded-lg bg-slate-950 px-4 py-2 text-sm font-semibold text-white transition focus:translate-y-0"
      >
        Skip to main content
      </a>

      <Sidebar
        currentTab={currentTab}
        onSelectTab={handleSelectTab}
        activeProject={activeProject}
        projects={visibleProjects}
        onSelectProject={selectProject}
        isOpenMobile={isMobileSidebarOpen}
        onCloseMobile={() => setIsMobileSidebarOpen(false)}
        currentRole={currentRole}
        onOpenAuthModal={() => setIsAuthModalOpen(true)}
      />

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
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
          onDemoStateChange={handleDemoStateChange}
          onRunResearch={handleRunResearch}
          isRunning={isRunning}
          onOpenMobileMenu={() => setIsMobileSidebarOpen(true)}
        />

        <main
          id="main-content"
          ref={mainRef}
          tabIndex={-1}
          className="min-w-0 flex-1 overflow-y-auto p-4 outline-none md:p-6 lg:p-8"
        >
          <div className="mx-auto min-w-0 max-w-7xl space-y-6">
            {notice && <Notice tone={notice.tone} text={notice.text} onDismiss={() => setNotice(null)} />}

            {isQueryDirty && activeSnapshot && (
              <div className="flex items-start gap-2.5 rounded-xl border border-blue-200 bg-blue-50 p-4 text-xs text-blue-950" role="status">
                <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" aria-hidden="true" />
                <p>
                  <strong>Query controls changed.</strong> The visible evidence remains the loaded snapshot for{' '}
                  <strong>{activeSnapshot.seed_keyword}</strong> in {activeSnapshot.country} ({activeSnapshot.language}).
                  Run research to apply the new controls; the app will never relabel old evidence.
                </p>
              </div>
            )}

            {currentTab === 'overview' && (
              <div className="space-y-6">
                <ViewHeader
                  title="SEO Intelligence Overview"
                  projectName={activeProject.name}
                  seed={loadedSeed}
                  country={loadedCountry}
                  language={loadedLanguage}
                  snapshot={activeSnapshot}
                />

                {hasVisibleEvidence && (
                  <OverviewCards keywords={snapshotKeywords} activeProjectName={activeProject.name} />
                )}

                <section className="min-w-0 space-y-3" aria-labelledby="overview-keywords-title">
                  <div className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between">
                    <h2 id="overview-keywords-title" className="text-sm font-bold text-slate-900">
                      Discovered Keyword Opportunities
                    </h2>
                    <span className="text-xs text-slate-500">
                      Loaded market: <strong className="text-slate-700">{loadedCountry} ({loadedLanguage})</strong>
                    </span>
                  </div>
                  <KeywordTable
                    keywords={snapshotKeywords}
                    snapshotId={activeSnapshot?.id ?? null}
                    countryCode={loadedCountry}
                    languageCode={loadedLanguage}
                    demoState={tableState}
                    onInspectSerp={handleInspectSerp}
                    onResetState={() => setDemoState(activeSnapshot ? 'normal' : 'empty')}
                  />
                </section>

                {hasVisibleEvidence && <AiEvaluationCard analysis={activeSnapshot.analysis} />}
              </div>
            )}

            {currentTab === 'keywords' && (
              <div className="min-w-0 space-y-4">
                <div>
                  <h1 className="text-xl font-bold tracking-tight text-slate-900">
                    Keyword Research and Clustering
                  </h1>
                  <p className="mt-1 text-xs text-slate-500">
                    Search, filter, and inspect the loaded snapshot without changing its market provenance.
                  </p>
                </div>
                <KeywordTable
                  keywords={snapshotKeywords}
                  snapshotId={activeSnapshot?.id ?? null}
                  countryCode={loadedCountry}
                  languageCode={loadedLanguage}
                  demoState={tableState}
                  onInspectSerp={handleInspectSerp}
                  onResetState={() => setDemoState(activeSnapshot ? 'normal' : 'empty')}
                />
              </div>
            )}

            {currentTab === 'coverage' && (
              hasVisibleEvidence ? (
                <ContentCoverageView
                  keywords={snapshotKeywords}
                  onOpenKeywordResearch={() => handleSelectTab('keywords')}
                />
              ) : <EvidenceUnavailablePanel state={tableState} area="content coverage" />
            )}

            {currentTab === 'serp' && (
              hasVisibleEvidence && activeSerpKeyword ? (
                <SerpDeepDiveView
                  keywords={snapshotKeywords}
                  activeKeyword={activeSerpKeyword}
                  onSelectKeyword={(keyword) => setActiveSerpKeywordId(keyword.id)}
                  countryCode={activeSnapshot.country}
                  languageCode={activeSnapshot.language}
                  serpResultsByKeyword={activeSnapshot.serp_results}
                />
              ) : <EvidenceUnavailablePanel state={tableState} area="SERP analysis" />
            )}

            {currentTab === 'ai_studio' && (
              hasVisibleEvidence
                ? <AiEvidenceStudio />
                : <EvidenceUnavailablePanel state={tableState} area="AI evidence analysis" />
            )}

            {currentTab === 'market_comparison' && (
              hasVisibleEvidence ? (
                <MarketComparisonView
                  comparisons={activeSnapshot.market_comparisons}
                  seedKeyword={activeSnapshot.seed_keyword}
                />
              ) : <EvidenceUnavailablePanel state={tableState} area="market comparison" />
            )}

            {currentTab === 'projects' && (
              <ProjectsView
                projects={visibleProjects}
                runs={DEMO_RESEARCH_RUNS}
                activeProject={activeProject}
                onSelectProject={selectProject}
                onCreateProjectDemo={handleCreateProjectDemo}
                onRenameProject={handleRenameProject}
                onArchiveProject={handleArchiveProject}
                onReopenRun={handleReopenRun}
              />
            )}

            {currentTab === 'reports' && (
              <ReportsView
                keywords={activeSnapshot?.keywords ?? []}
                countryCode={activeSnapshot?.country ?? selectedCountry}
                languageCode={activeSnapshot?.language ?? selectedLanguage}
                projectName={activeProject.name}
                seedKeyword={activeSnapshot?.seed_keyword ?? seedKeyword.trim()}
              />
            )}

            {currentTab === 'admin' && currentRole === 'admin' && (
              <SettingsAdminView
                projectsCount={visibleProjects.length}
                researchRunsCount={DEMO_RESEARCH_RUNS.length}
              />
            )}
          </div>
        </main>
      </div>

      {inspectorKeyword && activeSnapshot && (
        <SerpAnalysisModal
          keyword={inspectorKeyword}
          serpResults={currentSerpResults}
          onClose={() => setInspectorKeyword(null)}
          countryCode={activeSnapshot.country}
          languageCode={activeSnapshot.language}
        />
      )}

      {isAuthModalOpen && (
        <AuthModal
          isOpen
          onClose={() => setIsAuthModalOpen(false)}
          currentRole={currentRole}
          onRoleChange={handleRoleChange}
        />
      )}
    </div>
  );
}

function ViewHeader({ title, projectName, seed, country, language, snapshot }: {
  title: string;
  projectName: string;
  seed: string;
  country: string;
  language: string;
  snapshot: ResearchSnapshot | null;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
      <div className="min-w-0">
        <h1 className="text-xl font-bold tracking-tight text-slate-900">{title}</h1>
        <p className="mt-1 text-xs text-slate-500">
          Project: <strong className="text-slate-700">{projectName}</strong>{' '}
          <span aria-hidden="true">&middot;</span> Target:{' '}
          <strong className="text-slate-700">{country} ({language})</strong>
        </p>
        {snapshot && (
          <p className="mt-1 text-[11px] text-slate-400">
            Source: {snapshot.provider} <span aria-hidden="true">&middot;</span> Retrieved: {snapshot.retrieved_at}
          </p>
        )}
      </div>
      <span className="max-w-full rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700 shadow-2xs">
        Seed: <span className="break-words text-indigo-600">&quot;{seed || 'Not set'}&quot;</span>
      </span>
    </div>
  );
}

function Notice({ tone, text, onDismiss }: PageNotice & { onDismiss: () => void }) {
  const toneClasses: Record<NoticeTone, string> = {
    info: 'border-blue-200 bg-blue-50 text-blue-950',
    success: 'border-emerald-200 bg-emerald-50 text-emerald-950',
    error: 'border-rose-200 bg-rose-50 text-rose-950',
  };
  const Icon = tone === 'success' ? CheckCircle2 : tone === 'error' ? AlertTriangle : Info;

  return (
    <div
      role={tone === 'error' ? 'alert' : 'status'}
      className={`flex items-start gap-2.5 rounded-xl border p-4 text-xs ${toneClasses[tone]}`}
    >
      <Icon className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
      <p className="min-w-0 flex-1 leading-relaxed">{text}</p>
      <button
        type="button"
        onClick={onDismiss}
        className="min-h-8 shrink-0 rounded-md px-2 font-semibold hover:bg-black/5 focus-visible:outline-2 focus-visible:outline-offset-2"
        aria-label="Dismiss message"
      >
        Dismiss
      </button>
    </div>
  );
}

function EvidenceUnavailablePanel({ state, area }: { state: DemoStateMode; area: string }) {
  const copy: Record<DemoStateMode, { title: string; description: string }> = {
    normal: {
      title: 'No research snapshot loaded',
      description: `Load an exact demo snapshot before opening ${area}. No evidence will be inferred from another query.`,
    },
    loading: {
      title: 'Research snapshot is loading',
      description: `${area} will appear after evidence retrieval completes.`,
    },
    empty: {
      title: 'No matching evidence',
      description: `The current project and query have no complete bundled snapshot for ${area}.`,
    },
    error: {
      title: 'Provider error simulation',
      description: `${area} is hidden while the simulated provider error is active, so stale evidence is not shown.`,
    },
    rate_limit: {
      title: 'Rate limit simulation',
      description: `${area} is paused while the simulated provider rate limit is active.`,
    },
  };
  const message = copy[state];

  return (
    <section
      className="rounded-2xl border border-dashed border-slate-300 bg-white px-5 py-14 text-center shadow-xs"
      role="status"
      aria-live="polite"
    >
      <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
        <DatabaseZap className="h-6 w-6" aria-hidden="true" />
      </div>
      <h1 className="mt-4 text-lg font-bold text-slate-900">{message.title}</h1>
      <p className="mx-auto mt-2 max-w-xl text-sm leading-6 text-slate-600">{message.description}</p>
    </section>
  );
}

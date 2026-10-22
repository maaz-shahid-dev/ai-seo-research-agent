"use client";

import { Loader2 } from "lucide-react";
import dynamic from "next/dynamic";
import { useEffect, useMemo, useState } from "react";

import { slugify } from "@/features/research/blueprint";
import { isQuestionKeyword } from "@/features/research/niche";
import { classifyNicheType, NICHE_TYPE_PROFILES } from "@/features/research/niche-types";
import { rankOpportunities, type Opportunity } from "@/features/research/opportunity";
import type { AiAnalysisDto, KeywordDto, ProjectDto } from "@/features/research/types";
import { Button } from "@/components/ui/Button";
import { tabPanelProps, Tabs } from "@/components/ui/Tabs";
import { useStoredChecklist } from "@/hooks/useStoredChecklist";
import { pick, readParam, writeParams } from "@/lib/url-state";

import { InsightsCard } from "./InsightsCard";
import { KeywordTable } from "./KeywordTable";
import { NicheTypeCard } from "./NicheTypeCard";
import { NicheVerdictCard } from "./NicheVerdictCard";
import { OverviewStats } from "./OverviewStats";
import { useSerpAnalysis } from "./useSerpAnalysis";

// Tabs beyond the overview load on first open, keeping the initial report light.
function TabLoading() {
  return (
    <p className="flex items-center gap-2 py-6 text-sm text-slate-600" role="status">
      <Loader2 className="h-4 w-4 animate-spin text-indigo-600" aria-hidden="true" /> Loading…
    </p>
  );
}
const loading = () => <TabLoading />;
const ClustersView = dynamic(() => import("./ClustersView").then((module) => module.ClustersView), { loading });
const ContentGapView = dynamic(() => import("./ContentGapView").then((module) => module.ContentGapView), { loading });
const ContentPlanView = dynamic(() => import("./ContentPlanView").then((module) => module.ContentPlanView), { loading });
const CoverageView = dynamic(() => import("./CoverageView").then((module) => module.CoverageView), { loading });
const IskillsView = dynamic(() => import("./IskillsView").then((module) => module.IskillsView), { loading });
const KgrView = dynamic(() => import("./KgrView").then((module) => module.KgrView), { loading });
const LaunchPlanView = dynamic(() => import("./LaunchPlanView").then((module) => module.LaunchPlanView), { loading });
const SerpPanel = dynamic(() => import("./SerpPanel").then((module) => module.SerpPanel), { loading });

export const RESULT_TABS = ["overview", "keywords", "coverage", "clusters", "questions", "plan", "launch", "kgr", "iskills", "content-gap"] as const;
type ResultTab = (typeof RESULT_TABS)[number];

export const RESULT_TAB_LABELS: Record<ResultTab, string> = {
  overview: "Overview",
  keywords: "Keywords",
  coverage: "Coverage",
  clusters: "Clusters",
  questions: "Questions",
  plan: "Content plan",
  launch: "Launch plan",
  kgr: "KGR",
  iskills: "iSkills check",
  "content-gap": "Content gap",
};

/** Dispatched by the command palette with a tab id as detail. */
export const OPEN_RESULT_TAB_EVENT = "research:open-tab";
const TABS_LABEL = "Result views";
const BEST_OPPORTUNITY_COUNT = 5;

type ResearchResultsProps = {
  runId: string;
  analysis: AiAnalysisDto | null;
  project: ProjectDto;
  onProjectUpdate: (project: ProjectDto) => void;
  keywords: KeywordDto[];
  hasMore: boolean;
  loadingMore: boolean;
  onLoadMore: () => void;
};

/** Everything about one finished search, one simple tab at a time, plus the SERP side panel. */
export function ResearchResults({ runId, analysis, project, onProjectUpdate, keywords, hasMore, loadingMore, onLoadMore }: ResearchResultsProps) {
  // Results render only in the browser (after loading), so reading the URL here is safe.
  const [tab, setTab] = useState<ResultTab>(() => pick(readParam("tab"), RESULT_TABS, "overview"));
  useEffect(() => writeParams({ tab: tab === "overview" ? null : tab }), [tab]);
  useEffect(() => {
    const open = (event: Event) => setTab(pick(String((event as CustomEvent<unknown>).detail), RESULT_TABS, "overview"));
    window.addEventListener(OPEN_RESULT_TAB_EVENT, open);
    return () => window.removeEventListener(OPEN_RESULT_TAB_EVENT, open);
  }, []);
  const [selected, setSelected] = useState<KeywordDto | null>(null);
  const questions = useMemo(() => keywords.filter((item) => isQuestionKeyword(item.keyword)), [keywords]);
  // The searched topic itself, or its biggest keyword when the provider didn't return it.
  const seed = useMemo(
    () => keywords.find((item) => item.source === "seed")
      ?? [...keywords].sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))[0]
      ?? null,
    [keywords],
  );
  const nicheType = useMemo(() => classifyNicheType(seed?.keyword ?? "", keywords), [seed, keywords]);
  const opportunities = useMemo(() => rankOpportunities(keywords), [keywords]);
  const bestOpportunities = useMemo(() => topOpportunities(keywords, opportunities, BEST_OPPORTUNITY_COUNT), [keywords, opportunities]);
  const favorites = useStoredChecklist(`seo-research:favorites:${runId}`);
  const exportName = `${slugify(seed?.keyword ?? "") || "research"}-keywords`;
  // One SERP analysis of the seed feeds both the verdict and the iSkills check.
  const seedSerp = useSerpAnalysis(runId, seed?.id ?? null);

  const table = (rows: KeywordDto[], emptyMessage?: string, withExport = false) => (
    <KeywordTable
      keywords={rows}
      opportunities={opportunities}
      favorites={favorites}
      exportName={withExport ? exportName : undefined}
      syncUrl={withExport && rows === keywords}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      onSelect={setSelected}
      emptyMessage={emptyMessage}
    />
  );

  return (
    <div className="space-y-3">
      <Tabs
        label={TABS_LABEL}
        selected={tab}
        onSelect={setTab}
        tabs={[
          ...RESULT_TABS.map((id) => ({
            id,
            label: RESULT_TAB_LABELS[id],
            ...(id === "keywords" ? { count: keywords.length } : id === "questions" ? { count: questions.length } : {}),
          })),
        ]}
      />
      <div {...tabPanelProps(TABS_LABEL, tab)} className="space-y-3">
        {tab === "overview" ? (
          <>
            <OverviewStats keywords={keywords} opportunities={opportunities} />
            {seed ? <NicheVerdictCard keyword={seed} serp={seedSerp.data} error={seedSerp.error} rpmUsd={NICHE_TYPE_PROFILES[nicheType].rpmUsd} /> : null}
            <NicheTypeCard type={nicheType} />
            <section aria-labelledby="best-title" className="space-y-2">
              <div className="flex items-baseline justify-between">
                <h2 id="best-title" className="text-sm font-semibold text-slate-900">Best opportunities</h2>
                <Button variant="ghost" size="sm" onClick={() => setTab("keywords")}>See all {keywords.length} keywords</Button>
              </div>
              {table(bestOpportunities)}
            </section>
            <InsightsCard analysis={analysis} />
          </>
        ) : null}
        {tab === "keywords" ? table(keywords, undefined, true) : null}
        {tab === "coverage" && seed ? <CoverageView seed={seed.keyword} keywords={keywords} onSelect={setSelected} exportName={exportName} /> : null}
        {tab === "clusters" && seed ? <ClustersView seed={seed.keyword} keywords={keywords} onSelect={setSelected} /> : null}
        {tab === "questions" ? table(questions, "No question keywords for this topic.", true) : null}
        {tab === "plan" && seed ? <ContentPlanView seed={seed.keyword} keywords={keywords} /> : null}
        {tab === "launch" && seed ? <LaunchPlanView runId={runId} seed={seed.keyword} keywords={keywords} nicheType={nicheType} /> : null}
        {tab === "kgr" ? <KgrView runId={runId} keywords={keywords} /> : null}
        {tab === "iskills" && seed ? <IskillsView seed={seed} keywords={keywords} serp={seedSerp.data} /> : null}
        {tab === "content-gap" ? <ContentGapView runId={runId} project={project} onProjectUpdate={onProjectUpdate} /> : null}
      </div>
      {selected ? <SerpPanel runId={runId} keyword={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

/** Highest opportunity score first; unscored keywords last. */
function topOpportunities(keywords: readonly KeywordDto[], opportunities: ReadonlyMap<number, Opportunity>, count: number) {
  return [...keywords]
    .sort((a, b) => (opportunities.get(b.id)?.score ?? -1) - (opportunities.get(a.id)?.score ?? -1))
    .slice(0, count);
}

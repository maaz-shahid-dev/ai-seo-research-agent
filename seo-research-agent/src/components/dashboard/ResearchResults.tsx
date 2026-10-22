"use client";

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

import { ContentGapView } from "./ContentGapView";
import { ContentPlanView } from "./ContentPlanView";
import { CoverageView } from "./CoverageView";
import { InsightsCard } from "./InsightsCard";
import { IskillsView } from "./IskillsView";
import { KeywordTable } from "./KeywordTable";
import { KgrView } from "./KgrView";
import { LaunchPlanView } from "./LaunchPlanView";
import { NicheTypeCard } from "./NicheTypeCard";
import { NicheVerdictCard } from "./NicheVerdictCard";
import { OverviewStats } from "./OverviewStats";
import { SerpPanel } from "./SerpPanel";
import { useSerpAnalysis } from "./useSerpAnalysis";

const RESULT_TABS = ["overview", "keywords", "coverage", "questions", "plan", "launch", "kgr", "iskills", "content-gap"] as const;
type ResultTab = (typeof RESULT_TABS)[number];
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
          { id: "overview", label: "Overview" },
          { id: "keywords", label: "Keywords", count: keywords.length },
          { id: "coverage", label: "Coverage" },
          { id: "questions", label: "Questions", count: questions.length },
          { id: "plan", label: "Content plan" },
          { id: "launch", label: "Launch plan" },
          { id: "kgr", label: "KGR" },
          { id: "iskills", label: "iSkills check" },
          { id: "content-gap", label: "Content gap" },
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

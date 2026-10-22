"use client";

import { useMemo, useState } from "react";

import { isQuestionKeyword } from "@/features/research/niche";
import type { AiAnalysisDto, KeywordDto, ProjectDto } from "@/features/research/types";
import { tabPanelProps, Tabs } from "@/components/ui/Tabs";

import { ContentGapView } from "./ContentGapView";
import { InsightsCard } from "./InsightsCard";
import { KeywordTable } from "./KeywordTable";
import { NicheVerdictCard } from "./NicheVerdictCard";
import { SerpPanel } from "./SerpPanel";

type ResultTab = "keywords" | "questions" | "content-gap";
const TABS_LABEL = "Result views";

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

/** Niche verdict, AI summary, keyword/question/content-gap tabs and the SERP side panel. */
export function ResearchResults({ runId, analysis, project, onProjectUpdate, keywords, hasMore, loadingMore, onLoadMore }: ResearchResultsProps) {
  const [tab, setTab] = useState<ResultTab>("keywords");
  const [selected, setSelected] = useState<KeywordDto | null>(null);
  const questions = useMemo(() => keywords.filter((item) => isQuestionKeyword(item.keyword)), [keywords]);
  // The searched topic itself, or its biggest keyword when the provider didn't return it.
  const seed = useMemo(
    () => keywords.find((item) => item.source === "seed")
      ?? [...keywords].sort((a, b) => (b.searchVolume ?? 0) - (a.searchVolume ?? 0))[0]
      ?? null,
    [keywords],
  );

  const table = (rows: KeywordDto[], emptyMessage?: string) => (
    <KeywordTable
      keywords={rows}
      hasMore={hasMore}
      loadingMore={loadingMore}
      onLoadMore={onLoadMore}
      onSelect={setSelected}
      emptyMessage={emptyMessage}
    />
  );

  return (
    <div className="space-y-3">
      {/* The verdict answers the main question first; the AI summary adds context. */}
      {seed ? <NicheVerdictCard runId={runId} keyword={seed} /> : null}
      <InsightsCard analysis={analysis} />
      <Tabs
        label={TABS_LABEL}
        selected={tab}
        onSelect={setTab}
        tabs={[
          { id: "keywords", label: "Keywords", count: keywords.length },
          { id: "questions", label: "Questions", count: questions.length },
          { id: "content-gap", label: "Content gap" },
        ]}
      />
      <div {...tabPanelProps(TABS_LABEL, tab)}>
        {tab === "keywords" ? table(keywords) : null}
        {tab === "questions" ? table(questions, "No question keywords for this topic.") : null}
        {tab === "content-gap" ? <ContentGapView runId={runId} project={project} onProjectUpdate={onProjectUpdate} /> : null}
      </div>
      {selected ? <SerpPanel runId={runId} keyword={selected} onClose={() => setSelected(null)} /> : null}
    </div>
  );
}

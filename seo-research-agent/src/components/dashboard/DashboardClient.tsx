"use client";

import { signOut } from "next-auth/react";
import { useEffect, useRef, useState } from "react";

import { replaceProject } from "@/features/projects/client";
import { MARKET_LANGUAGE } from "@/features/research/markets";
import type { ProjectDto, ResearchRunDto } from "@/features/research/types";
import { AppShell, type AppView } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { EmptyState } from "@/components/ui/EmptyState";
import { apiRequest, errorMessage } from "@/lib/api-client";
import { writeParams } from "@/lib/url-state";

import { DailyNichesView } from "./DailyNichesView";
import { HistoryView } from "./HistoryView";
import { ProjectsPanel } from "./ProjectsPanel";
import { RecentSearches } from "./RecentSearches";
import { ResearchView } from "./ResearchView";
import { SearchBar } from "./SearchBar";
import { useRecentRuns } from "./useRecentRuns";

type DashboardClientProps = {
  user: { name: string };
  initialProjects: ProjectDto[];
  /** True when the server runs on built-in demo data instead of live providers. */
  demo?: boolean;
  /** Screen and search from a shared or refreshed URL (validated on the server). */
  initialView?: AppView;
  initialRunId?: string | null;
};

export function DashboardClient({ user, initialProjects, demo = false, initialView = "research", initialRunId = null }: DashboardClientProps) {
  const [view, setView] = useState<AppView>(initialView);
  // A search named in the URL; cleared once it is shown or turns out to be unavailable.
  const [linkedRunId, setLinkedRunId] = useState<string | null>(initialRunId);
  const [projects, setProjects] = useState(initialProjects);
  // Pin the starting project so creating a new one doesn't silently switch searches to it.
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(
    () => initialProjects.find((item) => item.status === "active")?.id ?? null,
  );
  const [selectedRun, setSelectedRun] = useState<ResearchRunDto | null>(null);
  const [query, setQuery] = useState("");
  // Null until the user picks a country; until then searches use the project's market.
  const [chosenCountry, setChosenCountry] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Reused when a submission is retried so the server never starts it twice.
  const idempotencyKey = useRef<string | null>(null);

  const activeProjects = projects.filter((project) => project.status === "active");
  // Fall back to the first active project if the chosen one was archived.
  const project = activeProjects.find((item) => item.id === chosenProjectId) ?? activeProjects[0] ?? null;
  const recent = useRecentRuns(project?.id ?? null);
  const country = chosenCountry ?? project?.countryCode ?? "US";
  // Show the user's pick, otherwise the latest search, so results survive a reload.
  const linkedRun = linkedRunId ? recent.runs.find((run) => run.id === linkedRunId) ?? null : null;
  // Wait for a linked search older than the recent list instead of flashing the latest one.
  const waitingForLink = linkedRunId !== null && linkedRun === null && !selectedRun;
  const displayedRun =
    (selectedRun && recent.runs.find((run) => run.id === selectedRun.id)) ?? selectedRun ?? linkedRun
      ?? (waitingForLink ? null : recent.runs[0] ?? null);

  // A linked search that isn't among the recent ones is loaded on its own.
  useEffect(() => {
    if (!linkedRunId || recent.loading || linkedRun || selectedRun) return;
    const controller = new AbortController();
    apiRequest<{ run: ResearchRunDto }>(`/api/research/${encodeURIComponent(linkedRunId)}`, { signal: controller.signal })
      .then(({ run }) => {
        setSelectedRun(run);
        if (run.projectId !== project?.id && activeProjects.some((item) => item.id === run.projectId)) setChosenProjectId(run.projectId);
      })
      .catch(() => {
        if (!controller.signal.aborted) setLinkedRunId(null);
      });
    return () => controller.abort();
  }, [linkedRunId, recent.loading, linkedRun, selectedRun, project?.id, activeProjects]);

  useEffect(() => {
    writeParams({ view: view === "research" ? null : view, run: displayedRun?.id ?? null });
  }, [view, displayedRun?.id]);

  function updateProjectInList(updated: ProjectDto) {
    setProjects((current) => replaceProject(current, updated));
  }

  function openProject(projectId: string) {
    setChosenProjectId(projectId);
    setSelectedRun(null);
    setLinkedRunId(null);
    setSubmitError(null);
    setView("research");
  }

  async function submit(seed = query, countryCode = country) {
    if (!project || submitting) return;
    setSubmitting(true);
    setSubmitError(null);
    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const { run } = await apiRequest<{ run: ResearchRunDto }>("/api/research", {
        method: "POST",
        body: JSON.stringify({
          projectId: project.id,
          seed,
          countryCode,
          languageCode: MARKET_LANGUAGE,
          device: "desktop",
          keywordLimit: 100,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      idempotencyKey.current = null;
      recent.upsert(run);
      setSelectedRun(run);
    } catch (error) {
      setSubmitError(errorMessage(error));
    } finally {
      setSubmitting(false);
    }
  }

  function openRun(run: ResearchRunDto) {
    setSelectedRun(run);
    setView("research");
  }

  function forgetRun(runId: string) {
    recent.remove(runId);
    if (selectedRun?.id === runId) setSelectedRun(null);
  }

  /** Runs a search for a suggested niche in its own country and shows its results. */
  function checkNiche(seed: string, countryCode: string) {
    setView("research");
    setChosenCountry(countryCode);
    retry(seed, countryCode);
  }

  function retry(seed: string, countryCode = country) {
    setQuery(seed);
    idempotencyKey.current = null;
    void submit(seed, countryCode);
  }

  const sidebar = (
    <div className="space-y-5">
      {activeProjects.length > 1 ? (
        <div className="px-3">
          <label htmlFor="project" className="text-[11px] font-semibold uppercase tracking-wide text-slate-400">Project</label>
          <select
            id="project"
            value={project?.id ?? ""}
            onChange={(event) => openProject(event.target.value)}
            className="mt-1.5 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm"
          >
            {activeProjects.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
        </div>
      ) : null}
      <RecentSearches
        runs={recent.runs}
        selectedId={displayedRun?.id ?? null}
        onSelect={openRun}
        onViewAll={() => setView("history")}
      />
    </div>
  );

  return (
    <AppShell
      view={view}
      onNavigate={setView}
      user={user}
      demo={demo}
      onSignOut={() => void signOut({ redirectTo: "/sign-in" })}
      sidebar={sidebar}
    >
      {view === "ideas" ? (
        <DailyNichesView onCheck={checkNiche} />
      ) : view === "history" && project ? (
        <HistoryView key={project.id} projectId={project.id} projectName={project.name} onOpen={openRun} onDeleted={forgetRun} />
      ) : view === "projects" ? (
        <ProjectsPanel
          projects={projects}
          activeProjectId={project?.id ?? null}
          onProjectsChange={setProjects}
          onOpen={openProject}
        />
      ) : !project ? (
        <EmptyState title="No active projects" action={<Button onClick={() => setView("projects")}>Manage projects</Button>}>
          Create or restore a project to start researching.
        </EmptyState>
      ) : (
        <>
          <SearchBar
            query={query}
            onQueryChange={(value) => {
              setQuery(value);
              idempotencyKey.current = null;
            }}
            country={country}
            onCountryChange={(value) => {
              setChosenCountry(value);
              idempotencyKey.current = null;
            }}
            onSubmit={(example) => (example ? retry(example) : void submit())}
            pending={submitting}
            error={submitError}
            showExamples={!recent.loading && recent.runs.length === 0}
          />

          {displayedRun ? (
            <ResearchView
              key={displayedRun.id}
              initialRun={displayedRun}
              project={project}
              onProjectUpdate={updateProjectInList}
              onRunChange={recent.upsert}
              onRetry={(seed, countryCode) => {
                setChosenCountry(countryCode);
                retry(seed, countryCode);
              }}
            />
          ) : recent.loading ? null : (
            <p className="py-12 text-center text-sm text-slate-500">
              {recent.error ?? "Your results will appear here: verdict, keywords, content plan and the iSkills check."}
            </p>
          )}
        </>
      )}
    </AppShell>
  );
}

"use client";

import { signOut } from "next-auth/react";
import { useRef, useState } from "react";

import { replaceProject } from "@/features/projects/client";
import { MARKET_LANGUAGE } from "@/features/research/markets";
import type { ProjectDto, ResearchRunDto } from "@/features/research/types";
import { AppShell, type AppView } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/Button";
import { apiRequest, errorMessage } from "@/lib/api-client";

import { DailyNichesView } from "./DailyNichesView";
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
};

export function DashboardClient({ user, initialProjects, demo = false }: DashboardClientProps) {
  const [view, setView] = useState<AppView>("research");
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
  const displayedRun =
    (selectedRun && recent.runs.find((run) => run.id === selectedRun.id)) ?? selectedRun ?? recent.runs[0] ?? null;

  function updateProjectInList(updated: ProjectDto) {
    setProjects((current) => replaceProject(current, updated));
  }

  function openProject(projectId: string) {
    setChosenProjectId(projectId);
    setSelectedRun(null);
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
        onSelect={(run) => {
          setSelectedRun(run);
          setView("research");
        }}
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
      ) : view === "projects" ? (
        <ProjectsPanel
          projects={projects}
          activeProjectId={project?.id ?? null}
          onProjectsChange={setProjects}
          onOpen={openProject}
        />
      ) : !project ? (
        <div className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <h1 className="font-semibold">No active projects</h1>
          <Button className="mt-4" onClick={() => setView("projects")}>Manage projects</Button>
        </div>
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
              onRetry={retry}
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

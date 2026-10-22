"use client";

import { signOut } from "next-auth/react";
import { useRef, useState } from "react";

import { replaceProject } from "@/features/projects/client";
import type { ProjectDto, ResearchRunDto } from "@/features/research/types";
import { Button } from "@/components/ui/Button";
import { apiRequest, errorMessage } from "@/lib/api-client";

import { DailyNichesView } from "./DailyNichesView";
import { ProjectsPanel } from "./ProjectsPanel";
import { RecentSearches } from "./RecentSearches";
import { ResearchView } from "./ResearchView";
import { SearchBar } from "./SearchBar";
import { useRecentRuns } from "./useRecentRuns";

type View = "research" | "ideas" | "projects";

type DashboardClientProps = {
  user: { name: string };
  initialProjects: ProjectDto[];
};

export function DashboardClient({ user, initialProjects }: DashboardClientProps) {
  const [view, setView] = useState<View>("research");
  const [projects, setProjects] = useState(initialProjects);
  // Pin the starting project so creating a new one doesn't silently switch searches to it.
  const [chosenProjectId, setChosenProjectId] = useState<string | null>(
    () => initialProjects.find((item) => item.status === "active")?.id ?? null,
  );
  const [selectedRun, setSelectedRun] = useState<ResearchRunDto | null>(null);
  const [query, setQuery] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  // Reused when a submission is retried so the server never starts it twice.
  const idempotencyKey = useRef<string | null>(null);

  const activeProjects = projects.filter((project) => project.status === "active");
  // Fall back to the first active project if the chosen one was archived.
  const project = activeProjects.find((item) => item.id === chosenProjectId) ?? activeProjects[0] ?? null;
  const recent = useRecentRuns(project?.id ?? null);
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

  async function submit(seed = query) {
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
          countryCode: project.countryCode,
          languageCode: project.languageCode,
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

  /** Runs a search for a suggested niche and shows its results. */
  function checkNiche(seed: string) {
    setView("research");
    retry(seed);
  }

  function retry(seed: string) {
    setQuery(seed);
    idempotencyKey.current = null;
    void submit(seed);
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3 sm:px-6">
          <div className="flex items-center gap-1 sm:gap-4">
            <span className="mr-2 font-semibold tracking-tight">SEO Research</span>
            <nav aria-label="Main" className="flex gap-1">
              <NavTab active={view === "research"} onClick={() => setView("research")}>Research</NavTab>
              <NavTab active={view === "ideas"} onClick={() => setView("ideas")}>Daily niches</NavTab>
              <NavTab active={view === "projects"} onClick={() => setView("projects")}>Projects</NavTab>
            </nav>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-500 sm:inline">{user.name}</span>
            <Button variant="ghost" size="sm" onClick={() => void signOut({ redirectTo: "/sign-in" })}>
              Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl space-y-5 px-4 py-6 sm:px-6">
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
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
            <h1 className="font-semibold">No active projects</h1>
            <Button className="mt-4" onClick={() => setView("projects")}>Manage projects</Button>
          </div>
        ) : (
          <>
            <div className="space-y-3">
              <SearchBar
                query={query}
                onQueryChange={(value) => {
                  setQuery(value);
                  idempotencyKey.current = null;
                }}
                onSubmit={() => void submit()}
                pending={submitting}
                projects={activeProjects}
                projectId={project.id}
                onProjectChange={openProject}
              />
              {submitError ? <p className="text-sm text-rose-700" role="alert">{submitError}</p> : null}
              <RecentSearches runs={recent.runs} selectedId={displayedRun?.id ?? null} onSelect={setSelectedRun} />
            </div>

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
              <p className="py-16 text-center text-sm text-slate-500">
                {recent.error ?? "Search a topic to see keyword ideas, search volume and difficulty."}
              </p>
            )}
          </>
        )}
      </main>
    </div>
  );
}

function NavTab({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
        active ? "bg-slate-100 text-slate-950" : "text-slate-500 hover:text-slate-900"
      }`}
    >
      {children}
    </button>
  );
}

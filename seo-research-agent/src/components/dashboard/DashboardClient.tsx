"use client";

import { signOut } from "next-auth/react";
import { useEffect, useMemo, useRef, useState, type FormEvent } from "react";

type Project = {
  id: string;
  name: string;
  targetDomain: string | null;
  description: string | null;
  countryCode: string;
  languageCode: string;
  status: "active" | "archived";
  version: number;
  createdAt: string;
  updatedAt: string;
};

type ResearchRun = {
  id: string;
  projectId: string;
  query: string;
  countryCode: string;
  languageCode: string;
  device: "desktop" | "mobile";
  keywordLimit: number;
  status: "queued" | "running" | "completed" | "failed" | "cancelled";
  version: number;
  progress: number;
  keywordCount: number;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
  finishedAt: string | null;
};

type Keyword = {
  id: number;
  keyword: string;
  source: string;
  intent: string;
  searchVolume: number | null;
  cpcMicros: number | null;
  competition: number | null;
  difficulty: number | null;
};

type CitedStatement = {
  statement: string;
  citationIds: string[];
};

type ResearchAnalysis = {
  summary: CitedStatement;
  opportunitySignals: CitedStatement[];
  risks: CitedStatement[];
  missingEvidence: string[];
  nextSteps: CitedStatement[];
};

type AiAnalysis = {
  id: string;
  status: "queued" | "running" | "completed" | "failed";
  summary: string | null;
  output: ResearchAnalysis | null;
  errorMessage: string | null;
  updatedAt: string;
};

type ApiError = { error?: { message?: string } };

export function DashboardClient({
  user,
  initialProjects,
}: {
  user: { name: string; role: "user" | "admin" };
  initialProjects: Project[];
}) {
  const [view, setView] = useState<"research" | "projects">("research");
  const [projects, setProjects] = useState(initialProjects);
  const [activeProjectId, setActiveProjectId] = useState(
    () => initialProjects.find((project) => project.status === "active")?.id ?? "",
  );
  const [run, setRun] = useState<ResearchRun | null>(null);
  const [analysis, setAnalysis] = useState<AiAnalysis | null>(null);
  const [keywords, setKeywords] = useState<Keyword[]>([]);
  const [nextCursor, setNextCursor] = useState<number | null>(null);
  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState("");
  const [notice, setNotice] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const idempotencyKey = useRef<string | null>(null);

  const activeProjects = projects.filter((project) => project.status === "active");
  const activeProject = activeProjects.find((project) => project.id === activeProjectId) ?? null;
  const filteredKeywords = useMemo(() => {
    const normalized = filter.trim().toLowerCase();
    return normalized
      ? keywords.filter((keyword) => keyword.keyword.toLowerCase().includes(normalized))
      : keywords;
  }, [filter, keywords]);

  useEffect(() => {
    if (!run) return;
    const researchPending = run.status === "queued" || run.status === "running";
    const analysisPending = run.status === "completed" &&
      (analysis?.status === "queued" || analysis?.status === "running");
    if (!researchPending && !analysisPending) return;

    let stopped = false;
    const timeout = setTimeout(async () => {
      try {
        const result = await apiRequest<ResearchResponse>(`/api/research/${run.id}`);
        if (stopped) return;
        const previousRunStatus = run.status;
        const previousAnalysisStatus = analysis?.status;
        setRun(result.run);
        setAnalysis(result.analysis);
        if (result.run.status === "completed") {
          if (previousRunStatus !== "completed") {
            setKeywords(result.keywords);
            setNextCursor(result.nextCursor);
            setFilter("");
            setNotice(`${result.run.keywordCount} keywords are ready.`);
          } else if (
            result.analysis?.status === "completed" &&
            previousAnalysisStatus !== "completed"
          ) {
            setNotice("AI insights are ready.");
          }
          return;
        }
        if (result.run.status === "failed" || result.run.status === "cancelled") {
          setNotice(result.run.errorMessage ?? "Research stopped before completion.");
          return;
        }
      } catch (error) {
        if (!stopped) setNotice(readErrorMessage(error));
      }
    }, run.status === "queued" ? 1_000 : 2_000);
    return () => {
      stopped = true;
      clearTimeout(timeout);
    };
  }, [analysis?.status, run]);

  async function submitResearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!activeProject || pending) return;
    setPending(true);
    setNotice(null);
    setAnalysis(null);
    setKeywords([]);
    setNextCursor(null);
    setFilter("");

    try {
      idempotencyKey.current ??= crypto.randomUUID();
      const result = await apiRequest<{ run: ResearchRun }>("/api/research", {
        method: "POST",
        body: JSON.stringify({
          projectId: activeProject.id,
          seed: query,
          countryCode: activeProject.countryCode,
          languageCode: activeProject.languageCode,
          device: "desktop",
          keywordLimit: 100,
          idempotencyKey: idempotencyKey.current,
        }),
      });
      idempotencyKey.current = null;
      setRun(result.run);
      setNotice("Research queued. You can keep this page open while it runs.");
    } catch (error) {
      setNotice(readErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function loadMore() {
    if (!run || nextCursor === null || pending) return;
    setPending(true);
    try {
      const result = await apiRequest<ResearchResponse>(
        `/api/research/${run.id}?after=${nextCursor}`,
      );
      setKeywords((current) => [...current, ...result.keywords]);
      setNextCursor(result.nextCursor);
    } catch (error) {
      setNotice(readErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  function selectProject(projectId: string) {
    setActiveProjectId(projectId);
    setRun(null);
    setAnalysis(null);
    setKeywords([]);
    setNextCursor(null);
    setQuery("");
    setNotice(null);
    idempotencyKey.current = null;
  }

  return (
    <div className="min-h-dvh bg-slate-50 text-slate-950">
      <header className="border-b border-slate-200 bg-white">
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
          <div>
            <p className="text-base font-bold tracking-tight">SEO Research</p>
            <p className="text-xs text-slate-500">Live keyword evidence</p>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden text-sm text-slate-600 sm:inline">
              {user.name}{user.role === "admin" ? " · Admin" : ""}
            </span>
            <button
              type="button"
              onClick={() => void signOut({ redirectTo: "/sign-in" })}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold hover:bg-slate-50"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        <nav className="mb-6 flex gap-2" aria-label="Workspace">
          <NavButton active={view === "research"} onClick={() => setView("research")}>
            Research
          </NavButton>
          <NavButton active={view === "projects"} onClick={() => setView("projects")}>
            Projects
          </NavButton>
        </nav>

        {view === "projects" ? (
          <ProjectsPanel
            projects={projects}
            onProjectsChange={setProjects}
            activeProjectId={activeProjectId}
            onSelect={(id) => {
              selectProject(id);
              setView("research");
            }}
          />
        ) : activeProjects.length === 0 ? (
          <EmptyProjects onCreate={() => setView("projects")} />
        ) : (
          <main>
            <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm sm:p-6">
              <div className="grid gap-5 md:grid-cols-[14rem_1fr]">
                <label className="block text-sm font-semibold text-slate-700">
                  Project
                  <select
                    value={activeProjectId}
                    onChange={(event) => selectProject(event.target.value)}
                    className="mt-2 w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5"
                  >
                    {activeProjects.map((project) => (
                      <option key={project.id} value={project.id}>{project.name}</option>
                    ))}
                  </select>
                </label>

                <form onSubmit={submitResearch} className="min-w-0">
                  <label className="block text-sm font-semibold text-slate-700">
                    Topic or keyword
                    <div className="mt-2 flex flex-col gap-2 sm:flex-row">
                      <input
                        value={query}
                        onChange={(event) => {
                          setQuery(event.target.value);
                          idempotencyKey.current = null;
                        }}
                        required
                        minLength={2}
                        maxLength={200}
                        placeholder="e.g. technical SEO tools"
                        className="min-w-0 flex-1 rounded-lg border border-slate-300 px-3 py-2.5"
                      />
                      <button
                        type="submit"
                        disabled={pending || !activeProject}
                        className="rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-bold text-white hover:bg-indigo-700 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        {pending ? "Starting…" : "Run research"}
                      </button>
                    </div>
                  </label>
                  <p className="mt-2 text-xs text-slate-500">
                    {activeProject?.countryCode} · {activeProject?.languageCode}
                  </p>
                </form>
              </div>
            </section>

            {notice ? (
              <p
                className="mt-4 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700"
                role="status"
                aria-live="polite"
              >
                {notice}
              </p>
            ) : null}

            {run ? (
              <ResearchResults
                run={run}
                analysis={analysis}
                keywords={filteredKeywords}
                citationKeywords={keywords}
                loadedCount={keywords.length}
                filter={filter}
                onFilter={setFilter}
                nextCursor={nextCursor}
                pending={pending}
                onLoadMore={loadMore}
              />
            ) : (
              <section className="mt-6 rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
                <h1 className="text-lg font-bold">Find keyword opportunities</h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-slate-600">
                  Enter one topic. Results appear here after the provider finishes.
                </p>
              </section>
            )}
          </main>
        )}
      </div>
    </div>
  );
}

type ResearchResponse = {
  run: ResearchRun;
  keywords: Keyword[];
  nextCursor: number | null;
  analysis: AiAnalysis | null;
};

function ResearchResults({
  run,
  analysis,
  keywords,
  citationKeywords,
  loadedCount,
  filter,
  onFilter,
  nextCursor,
  pending,
  onLoadMore,
}: {
  run: ResearchRun;
  analysis: AiAnalysis | null;
  keywords: Keyword[];
  citationKeywords: Keyword[];
  loadedCount: number;
  filter: string;
  onFilter: (value: string) => void;
  nextCursor: number | null;
  pending: boolean;
  onLoadMore: () => void;
}) {
  if (run.status === "queued" || run.status === "running") {
    return (
      <section className="mt-6 rounded-2xl border border-slate-200 bg-white p-6" aria-live="polite">
        <div className="flex items-center justify-between gap-3">
          <div>
            <h1 className="font-bold">Researching “{run.query}”</h1>
            <p className="mt-1 text-sm text-slate-600">
              {run.status === "queued" ? "Waiting for a worker" : "Fetching live keyword data"}
            </p>
          </div>
          <span className="text-sm font-semibold text-indigo-700">{run.progress}%</span>
        </div>
        <progress
          className="mt-4 h-2 w-full overflow-hidden rounded-full accent-indigo-600"
          value={run.progress}
          max={100}
          aria-label="Research progress"
        />
      </section>
    );
  }

  if (run.status === "failed" || run.status === "cancelled") {
    return (
      <section className="mt-6 rounded-2xl border border-red-200 bg-red-50 p-6" role="alert">
        <h1 className="font-bold text-red-900">Research did not complete</h1>
        <p className="mt-1 text-sm text-red-800">{run.errorMessage ?? "Try the request again."}</p>
      </section>
    );
  }

  const volumes = keywords.flatMap((keyword) => keyword.searchVolume === null ? [] : [keyword.searchVolume]);
  const averageDifficulty = average(
    keywords.flatMap((keyword) => keyword.difficulty === null ? [] : [keyword.difficulty]),
  );

  return (
    <section className="mt-6" aria-labelledby="results-title">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">Live results</p>
          <h1 id="results-title" className="mt-1 text-xl font-bold">{run.query}</h1>
          <p className="mt-1 text-sm text-slate-600">
            {run.countryCode} · {run.languageCode} · {run.keywordCount} keywords
          </p>
        </div>
        <a
          href={`/api/research/${run.id}/export`}
          className="w-fit rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-semibold hover:bg-slate-50"
        >
          Export CSV
        </a>
      </div>

      <div className="mt-4 grid gap-3 sm:grid-cols-3">
        <Metric label="Keywords" value={String(run.keywordCount)} />
        <Metric label="Loaded volume" value={formatNumber(volumes.reduce((sum, value) => sum + value, 0))} />
        <Metric label="Average difficulty" value={averageDifficulty === null ? "—" : String(Math.round(averageDifficulty))} />
      </div>

      <AnalysisCard analysis={analysis} keywords={citationKeywords} />

      <div className="mt-4 overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="flex flex-col gap-3 border-b border-slate-200 p-4 sm:flex-row sm:items-center sm:justify-between">
          <label className="text-sm font-semibold text-slate-700">
            <span className="sr-only">Filter loaded keywords</span>
            <input
              type="search"
              value={filter}
              onChange={(event) => onFilter(event.target.value)}
              placeholder="Filter loaded keywords"
              className="w-full rounded-lg border border-slate-300 px-3 py-2 sm:w-64"
            />
          </label>
          <p className="text-xs text-slate-500">{loadedCount} loaded</p>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Keyword</th>
                <th className="px-4 py-3">Intent</th>
                <th className="px-4 py-3 text-right">Volume</th>
                <th className="px-4 py-3 text-right">CPC</th>
                <th className="px-4 py-3 text-right">Difficulty</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {keywords.map((keyword) => (
                <tr key={keyword.id}>
                  <td className="max-w-md px-4 py-3 font-semibold">{keyword.keyword}</td>
                  <td className="px-4 py-3 capitalize text-slate-600">{keyword.intent}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatNumber(keyword.searchVolume)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{formatCpc(keyword.cpcMicros)}</td>
                  <td className="px-4 py-3 text-right tabular-nums">{keyword.difficulty ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {keywords.length === 0 ? (
            <p className="p-8 text-center text-sm text-slate-600">No loaded keywords match this filter.</p>
          ) : null}
        </div>
        {nextCursor !== null ? (
          <div className="border-t border-slate-200 p-4 text-center">
            <button
              type="button"
              onClick={onLoadMore}
              disabled={pending}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold disabled:opacity-60"
            >
              {pending ? "Loading…" : "Load more"}
            </button>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function AnalysisCard({
  analysis,
  keywords,
}: {
  analysis: AiAnalysis | null;
  keywords: Keyword[];
}) {
  if (!analysis) return null;

  if (analysis.status === "queued" || analysis.status === "running") {
    return (
      <section className="mt-4 rounded-2xl border border-indigo-100 bg-indigo-50 p-5" aria-live="polite">
        <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">AI insights</p>
        <h2 className="mt-1 font-bold text-slate-950">Reviewing keyword evidence</h2>
        <p className="mt-1 text-sm text-slate-600">Your keyword results are ready. Insights will appear here.</p>
      </section>
    );
  }

  if (analysis.status === "failed" || !analysis.output) {
    return (
      <section className="mt-4 rounded-2xl border border-amber-200 bg-amber-50 p-5">
        <p className="text-xs font-semibold uppercase tracking-wide text-amber-800">AI insights</p>
        <p className="mt-1 text-sm text-amber-900">
          {analysis.errorMessage ?? "Insights are unavailable. Your keyword results are unaffected."}
        </p>
      </section>
    );
  }

  const keywordLabels = new Map(keywords.map((keyword) => [`kw_${keyword.id}`, keyword.keyword]));
  const output = analysis.output;

  return (
    <section className="mt-4 rounded-2xl border border-slate-200 bg-white p-5" aria-labelledby="ai-insights-title">
      <p className="text-xs font-semibold uppercase tracking-wide text-indigo-700">AI insights</p>
      <h2 id="ai-insights-title" className="mt-1 text-lg font-bold">Evidence-backed direction</h2>
      <div className="mt-3 rounded-xl bg-slate-50 p-4">
        <p className="text-sm leading-6 text-slate-800">{output.summary.statement}</p>
        <CitationChips citationIds={output.summary.citationIds} labels={keywordLabels} />
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-3">
        <InsightList title="Opportunities" items={output.opportunitySignals} labels={keywordLabels} />
        <InsightList title="Risks" items={output.risks} labels={keywordLabels} />
        <InsightList title="Next steps" items={output.nextSteps} labels={keywordLabels} />
      </div>
      {output.missingEvidence.length > 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          Missing data: {output.missingEvidence.slice(0, 3).join("; ")}
        </p>
      ) : null}
    </section>
  );
}

function InsightList({
  title,
  items,
  labels,
}: {
  title: string;
  items: CitedStatement[];
  labels: ReadonlyMap<string, string>;
}) {
  if (items.length === 0) return null;

  return (
    <div>
      <h3 className="text-sm font-bold text-slate-900">{title}</h3>
      <ul className="mt-2 space-y-3">
        {items.slice(0, 3).map((item, index) => (
          <li key={`${title}-${index}`} className="text-sm leading-5 text-slate-700">
            {item.statement}
            <CitationChips citationIds={item.citationIds} labels={labels} />
          </li>
        ))}
      </ul>
    </div>
  );
}

function CitationChips({
  citationIds,
  labels,
}: {
  citationIds: string[];
  labels: ReadonlyMap<string, string>;
}) {
  return (
    <span className="mt-2 flex flex-wrap gap-1" aria-label="Supporting keywords">
      {citationIds.map((citationId) => (
        <span
          key={citationId}
          className="max-w-full truncate rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700"
          title={labels.get(citationId) ?? citationId}
        >
          {labels.get(citationId) ?? "Keyword evidence"}
        </span>
      ))}
    </span>
  );
}

function ProjectsPanel({
  projects,
  onProjectsChange,
  activeProjectId,
  onSelect,
}: {
  projects: Project[];
  onProjectsChange: (projects: Project[]) => void;
  activeProjectId: string;
  onSelect: (id: string) => void;
}) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  async function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    setMessage(null);
    const form = event.currentTarget;
    const fields = new FormData(form);
    try {
      const result = await apiRequest<{ project: Project }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: String(fields.get("name") ?? ""),
          targetDomain: String(fields.get("targetDomain") ?? ""),
          countryCode: "US",
          languageCode: "en",
        }),
      });
      onProjectsChange([result.project, ...projects]);
      form.reset();
      setMessage("Project created.");
    } catch (error) {
      setMessage(readErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function rename(event: FormEvent<HTMLFormElement>, project: Project) {
    event.preventDefault();
    setPending(true);
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    try {
      const result = await updateProject(project, { name });
      onProjectsChange(projects.map((item) => item.id === project.id ? result : item));
      setEditingId(null);
      setMessage("Project renamed.");
    } catch (error) {
      setMessage(readErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  async function setArchived(project: Project, archived: boolean) {
    setPending(true);
    setMessage(null);
    try {
      const result = await updateProject(project, { archived });
      onProjectsChange(projects.map((item) => item.id === project.id ? result : item));
      setMessage(archived ? "Project archived." : "Project restored.");
    } catch (error) {
      setMessage(readErrorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <main className="grid gap-6 lg:grid-cols-[21rem_1fr]">
      <section className="h-fit rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <h1 className="text-lg font-bold">New project</h1>
        <p className="mt-1 text-sm text-slate-600">Keep research grouped by website.</p>
        <form onSubmit={create} className="mt-5 space-y-4">
          <FormField label="Name" name="name" placeholder="Acme website" minLength={2} maxLength={120} />
          <FormField label="Website (optional)" name="targetDomain" placeholder="example.com" maxLength={253} required={false} />
          <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm text-slate-600">United States · English</div>
          <button
            type="submit"
            disabled={pending}
            className="w-full rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white disabled:opacity-60"
          >
            {pending ? "Saving…" : "Create project"}
          </button>
        </form>
      </section>

      <section>
        <div>
          <h1 className="text-xl font-bold">Projects</h1>
          <p className="mt-1 text-sm text-slate-600">Choose a project or archive work you no longer need.</p>
        </div>
        {message ? <p className="mt-4 text-sm text-slate-700" role="status">{message}</p> : null}
        <div className="mt-4 space-y-3">
          {projects.map((project) => (
            <article key={project.id} className="rounded-xl border border-slate-200 bg-white p-4">
              {editingId === project.id ? (
                <form onSubmit={(event) => void rename(event, project)} className="flex flex-col gap-2 sm:flex-row">
                  <label className="sr-only" htmlFor={`rename-${project.id}`}>Project name</label>
                  <input
                    id={`rename-${project.id}`}
                    name="name"
                    defaultValue={project.name}
                    required
                    minLength={2}
                    maxLength={120}
                    autoFocus
                    className="flex-1 rounded-lg border border-slate-300 px-3 py-2"
                  />
                  <button className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white">Save</button>
                  <button type="button" onClick={() => setEditingId(null)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Cancel</button>
                </form>
              ) : (
                <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-center">
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <h2 className="truncate font-bold">{project.name}</h2>
                      {project.id === activeProjectId && project.status === "active" ? (
                        <span className="rounded-full bg-indigo-50 px-2 py-0.5 text-xs font-semibold text-indigo-700">Current</span>
                      ) : null}
                    </div>
                    <p className="mt-1 truncate text-sm text-slate-500">
                      {project.targetDomain ?? "No website"} · {project.countryCode}/{project.languageCode}
                    </p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {project.status === "active" ? (
                      <>
                        <button type="button" onClick={() => onSelect(project.id)} className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-semibold text-white">Open</button>
                        <button type="button" onClick={() => setEditingId(project.id)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Rename</button>
                        <button type="button" disabled={pending} onClick={() => void setArchived(project, true)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold text-slate-700">Archive</button>
                      </>
                    ) : (
                      <button type="button" disabled={pending} onClick={() => void setArchived(project, false)} className="rounded-lg border border-slate-300 px-3 py-2 text-sm font-semibold">Restore</button>
                    )}
                  </div>
                </div>
              )}
            </article>
          ))}
          {projects.length === 0 ? <p className="rounded-xl border border-dashed border-slate-300 p-8 text-center text-sm text-slate-600">No projects yet.</p> : null}
        </div>
      </section>
    </main>
  );
}

async function updateProject(project: Project, changes: { name?: string; archived?: boolean }) {
  const result = await apiRequest<{ project: Project }>(`/api/projects/${project.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...changes, version: project.version }),
  });
  return result.project;
}

function EmptyProjects({ onCreate }: { onCreate: () => void }) {
  return (
    <main className="rounded-2xl border border-dashed border-slate-300 bg-white p-10 text-center">
      <h1 className="text-xl font-bold">Create your first project</h1>
      <p className="mx-auto mt-2 max-w-sm text-sm text-slate-600">A project stores your market and research history.</p>
      <button type="button" onClick={onCreate} className="mt-5 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-bold text-white">Create project</button>
    </main>
  );
}

function NavButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      aria-current={active ? "page" : undefined}
      onClick={onClick}
      className={`rounded-lg px-4 py-2 text-sm font-semibold ${active ? "bg-slate-900 text-white" : "text-slate-600 hover:bg-white"}`}
    >
      {children}
    </button>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function FormField({ label, required = true, ...props }: React.InputHTMLAttributes<HTMLInputElement> & { label: string }) {
  return (
    <label className="block text-sm font-semibold text-slate-700">
      {label}
      <input {...props} required={required} className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2.5 font-normal text-slate-950" />
    </label>
  );
}

async function apiRequest<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    ...init,
    headers: init?.body ? { "content-type": "application/json", ...init.headers } : init?.headers,
    cache: "no-store",
  });
  if (response.status === 401) {
    void signOut({ redirectTo: "/sign-in" });
    throw new Error("Your session expired. Sign in again.");
  }
  const body = await response.json().catch(() => ({})) as ApiError & T;
  if (!response.ok) throw new Error(body.error?.message ?? "Something went wrong. Try again.");
  return body;
}

function readErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

function average(values: number[]) {
  return values.length === 0 ? null : values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value: number | null) {
  return value === null ? "—" : new Intl.NumberFormat("en-US").format(value);
}

function formatCpc(value: number | null) {
  return value === null
    ? "—"
    : new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" }).format(value / 1_000_000);
}

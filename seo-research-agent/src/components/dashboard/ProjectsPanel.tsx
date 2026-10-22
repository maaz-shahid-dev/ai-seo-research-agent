"use client";

import { useState, type FormEvent } from "react";

import { replaceProject, updateProject } from "@/features/projects/client";
import type { ProjectDto } from "@/features/research/types";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";
import { apiRequest, errorMessage } from "@/lib/api-client";

type ProjectsPanelProps = {
  projects: ProjectDto[];
  activeProjectId: string | null;
  onProjectsChange: (update: (projects: ProjectDto[]) => ProjectDto[]) => void;
  onOpen: (projectId: string) => void;
};

export function ProjectsPanel({ projects, activeProjectId, onProjectsChange, onOpen }: ProjectsPanelProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [pending, setPending] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  /** Runs one project mutation with shared pending and message handling. */
  async function mutate(action: () => Promise<string>) {
    setPending(true);
    setMessage(null);
    try {
      setMessage(await action());
    } catch (error) {
      setMessage(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  function replace(project: ProjectDto) {
    onProjectsChange((current) => replaceProject(current, project));
  }

  function create(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const fields = new FormData(form);
    void mutate(async () => {
      const { project } = await apiRequest<{ project: ProjectDto }>("/api/projects", {
        method: "POST",
        body: JSON.stringify({
          name: String(fields.get("name") ?? ""),
          targetDomain: String(fields.get("targetDomain") ?? ""),
          countryCode: "US",
          languageCode: "en",
        }),
      });
      onProjectsChange((current) => [project, ...current]);
      form.reset();
      return "Project created.";
    });
  }

  function rename(event: FormEvent<HTMLFormElement>, project: ProjectDto) {
    event.preventDefault();
    const name = String(new FormData(event.currentTarget).get("name") ?? "");
    void mutate(async () => {
      replace(await updateProject(project, { name }));
      setEditingId(null);
      return "Project renamed.";
    });
  }

  function setArchived(project: ProjectDto, archived: boolean) {
    void mutate(async () => {
      replace(await updateProject(project, { archived }));
      return archived ? "Project archived." : "Project restored.";
    });
  }

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="rounded-xl border border-slate-200 bg-white p-5">
        <h1 className="text-base font-semibold text-slate-950">New project</h1>
        <div className="mt-4 grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
          <TextField label="Name" name="name" placeholder="Acme website" required minLength={2} maxLength={120} />
          <TextField label="Website (optional)" name="targetDomain" placeholder="example.com" maxLength={253} />
          <Button type="submit" disabled={pending}>Create project</Button>
        </div>
      </form>

      {message ? <p className="text-sm text-slate-700" role="status">{message}</p> : null}

      <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
        {projects.map((project) => (
          <li key={project.id} className="p-4">
            {editingId === project.id ? (
              <form onSubmit={(event) => rename(event, project)} className="flex flex-col gap-2 sm:flex-row">
                <TextField
                  label="Project name"
                  hideLabel
                  name="name"
                  defaultValue={project.name}
                  required
                  minLength={2}
                  maxLength={120}
                  autoFocus
                  className="flex-1"
                />
                <Button type="submit" size="sm" disabled={pending}>Save</Button>
                <Button variant="ghost" size="sm" onClick={() => setEditingId(null)}>Cancel</Button>
              </form>
            ) : (
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate font-medium text-slate-900">
                    {project.name}
                    {project.status === "archived" ? <span className="ml-2 text-xs text-slate-500">Archived</span> : null}
                  </p>
                  {project.targetDomain ? <p className="truncate text-sm text-slate-500">{project.targetDomain}</p> : null}
                </div>
                <div className="flex gap-1">
                  {project.status === "active" ? (
                    <>
                      {project.id === activeProjectId ? (
                        <span className="px-3 py-1.5 text-sm font-medium text-indigo-700">Current</span>
                      ) : (
                        <Button variant="secondary" size="sm" onClick={() => onOpen(project.id)}>Open</Button>
                      )}
                      <Button variant="ghost" size="sm" onClick={() => setEditingId(project.id)}>Rename</Button>
                      <Button variant="ghost" size="sm" disabled={pending} onClick={() => setArchived(project, true)}>
                        Archive
                      </Button>
                    </>
                  ) : (
                    <Button variant="secondary" size="sm" disabled={pending} onClick={() => setArchived(project, false)}>
                      Restore
                    </Button>
                  )}
                </div>
              </div>
            )}
          </li>
        ))}
        {projects.length === 0 ? <li className="p-6 text-center text-sm text-slate-500">No projects yet.</li> : null}
      </ul>
    </div>
  );
}

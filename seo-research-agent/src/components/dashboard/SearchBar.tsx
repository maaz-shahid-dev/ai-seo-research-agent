"use client";

import { Loader2, Search } from "lucide-react";
import type { FormEvent } from "react";

import type { ProjectDto } from "@/features/research/types";
import { Button } from "@/components/ui/Button";
import { TextField } from "@/components/ui/TextField";

type SearchBarProps = {
  query: string;
  onQueryChange: (value: string) => void;
  onSubmit: () => void;
  pending: boolean;
  projects: ProjectDto[];
  projectId: string;
  onProjectChange: (projectId: string) => void;
};

export function SearchBar({
  query,
  onQueryChange,
  onSubmit,
  pending,
  projects,
  projectId,
  onProjectChange,
}: SearchBarProps) {
  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onSubmit();
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-2 sm:flex-row">
      {projects.length > 1 ? (
        <div className="sm:w-48">
          <label htmlFor="project" className="sr-only">Project</label>
          <select
            id="project"
            value={projectId}
            onChange={(event) => onProjectChange(event.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2.5 text-sm"
          >
            {projects.map((project) => (
              <option key={project.id} value={project.id}>{project.name}</option>
            ))}
          </select>
        </div>
      ) : null}
      <TextField
        label="Topic or keyword"
        hideLabel
        className="min-w-0 flex-1"
        value={query}
        onChange={(event) => onQueryChange(event.target.value)}
        required
        minLength={2}
        maxLength={200}
        placeholder="Enter a topic, e.g. running shoes"
        autoComplete="off"
      />
      <Button type="submit" disabled={pending}>
        {pending
          ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          : <Search className="h-4 w-4" aria-hidden="true" />}
        Search
      </Button>
    </form>
  );
}

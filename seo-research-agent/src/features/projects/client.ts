import type { ProjectDto } from "@/features/research/types";
import { apiRequest } from "@/lib/api-client";

export type ProjectChanges = { name?: string; targetDomain?: string; archived?: boolean };

/** PATCHes a project with optimistic versioning; a stale version returns 409. */
export async function updateProject(project: ProjectDto, changes: ProjectChanges) {
  const { project: updated } = await apiRequest<{ project: ProjectDto }>(`/api/projects/${project.id}`, {
    method: "PATCH",
    body: JSON.stringify({ ...changes, version: project.version }),
  });
  return updated;
}

/** Returns the list with `updated` replacing the project that has the same id. */
export function replaceProject(projects: ProjectDto[], updated: ProjectDto) {
  return projects.map((item) => (item.id === updated.id ? updated : item));
}

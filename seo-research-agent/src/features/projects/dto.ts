import type { Project } from "@/server/db/schema";

export function toProjectDto(project: Project) {
  return {
    id: project.id,
    name: project.name,
    targetDomain: project.targetDomain,
    description: project.description,
    countryCode: project.defaultCountryCode,
    languageCode: project.defaultLanguageCode,
    status: project.status,
    version: project.version,
    createdAt: project.createdAt.toISOString(),
    updatedAt: project.updatedAt.toISOString(),
  };
}

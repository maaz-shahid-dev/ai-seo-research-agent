import { and, desc, eq, lt, or, sql } from "drizzle-orm";

import type { DatabaseClient } from "../client";
import { projects } from "../schema";

export type CreateProjectInput = {
  name: string;
  targetDomain?: string | null;
  description?: string | null;
  defaultCountryCode?: string;
  defaultLanguageCode?: string;
};

export type UpdateProjectInput = Partial<
  Omit<CreateProjectInput, "defaultCountryCode" | "defaultLanguageCode"> & {
    defaultCountryCode: string;
    defaultLanguageCode: string;
    status: "active" | "archived";
  }
>;

export type ProjectCursor = {
  updatedAt: Date;
  id: string;
};

export async function createProject(
  database: DatabaseClient,
  ownerIdInput: string,
  input: CreateProjectInput,
) {
  const ownerId = ownerIdInput;
  const [project] = await database
    .insert(projects)
    .values({
      ownerId,
      name: input.name.trim(),
      targetDomain: input.targetDomain?.trim().toLowerCase() || null,
      description: input.description?.trim() || null,
      defaultCountryCode: input.defaultCountryCode?.trim().toUpperCase() ?? "US",
      defaultLanguageCode: input.defaultLanguageCode?.trim() ?? "en",
    })
    .returning();

  if (!project) {
    throw new Error("The project could not be created.");
  }

  return project;
}

export async function getProjectById(
  database: DatabaseClient,
  ownerIdInput: string,
  projectIdInput: string,
) {
  const ownerId = ownerIdInput;
  const projectId = projectIdInput;
  const [project] = await database
    .select()
    .from(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .limit(1);
  return project ?? null;
}

export async function listProjects(
  database: DatabaseClient,
  ownerIdInput: string,
  options: { cursor?: ProjectCursor; limit?: number; status?: "active" | "archived" } = {},
) {
  const ownerId = ownerIdInput;
  const limit = boundedLimit(options.limit, 25, 100);
  const cursor = options.cursor;
  const conditions = [eq(projects.ownerId, ownerId)];

  if (options.status) {
    conditions.push(eq(projects.status, options.status));
  }
  if (cursor) {
    conditions.push(
      or(
        lt(projects.updatedAt, cursor.updatedAt),
        and(eq(projects.updatedAt, cursor.updatedAt), lt(projects.id, cursor.id)),
      )!,
    );
  }

  const rows = await database
    .select()
    .from(projects)
    .where(and(...conditions))
    .orderBy(desc(projects.updatedAt), desc(projects.id))
    .limit(limit + 1);
  const hasMore = rows.length > limit;
  const items = hasMore ? rows.slice(0, limit) : rows;
  const last = items.at(-1);

  return {
    items,
    nextCursor:
      hasMore && last
        ? {
            updatedAt: last.updatedAt,
            id: last.id,
          }
        : null,
  };
}

export async function updateProject(
  database: DatabaseClient,
  ownerIdInput: string,
  projectIdInput: string,
  expectedVersionInput: number,
  input: UpdateProjectInput,
) {
  const ownerId = ownerIdInput;
  const projectId = projectIdInput;
  const expectedVersion = expectedVersionInput;
  const value = {
    ...(input.name !== undefined ? { name: input.name.trim() } : {}),
    ...(input.targetDomain !== undefined
      ? { targetDomain: input.targetDomain?.trim().toLowerCase() || null }
      : {}),
    ...(input.description !== undefined
      ? { description: input.description?.trim() || null }
      : {}),
    ...(input.defaultCountryCode !== undefined
      ? { defaultCountryCode: input.defaultCountryCode.trim().toUpperCase() }
      : {}),
    ...(input.defaultLanguageCode !== undefined
      ? { defaultLanguageCode: input.defaultLanguageCode.trim() }
      : {}),
    ...(input.status !== undefined ? { status: input.status } : {}),
  };
  const [project] = await database
    .update(projects)
    .set({
      ...value,
      updatedAt: new Date(),
      version: sql`${projects.version} + 1`,
    })
    .where(
      and(
        eq(projects.id, projectId),
        eq(projects.ownerId, ownerId),
        eq(projects.version, expectedVersion),
      ),
    )
    .returning();

  return project ?? null;
}

export async function archiveProject(
  database: DatabaseClient,
  ownerId: string,
  projectId: string,
  expectedVersion: number,
) {
  return updateProject(database, ownerId, projectId, expectedVersion, { status: "archived" });
}

/** Reserved for an explicitly authorized permanent-deletion workflow. */
export async function purgeProject(
  database: DatabaseClient,
  ownerIdInput: string,
  projectIdInput: string,
) {
  const ownerId = ownerIdInput;
  const projectId = projectIdInput;
  const [deleted] = await database
    .delete(projects)
    .where(and(eq(projects.id, projectId), eq(projects.ownerId, ownerId)))
    .returning({ id: projects.id });
  return deleted !== undefined;
}

function boundedLimit(value: number | undefined, fallback: number, maximum: number) {
  return Number.isSafeInteger(value) ? Math.min(Math.max(value!, 1), maximum) : fallback;
}

import { Suspense } from "react";
import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { APP_VIEWS } from "@/lib/app-views";
import { WorkspaceSkeleton } from "@/components/dashboard/WorkspaceSkeleton";
import { toProjectDto } from "@/features/projects/dto";
import { researchRunIdSchema } from "@/features/research/schemas";
import { requireActiveUser } from "@/server/auth";
import { isDemoMode } from "@/server/config/environment-schema";
import { getDatabase } from "@/server/db/client";
import { ensureDefaultProject, getUserSettings, listProjects } from "@/server/db/repositories";
import { AppError } from "@/server/http/errors";
import { pick } from "@/lib/url-state";

type SearchParams = Promise<Record<string, string | string[] | undefined>>;

export default function HomePage({ searchParams }: { searchParams: SearchParams }) {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AuthenticatedDashboard searchParams={searchParams} />
    </Suspense>
  );
}

async function AuthenticatedDashboard({ searchParams }: { searchParams: SearchParams }) {
  let user;
  try {
    user = await requireActiveUser();
  } catch (error) {
    if (error instanceof AppError && error.code === "UNAUTHENTICATED") redirect("/sign-in");
    throw error;
  }

  const database = getDatabase();
  let projects = await listProjects(database, user.id, { limit: 100 });
  if (projects.items.length === 0) {
    await ensureDefaultProject(database, user.id);
    projects = await listProjects(database, user.id, { limit: 100 });
  }

  const settings = await getUserSettings(database, user.id);
  if (!settings) redirect("/sign-in");

  // Shared links reopen the same screen and search; anything invalid is ignored.
  const params = await searchParams;
  const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value) ?? null;
  const run = researchRunIdSchema.safeParse(first(params.run));

  return (
    <DashboardClient
      initialSettings={settings}
      initialView={pick(first(params.view), APP_VIEWS, "research")}
      initialRunId={run.success ? run.data : null}
      user={{ name: user.displayName }}
      initialProjects={projects.items.map(toProjectDto)}
      demo={isDemoMode(process.env)}
    />
  );
}

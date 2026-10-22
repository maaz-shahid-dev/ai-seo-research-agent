import { Suspense } from "react";
import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { WorkspaceSkeleton } from "@/components/dashboard/WorkspaceSkeleton";
import { toProjectDto } from "@/features/projects/dto";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { ensureDefaultProject, listProjects } from "@/server/db/repositories";
import { AppError } from "@/server/http/errors";

export default function HomePage() {
  return (
    <Suspense fallback={<WorkspaceSkeleton />}>
      <AuthenticatedDashboard />
    </Suspense>
  );
}

async function AuthenticatedDashboard() {
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

  return (
    <DashboardClient
      user={{ name: user.displayName }}
      initialProjects={projects.items.map(toProjectDto)}
    />
  );
}

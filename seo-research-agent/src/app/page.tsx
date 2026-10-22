import { Suspense } from "react";
import { redirect } from "next/navigation";

import { DashboardClient } from "@/components/dashboard/DashboardClient";
import { toProjectDto } from "@/features/projects/dto";
import { requireActiveUser } from "@/server/auth";
import { getDatabase } from "@/server/db/client";
import { ensureDefaultProject, listProjects } from "@/server/db/repositories";
import { AppError } from "@/server/http/errors";

export default function HomePage() {
  return (
    <Suspense fallback={<DashboardSkeleton />}>
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
      user={{ name: user.displayName, role: user.role }}
      initialProjects={projects.items.map(toProjectDto)}
    />
  );
}

function DashboardSkeleton() {
  return (
    <main className="min-h-dvh bg-slate-50 p-6" aria-busy="true" aria-label="Loading workspace">
      <div className="mx-auto h-16 max-w-6xl animate-pulse rounded-xl bg-slate-200" />
      <div className="mx-auto mt-6 h-80 max-w-6xl animate-pulse rounded-2xl bg-white" />
    </main>
  );
}

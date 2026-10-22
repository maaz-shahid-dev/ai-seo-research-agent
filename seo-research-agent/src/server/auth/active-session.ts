import "server-only";

import type { Session } from "next-auth";

import type { DatabaseClient } from "@/server/db/client";
import { findUserById } from "@/server/db/repositories/users";
import { AppError } from "@/server/http/errors";

export type ActiveUser = NonNullable<Awaited<ReturnType<typeof findUserById>>> & {
  status: "active";
};

export async function requireActiveUserFromSession(
  session: Session | null,
  database: DatabaseClient,
  loadUser: typeof findUserById = findUserById,
): Promise<ActiveUser> {
  const identity = session?.user;
  if (!identity?.id || identity.status !== "active") {
    throw unauthenticatedError();
  }

  const user = await loadUser(database, identity.id);
  if (
    !user ||
    user.status !== "active" ||
    user.sessionVersion !== identity.sessionVersion
  ) {
    throw unauthenticatedError();
  }

  return user as ActiveUser;
}

function unauthenticatedError() {
  return new AppError("Sign in to continue.", "UNAUTHENTICATED", 401, false);
}

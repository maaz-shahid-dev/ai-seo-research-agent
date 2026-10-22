import "server-only";

import { auth } from "@/auth";
import { getDatabase } from "@/server/db/client";
import { AppError } from "@/server/http/errors";
import { requireActiveUserFromSession, type ActiveUser } from "./active-session";

export { requireActiveUserFromSession, type ActiveUser } from "./active-session";

/**
 * Revalidates the encrypted JWT against current database state. Sensitive
 * handlers should use this rather than trusting token claims on their own.
 */
export async function requireActiveUser(): Promise<ActiveUser> {
  return requireActiveUserFromSession(await auth(), getDatabase());
}

export async function requireAdminUser() {
  const user = await requireActiveUser();
  if (user.role !== "admin") {
    throw new AppError("You do not have access to this resource.", "FORBIDDEN", 403, false);
  }
  return user;
}

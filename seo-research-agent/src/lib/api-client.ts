import { signOut } from "next-auth/react";

const FALLBACK_MESSAGE = "Something went wrong. Try again.";

/** An API failure with the HTTP status (0 for network errors). */
export class ApiError extends Error {
  constructor(message: string, public readonly status: number) {
    super(message);
    this.name = "ApiError";
  }

  /** Network failures, timeouts, rate limits and server errors may succeed later. */
  get retryable() {
    return this.status === 0 || this.status === 408 || this.status === 429 || this.status >= 500;
  }
}

/** Fetches a same-origin JSON API and surfaces the server's user-safe message. */
export async function apiRequest<T>(url: string, init: RequestInit = {}): Promise<T> {
  let response: Response;
  try {
    response = await fetch(url, {
      ...init,
      headers: init.body ? { "content-type": "application/json", ...init.headers } : init.headers,
      cache: "no-store",
    });
  } catch (error) {
    if (init.signal?.aborted) throw error;
    throw new ApiError("Can't reach the server. Check your connection.", 0);
  }

  if (response.status === 401) {
    void signOut({ redirectTo: "/sign-in" });
    throw new ApiError("Your session expired. Sign in again.", 401);
  }

  const body = (await response.json().catch(() => ({}))) as { error?: { message?: string } };
  if (!response.ok) {
    throw new ApiError(body.error?.message ?? FALLBACK_MESSAGE, response.status);
  }
  return body as T;
}

export function errorMessage(error: unknown) {
  return error instanceof Error && error.message ? error.message : FALLBACK_MESSAGE;
}

export function isAbortError(error: unknown) {
  return error instanceof DOMException && error.name === "AbortError";
}

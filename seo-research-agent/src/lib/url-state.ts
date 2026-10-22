/**
 * Mirrors small bits of view state into the query string so a view survives
 * a refresh and can be shared. Values are read back through `pick`, so a
 * tampered URL can only select from known options.
 */

export function readParam(name: string): string | null {
  if (typeof window === "undefined") return null;
  return new URLSearchParams(window.location.search).get(name);
}

/** Returns the param when it is one of `allowed`, otherwise `fallback`. */
export function pick<T extends string>(value: string | null, allowed: readonly T[], fallback: T): T {
  return value !== null && (allowed as readonly string[]).includes(value) ? (value as T) : fallback;
}

/** Sets or removes params without adding history entries or reloading. */
export function writeParams(updates: Record<string, string | null>) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  for (const [name, value] of Object.entries(updates)) {
    if (value === null || value === "") url.searchParams.delete(name);
    else url.searchParams.set(name, value);
  }
  if (url.href !== window.location.href) window.history.replaceState(window.history.state, "", url);
}

/** Helpers shared by job tables that use worker leases (AI, SERP, content gap). */

export const DEFAULT_LEASE_DURATION_MS = 5 * 60_000;

/** Collapses whitespace and truncates by code point; throws when empty. */
export function normalizeBoundedText(value: string, maximum: number, label: string) {
  const normalized = value.trim().replace(/\s+/g, " ");
  if (normalized.length < 1) throw new TypeError(`${label} is required.`);
  return [...normalized].slice(0, maximum).join("");
}

export function normalizeWorkerId(value: string) {
  return normalizeBoundedText(value, 160, "Worker ID");
}

/** Lease end time, clamped to 30 seconds–15 minutes. */
export function leaseExpiry(now: Date, durationMs = DEFAULT_LEASE_DURATION_MS) {
  const bounded = Number.isFinite(durationMs)
    ? Math.min(Math.max(Math.trunc(durationMs), 30_000), 15 * 60_000)
    : DEFAULT_LEASE_DURATION_MS;
  return new Date(now.getTime() + bounded);
}

export function assertVersion(version: number) {
  if (!Number.isSafeInteger(version) || version < 1) {
    throw new TypeError("Job version must be a positive integer.");
  }
}

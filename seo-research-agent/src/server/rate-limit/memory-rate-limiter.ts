export type RateLimiter = {
  limit(identifier: string): Promise<{ success: boolean }>;
};

/** Prune expired windows once the map grows past this many identifiers. */
const PRUNE_THRESHOLD = 1_000;

/**
 * Fixed-window counter kept in process memory. For local development only:
 * it is not shared between server instances, so production must use Upstash
 * (enforced by `usesInMemoryRateLimit`).
 */
export function createMemoryRateLimiter(
  requests: number,
  windowMs: number,
  now: () => number = Date.now,
): RateLimiter {
  const windows = new Map<string, { count: number; resetAt: number }>();

  return {
    async limit(identifier) {
      const time = now();
      if (windows.size > PRUNE_THRESHOLD) {
        for (const [key, window] of windows) if (window.resetAt <= time) windows.delete(key);
      }

      const current = windows.get(identifier);
      const window = current && current.resetAt > time ? current : { count: 0, resetAt: time + windowMs };
      window.count += 1;
      windows.set(identifier, window);
      return { success: window.count <= requests };
    },
  };
}

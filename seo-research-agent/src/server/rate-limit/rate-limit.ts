import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { getUpstashEnvironment } from "@/server/config/environment";
import { AppError } from "@/server/http/errors";

type LimitKind = "sign-in-ip" | "sign-in-account" | "registration" | "research" | "analysis";

type LimitDefinition = {
  requests: number;
  window: Parameters<typeof Ratelimit.slidingWindow>[1];
};

const definitions: Record<LimitKind, LimitDefinition> = {
  "sign-in-ip": { requests: 20, window: "10 m" },
  "sign-in-account": { requests: 10, window: "10 m" },
  registration: { requests: 5, window: "1 h" },
  research: { requests: 20, window: "1 h" },
  analysis: { requests: 10, window: "1 h" },
};

let rateLimiters: Partial<Record<LimitKind, Ratelimit>> = {};

export async function enforceRateLimit(kind: LimitKind, identifier: string) {
  const normalizedIdentifier = identifier.trim().slice(0, 256) || "unknown";

  try {
    const result = await getRateLimiter(kind).limit(normalizedIdentifier);
    if (!result.success) {
      throw new AppError("Too many requests. Try again later.", "RATE_LIMITED", 429, true);
    }

    return result;
  } catch (error) {
    if (error instanceof AppError) throw error;
    throw new AppError(
      "This action is temporarily unavailable. Try again shortly.",
      "RATE_LIMIT_UNAVAILABLE",
      503,
      true,
      { cause: error },
    );
  }
}

function getRateLimiter(kind: LimitKind) {
  const existing = rateLimiters[kind];
  if (existing) return existing;

  const environment = getUpstashEnvironment();
  const definition = definitions[kind];
  const limiter = new Ratelimit({
    redis: new Redis({
      url: environment.UPSTASH_REDIS_REST_URL,
      token: environment.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(definition.requests, definition.window),
    prefix: `seo-research-agent:${kind}`,
    analytics: true,
    timeout: 1_500,
  });

  rateLimiters = { ...rateLimiters, [kind]: limiter };
  return limiter;
}

export function resetRateLimitersForTests() {
  if (process.env.NODE_ENV !== "test") return;
  rateLimiters = {};
}

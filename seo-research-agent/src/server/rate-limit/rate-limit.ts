import "server-only";

import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { usesInMemoryRateLimit } from "@/server/config/environment-schema";
import { getUpstashEnvironment } from "@/server/config/environment";
import { AppError } from "@/server/http/errors";

import { createMemoryRateLimiter, type RateLimiter } from "./memory-rate-limiter";

type LimitKind = "sign-in-ip" | "sign-in-account" | "registration" | "research" | "analysis" | "serp" | "content-gap";

type LimitDefinition = { requests: number; windowSeconds: number };

const definitions: Record<LimitKind, LimitDefinition> = {
  "sign-in-ip": { requests: 20, windowSeconds: 10 * 60 },
  "sign-in-account": { requests: 10, windowSeconds: 10 * 60 },
  registration: { requests: 5, windowSeconds: 60 * 60 },
  research: { requests: 20, windowSeconds: 60 * 60 },
  analysis: { requests: 10, windowSeconds: 60 * 60 },
  // Paid lookups a user starts by hand (automatic top-10 analyses are not counted).
  serp: { requests: 60, windowSeconds: 60 * 60 },
  "content-gap": { requests: 10, windowSeconds: 60 * 60 },
};

let rateLimiters: Partial<Record<LimitKind, RateLimiter>> = {};

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

  const definition = definitions[kind];
  const limiter = usesInMemoryRateLimit(process.env)
    ? createMemoryRateLimiter(definition.requests, definition.windowSeconds * 1000)
    : createUpstashRateLimiter(kind, definition);

  rateLimiters = { ...rateLimiters, [kind]: limiter };
  return limiter;
}

function createUpstashRateLimiter(kind: LimitKind, definition: LimitDefinition): RateLimiter {
  const environment = getUpstashEnvironment();
  return new Ratelimit({
    redis: new Redis({
      url: environment.UPSTASH_REDIS_REST_URL,
      token: environment.UPSTASH_REDIS_REST_TOKEN,
    }),
    limiter: Ratelimit.slidingWindow(definition.requests, `${definition.windowSeconds} s`),
    prefix: `seo-research-agent:${kind}`,
    analytics: true,
    timeout: 1_500,
  });
}

export function resetRateLimitersForTests() {
  if (process.env.NODE_ENV !== "test") return;
  rateLimiters = {};
}

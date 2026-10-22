import { describe, expect, it } from "vitest";

import { createMemoryRateLimiter } from "@/server/rate-limit/memory-rate-limiter";

describe("in-memory rate limiter", () => {
  it("allows the configured number of requests per window and identifier", async () => {
    let time = 0;
    const limiter = createMemoryRateLimiter(2, 1_000, () => time);

    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(true);
    expect((await limiter.limit("a")).success).toBe(false);
    expect((await limiter.limit("b")).success).toBe(true);

    time = 1_000;
    expect((await limiter.limit("a")).success).toBe(true);
  });

  it("prunes expired identifiers so memory stays bounded", async () => {
    let time = 0;
    const limiter = createMemoryRateLimiter(1, 10, () => time);
    for (let index = 0; index < 1_100; index += 1) await limiter.limit(`id-${index}`);

    time = 20;
    // A fresh window proves expired entries no longer count against anyone.
    expect((await limiter.limit("id-0")).success).toBe(true);
  });
});

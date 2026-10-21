import { describe, expect, it } from "vitest";
import { createProjectSchema, targetDomainSchema, updateProjectSchema } from "@/features/projects/schemas";
import { idempotencyKeySchema, normalizeKeyword, researchRequestSchema } from "@/features/research/schemas";

describe("project input", () => {
  it("normalizes a minimal project and keeps the domain optional", () => {
    const project = createProjectSchema.parse({
      name: "  Docs launch  ",
      countryCode: "us",
      languageCode: "en",
    });

    expect(project).toEqual({
      name: "Docs launch",
      countryCode: "US",
      languageCode: "en",
      targetDomain: null,
    });
  });

  it.each(["localhost", "127.0.0.1", "ftp://example.com", "https://user:pass@example.com"])(
    "rejects non-public or unsafe target domains: %s",
    (domain) => expect(targetDomainSchema.safeParse(domain).success).toBe(false),
  );

  it("normalizes a valid URL to its hostname", () => {
    expect(targetDomainSchema.parse("https://WWW.Example.com/path?q=1")).toBe("www.example.com");
  });

  it("requires a version and at least one actual update", () => {
    expect(updateProjectSchema.safeParse({ version: 2 }).success).toBe(false);
    expect(updateProjectSchema.safeParse({ version: 2, archived: true }).success).toBe(true);
  });
});

describe("research input", () => {
  it("normalizes context while preserving a bounded seed", () => {
    const request = researchRequestSchema.parse({
      projectId: "3f4e32db-9a5f-45dc-afce-d482c4566f18",
      seed: "  Technical SEO  ",
      countryCode: "gb",
      languageCode: "en-GB",
    });

    expect(request).toMatchObject({ seed: "Technical SEO", countryCode: "GB", keywordLimit: 100 });
    expect(normalizeKeyword("  Technical   SEO ")).toBe("technical seo");
  });

  it("rejects unbounded research and weak idempotency keys", () => {
    expect(
      researchRequestSchema.safeParse({
        projectId: "3f4e32db-9a5f-45dc-afce-d482c4566f18",
        seed: "seo",
        countryCode: "US",
        languageCode: "en",
        keywordLimit: 10_000,
      }).success,
    ).toBe(false);
    expect(idempotencyKeySchema.safeParse("short").success).toBe(false);
  });
});

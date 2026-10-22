import { describe, expect, it } from "vitest";
import { createSecurityHeaders } from "@/server/security/headers";
import { getClientAddress, isSameOriginMutation } from "@/server/security/request";

describe("security headers", () => {
  it("adds production transport and browser protections", () => {
    const headers = new Map(createSecurityHeaders(true).map(({ key, value }) => [key, value]));

    expect(headers.get("Strict-Transport-Security")).toContain("includeSubDomains");
    expect(headers.get("Content-Security-Policy")).toContain("frame-ancestors 'none'");
    expect(headers.get("Content-Security-Policy")).not.toContain("'unsafe-eval'");
    expect(headers.get("X-Content-Type-Options")).toBe("nosniff");
  });

  it("allows source maps only in the development policy", () => {
    const csp = createSecurityHeaders(false).find(({ key }) => key === "Content-Security-Policy")?.value;
    expect(csp).toContain("'unsafe-eval'");
  });

  it("uses a strict nonce policy for rendered pages", () => {
    const csp = createSecurityHeaders(true, "test-nonce")
      .find(({ key }) => key === "Content-Security-Policy")?.value;
    expect(csp).toContain("script-src 'self' 'nonce-test-nonce' 'strict-dynamic'");
    expect(csp).toContain("style-src 'self' 'nonce-test-nonce'");
    expect(csp).not.toContain("'unsafe-inline'");
  });
});

describe("mutation request checks", () => {
  it("accepts a same-origin browser mutation", () => {
    const request = new Request("https://app.example.com/api/projects", {
      method: "POST",
      headers: { origin: "https://app.example.com", "sec-fetch-site": "same-origin" },
    });

    expect(isSameOriginMutation(request)).toBe(true);
  });

  it("rejects missing and cross-site origins", () => {
    expect(isSameOriginMutation(new Request("https://app.example.com/api/projects"))).toBe(false);

    const crossSite = new Request("https://app.example.com/api/projects", {
      headers: { origin: "https://evil.example", "sec-fetch-site": "cross-site" },
    });
    expect(isSameOriginMutation(crossSite)).toBe(false);
  });

  it("uses only the first bounded forwarded address", () => {
    const request = new Request("https://app.example.com", {
      headers: { "x-forwarded-for": "203.0.113.9, 10.0.0.2" },
    });
    expect(getClientAddress(request)).toBe("203.0.113.9");
  });
});

import { describe, expect, it } from "vitest";

import { isHomepageUrl, normalizeHostname, registrableDomain } from "@/features/research/domains";

describe("domains", () => {
  it.each([
    ["en.wikipedia.org", "wikipedia.org"],
    ["WWW.Nike.com", "nike.com"],
    ["news.bbc.co.uk", "bbc.co.uk"],
    ["bbc.co.uk", "bbc.co.uk"],
    ["shop.example.com.au", "example.com.au"],
    ["co.uk", "co.uk"],
    ["example.com.", "example.com"],
  ])("finds the registrable domain of %s", (host, expected) => {
    expect(registrableDomain(host)).toBe(expected);
  });

  it("rejects things that aren't hostnames", () => {
    expect(normalizeHostname("localhost")).toBeNull();
    expect(normalizeHostname("bad host.com")).toBeNull();
    expect(registrableDomain("")).toBeNull();
  });

  it.each([
    ["https://beardeddragon.org/", true],
    ["https://www.beardeddragon.org", true],
    ["https://beardeddragon.org/care", false],
    ["https://beardeddragon.org/?ref=x", false],
    ["https://blog.example.com/", false],
    ["not a url", false],
  ])("detects dedicated-site homepages: %s", (url, expected) => {
    expect(isHomepageUrl(url)).toBe(expected);
  });
});

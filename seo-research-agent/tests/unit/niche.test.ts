import { describe, expect, it } from "vitest";

import {
  classifySite,
  competitionLevel,
  findWeakSpots,
  isQuestionKeyword,
  nicheScore,
  type SerpSiteMetrics,
} from "@/features/research/niche";

const strong: SerpSiteMetrics = { domain: "nike.com", authority: 92, monthlyTraffic: 5_000_000, domainAgeYears: 25 };

describe("site classification", () => {
  it.each([
    ["reddit.com", "forum"],
    ["www.reddit.com", "forum"],
    ["old.reddit.com", "forum"],
    ["quora.com", "qa"],
    ["cooking.stackexchange.com", "qa"],
    ["pinterest.com", "social"],
    ["youtube.com", "video"],
    ["someone.medium.com", "blog-platform"],
    ["forum.runnersworld.com", "forum"],
    ["nike.com", "other"],
    ["notreddit.com", "other"],
  ])("classifies %s as %s", (domain, type) => {
    expect(classifySite(domain)).toBe(type);
  });
});

describe("weak spots", () => {
  it("finds nothing on an established brand", () => {
    expect(findWeakSpots(strong)).toEqual([]);
  });

  it("lists every reason a result is beatable", () => {
    expect(findWeakSpots({ domain: "reddit.com", authority: 15, monthlyTraffic: 400, domainAgeYears: 1 }))
      .toEqual(["forum", "low-authority", "new-site", "low-traffic"]);
  });

  it("uses inclusive and exclusive thresholds and ignores missing metrics", () => {
    expect(findWeakSpots({ domain: "a.com", authority: 20, monthlyTraffic: 1_000, domainAgeYears: 2 }))
      .toEqual(["low-authority"]);
    expect(findWeakSpots({ domain: "a.com", authority: null, monthlyTraffic: null, domainAgeYears: null }))
      .toEqual([]);
  });
});

describe("niche score", () => {
  const weak: SerpSiteMetrics = { domain: "smallblog.com", authority: 10, monthlyTraffic: 2_000, domainAgeYears: 5 };

  it("combines easiness and weak top-10 results", () => {
    expect(nicheScore(30, [weak, weak, strong])).toBe(55); // 70/2 + 40/2
    expect(nicheScore(0, Array(5).fill(weak))).toBe(100);
    expect(nicheScore(100, [strong])).toBe(0);
  });

  it("counts only the top 10 and caps weakness at 100", () => {
    expect(nicheScore(50, [...Array(10).fill(strong), weak])).toBe(25);
    expect(nicheScore(50, Array(8).fill(weak))).toBe(75);
  });

  it("treats unknown difficulty as average and clamps bad values", () => {
    expect(nicheScore(null, [])).toBe(25);
    expect(nicheScore(140, [])).toBe(0);
  });
});

describe("keyword helpers", () => {
  it.each([
    ["how to choose running shoes", true],
    ["What are zero drop shoes", true],
    ["are running shoes worth it", true],
    ["running shoes for flat feet?", true],
    ["running shoes", false],
    ["however running", false],
  ])("detects questions: %s", (keyword, expected) => {
    expect(isQuestionKeyword(keyword)).toBe(expected);
  });

  it("maps competition to a level", () => {
    expect(competitionLevel(null)).toBeNull();
    expect(competitionLevel(0.1)).toBe("Low");
    expect(competitionLevel(0.5)).toBe("Medium");
    expect(competitionLevel(0.9)).toBe("High");
  });
});

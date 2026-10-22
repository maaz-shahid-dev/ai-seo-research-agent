import { describe, expect, it } from "vitest";

import { buildBlueprint, domainIdeas, launchSteps, titleCase } from "@/features/research/blueprint";
import { classifyNicheType, NICHE_TYPE_PROFILES, NICHE_TYPES } from "@/features/research/niche-types";

describe("niche type classification", () => {
  it.each([
    ["ai agents for small business", "ai"],
    ["chatgpt prompts for teachers", "ai"],
    ["wild rift apk guide", "apps"],
    ["android app for budgeting", "apps"],
    ["mortgage calculator", "tools"],
    ["pdf to word converter", "tools"],
    ["crm for freelancers", "saas"],
    ["project management software", "saas"],
    ["dog grooming near me", "local"],
    ["best robot vacuum for pet hair", "affiliate"],
    ["sourdough starter problems", "info"],
  ] as const)("classifies %s as %s", (seed, type) => {
    expect(classifyNicheType(seed)).toBe(type);
  });

  it("uses keyword intent when the topic has no explicit signal", () => {
    const commercial = Array.from({ length: 6 }, (_, i) => ({ keyword: `robot vacuum ${i}`, intent: "commercial" }));
    expect(classifyNicheType("robot vacuums", commercial)).toBe("affiliate");
    expect(classifyNicheType("robot vacuums", [{ keyword: "how do robot vacuums work", intent: "informational" }])).toBe("info");
  });

  it("has a complete profile for every type", () => {
    for (const type of NICHE_TYPES) {
      const profile = NICHE_TYPE_PROFILES[type];
      expect(profile.label).toBeTruthy();
      expect(profile.rpmUsd).toBeGreaterThan(0);
      expect(profile.monetization.length).toBeGreaterThan(0);
      expect(profile.strategy.length).toBeGreaterThan(0);
    }
    expect(NICHE_TYPE_PROFILES.apps.cautions.join(" ")).toMatch(/modded|cracked/);
  });
});

describe("launch blueprint", () => {
  const kw = (keyword: string, searchVolume: number, difficulty: number | null, intent = "informational") => ({ keyword, searchVolume, difficulty, intent });
  const keywords = [
    kw("bearded dragon tank setup", 9_000, 45),
    kw("how to set up a bearded dragon tank", 2_000, 20),
    kw("how to heat a bearded dragon tank", 900, 18),
    kw("best bearded dragon tank", 3_000, 38, "commercial"),
    kw("best bearded dragon tank size", 1_200, 25, "commercial"),
    kw("bearded dragon tank vs terrarium", 400, 22, "commercial"),
    kw("bearded dragon tank decor ideas", 700, 15),
  ];
  const blueprint = buildBlueprint("Bearded Dragon Tank Setup", keywords, "info");

  it("builds a pillar-first structure with silos and clean URLs", () => {
    const pillar = blueprint.briefs.find((brief) => brief.articleType === "pillar")!;
    expect(pillar).toMatchObject({ title: "Bearded Dragon Tank Setup: The Complete Guide", url: "/bearded-dragon-tank-setup", wordCount: 3000 });
    expect(blueprint.silos[0]!.name).toBe("Start here");
    for (const brief of blueprint.briefs) expect(brief.url).toMatch(/^\/[a-z0-9/-]+$/);
    expect(blueprint.totals.articles).toBe(blueprint.briefs.length);
  });

  it("writes briefs with keywords, outline, questions and internal links", () => {
    const howTo = blueprint.briefs.find((brief) => brief.articleType === "how-to")!;
    expect(howTo.outline[0]).toBe("What you need");
    expect(howTo.internalLinks[0]).toBe("/bearded-dragon-tank-setup");
    expect(howTo.questions.length).toBeGreaterThan(0);
    expect(howTo.quickWin).toBe(true);
    const pillar = blueprint.briefs.find((brief) => brief.articleType === "pillar")!;
    expect(pillar.internalLinks).not.toContain(pillar.url);
    expect(pillar.secondaryKeywords.length).toBeLessThanOrEqual(6);
  });

  it("schedules the pillar first and quick wins next, 2–5 articles a week", () => {
    const [first] = blueprint.calendar;
    expect(first!.week).toBe(1);
    expect(first!.articles[0]!.url).toBe("/bearded-dragon-tank-setup");
    expect(first!.articles[1]!.quickWin).toBe(true);
    for (const week of blueprint.calendar) {
      expect(week.articles.length).toBeGreaterThanOrEqual(1);
      expect(week.articles.length).toBeLessThanOrEqual(5);
    }
    expect(blueprint.calendar.length).toBeLessThanOrEqual(12);
    const scheduled = blueprint.calendar.flatMap((week) => week.articles).length;
    expect(scheduled).toBe(Math.min(blueprint.briefs.length, 12 * 5));
  });

  it("adds type-specific sections to outlines", () => {
    const tools = buildBlueprint("pace calculator", [kw("pace calculator", 5_000, 30)], "tools");
    expect(tools.briefs[0]!.outline).toContain("Use the free Pace Calculator tool");
    const saas = buildBlueprint("crm for freelancers", [kw("crm for freelancers", 2_000, 40)], "saas");
    expect(saas.briefs[0]!.outline).toContain("Pricing and plans compared");
  });

  it("suggests unique exact, partial and brandable domains", () => {
    const ideas = domainIdeas("bearded dragon tank setup", "ai");
    expect(ideas[0]).toEqual({ name: "beardeddragontanksetup.com", style: "exact" });
    expect(ideas.some((idea) => idea.style === "brandable" && idea.name === "beardedai.com")).toBe(true);
    expect(new Set(ideas.map((idea) => idea.name)).size).toBe(ideas.length);
    expect(domainIdeas("   ", "info")).toEqual([]);
  });

  it("lists A-to-Z launch steps tailored to the niche type", () => {
    const steps = launchSteps("tools");
    expect(steps[0]!.title).toBe("Lock the niche");
    expect(steps.at(-1)!.title).toBe("Refresh and expand");
    expect(steps.find((step) => step.title === "Build the site")!.detail).toContain("tool pages");
  });
});

describe("title case", () => {
  it("keeps acronyms and brand casing", () => {
    expect(titleCase("ai agents for small business")).toBe("AI Agents For Small Business");
    expect(titleCase("best crm vs chatgpt for saas teams")).toBe("Best CRM vs ChatGPT For SaaS Teams");
    expect(titleCase("kids' diy apk guide")).toBe("Kids' DIY APK Guide");
  });

  it("is used in titles", () => {
    const plan = buildBlueprint("ai agents for small business", [{ keyword: "ai agents for small business", searchVolume: 100, difficulty: 30, intent: "informational" }], "ai");
    expect(plan.briefs[0]!.title).toBe("AI Agents For Small Business: The Complete Guide");
  });
});

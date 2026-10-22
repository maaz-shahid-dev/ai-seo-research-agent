import { describe, expect, it } from "vitest";

import { buildBlueprint, launchSteps } from "@/features/research/blueprint";
import { blueprintToMarkdown, launchPlanFileName } from "@/features/research/blueprint-export";

describe("launch plan export", () => {
  const keywords = [
    { keyword: "bearded dragon tank setup", searchVolume: 9_000, difficulty: 45, intent: "informational" },
    { keyword: "how to set up a bearded dragon tank", searchVolume: 2_000, difficulty: 20, intent: "informational" },
    { keyword: "best bearded dragon tank", searchVolume: 3_000, difficulty: 38, intent: "commercial" },
  ];
  const blueprint = buildBlueprint("Bearded Dragon Tank Setup", keywords, "info");
  const steps = launchSteps("info");

  it("writes every section with ticked steps", () => {
    const markdown = blueprintToMarkdown(blueprint, steps, new Set([steps[0]!.title]));

    expect(markdown.startsWith("# Launch plan: bearded dragon tank setup\n")).toBe(true);
    for (const heading of ["## Launch steps", "## Domain name ideas", "## Site structure", "## 12-week publishing calendar", "## Content briefs"]) {
      expect(markdown).toContain(`\n${heading}\n`);
    }
    expect(markdown).toContain(`- [x] **${steps[0]!.title}**`);
    expect(markdown).toContain(`- [ ] **${steps[1]!.title}**`);
    expect(markdown).toContain("- Target keyword: bearded dragon tank setup");
    expect(markdown.endsWith("\n")).toBe(true);
    expect(markdown).not.toMatch(/\n{3,}/);
  });

  it("keeps provider text on one line", () => {
    const tricky = buildBlueprint("tank\n# injected", [{ keyword: "tank\n# injected", searchVolume: 10, difficulty: 5, intent: "informational" }], "info");
    expect(blueprintToMarkdown(tricky, steps)).not.toContain("\n# injected");
  });

  it("names the file after the niche", () => {
    expect(launchPlanFileName("Bearded Dragon Tank Setup")).toBe("bearded-dragon-tank-setup-launch-plan.md");
    expect(launchPlanFileName("!!!")).toBe("niche-launch-plan.md");
  });
});

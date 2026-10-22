import { describe, expect, it } from "vitest";

import { addedWords, buildCoverageGroups, patternOf } from "@/features/research/coverage-groups";
import { csvCell, toCsv } from "@/lib/csv";

describe("coverage patterns", () => {
  it.each([
    ["how to use ai tools for productivity", "questions"],
    ["is ai tools for productivity worth it", "questions"],
    ["best ai tools for productivity", "modifiers"],
    ["ai tools for productivity 2026", "modifiers"],
    ["ai tools for productivity vs alternatives", "modifiers"],
    ["free ai tools for productivity", "modifiers"],
    ["open source ai tools for productivity", "before"],
    ["ai tools for productivity checklist", "after"],
    ["ai tools for productivity", null],
    ["productivity apps", null],
  ] as const)("%s → %s", (keyword, pattern) => {
    expect(patternOf("AI tools for productivity", keyword)).toBe(pattern);
  });

  it("matches the topic on whole words only", () => {
    expect(patternOf("cat", "category guide")).toBeNull();
    expect(patternOf("cat", "cat food")).toBe("after");
  });
});

describe("coverage groups", () => {
  const kw = (id: number, keyword: string, searchVolume: number | null, difficulty: number | null = 40) => ({ id, keyword, searchVolume, difficulty });
  const keywords = [
    kw(1, "ai tools", 9_000),
    kw(2, "best ai tools", 5_000, 60),
    kw(3, "how to use ai tools", 1_200, 12),
    kw(4, "ai tools checklist", 300, 20),
    kw(5, "free ai tools download", 800, 25),
    kw(6, "ai tools software pricing", null, null),
  ];
  const { patterns, packs } = buildCoverageGroups("ai tools", keywords);
  const group = <T extends { id: string }>(list: T[], id: string) => list.find((item) => item.id === id)!;

  it("puts each real keyword in one pattern, sorted by volume, with totals", () => {
    expect(patterns.map((item) => item.id)).toEqual(["questions", "modifiers", "after"]);
    expect(group(patterns, "modifiers").keywords.map((item) => item.id)).toEqual([2, 5, 6]);
    expect(group(patterns, "modifiers")).toMatchObject({ totalVolume: 5_800, easyCount: 1 });
    expect(patterns.flatMap((item) => item.keywords).map((item) => item.id).sort()).toEqual([2, 3, 4, 5, 6]);
  });

  it("builds overlapping vertical packs from added words only, and hides empty ones", () => {
    // The topic itself contains "tools", so the Tools pack stays empty.
    expect(packs.some((item) => item.id === "tools")).toBe(false);
    expect(group(packs, "apk").keywords.map((item) => item.id)).toEqual([5]);
    expect(group(packs, "saas").keywords.map((item) => item.id)).toEqual([6]);
    expect(group(packs, "affiliate").keywords.map((item) => item.id)).toEqual([2]);
    expect(packs.some((item) => item.id === "ecommerce")).toBe(true);
    expect(buildCoverageGroups("ai tools", [])).toEqual({ patterns: [], packs: [] });
  });
});

describe("added words", () => {
  it("removes the topic words once each", () => {
    expect(addedWords("best ai tools", "best ai tools review")).toBe("review");
    expect(addedWords("best ai tools", "what are the best ai tools")).toBe("what are the");
    expect(addedWords("best ai tools", "best ai tools")).toBe("");
    expect(addedWords("tools", "tools for tools")).toBe("for tools");
  });

  it("keeps packs meaningful when the topic has pack words", () => {
    const { packs: topicPacks } = buildCoverageGroups("best ai tools", [
      { id: 1, keyword: "best ai tools review", searchVolume: 10, difficulty: 10 },
      { id: 2, keyword: "best ai tools checklist", searchVolume: 10, difficulty: 10 },
    ]);
    expect(topicPacks.map((item) => [item.id, item.keywords.map((keyword) => keyword.id)])).toEqual([["info", [2]], ["affiliate", [1]]]);
  });
});

describe("csv", () => {
  it("quotes cells and neutralizes spreadsheet formulas", () => {
    expect(csvCell("=HYPERLINK(1)")).toBe(`"'=HYPERLINK(1)"`);
    expect(csvCell('say "hi"')).toBe(`"say ""hi"""`);
    expect(csvCell(null)).toBe("");
    expect(toCsv(["a", "b"], [[1, null]])).toBe(`"a","b"\r\n"1",\r\n`);
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContentPlanView } from "@/components/dashboard/ContentPlanView";
import { DailyNichesView } from "@/components/dashboard/DailyNichesView";
import { IskillsView } from "@/components/dashboard/IskillsView";
import { KeywordTable } from "@/components/dashboard/KeywordTable";
import type { KeywordDto, SerpAnalysisDto } from "@/features/research/types";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function keyword(id: number, name: string, overrides: Partial<KeywordDto> = {}): KeywordDto {
  return {
    id, keyword: name, source: "related", intent: "informational", searchVolume: 1_000, cpcMicros: null, competition: null,
    difficulty: 20, trend: null, countryCode: "US", languageCode: "en", nicheScore: null, ...overrides,
  };
}

const seed = keyword(1, "bearded dragon tank setup", { source: "seed", searchVolume: 8_000 });
const keywords = [
  seed,
  keyword(2, "how to set up a bearded dragon tank"),
  keyword(3, "bearded dragon tank size", { searchVolume: 5_000 }),
  keyword(4, "best bearded dragon tank size", { source: "autocomplete" }),
];

const site = (rank: number, domain: string, authority: number, extra: Record<string, unknown> = {}) => ({
  rank, title: domain, url: `https://${domain}/guide`, domain, authority, monthlyTraffic: 50_000, domainAgeYears: 10,
  backlinks: 100, referringDomains: 40, rankingKeywords: 300, isHomepage: false, siteType: "other" as const, weakSpots: [], ...extra,
});

const serp: SerpAnalysisDto = {
  keywordId: 1, status: "completed", nicheScore: 70, hasAiOverview: true, errorMessage: null, fetchedAt: null,
  results: [
    site(1, "tinyreptiles.com", 8, { domainAgeYears: 1, monthlyTraffic: 900, isHomepage: true, rankingKeywords: 45 }),
    site(2, "dragoncare.blog", 15, { monthlyTraffic: 4_000 }),
    site(3, "reptilecorner.net", 20),
    site(4, "petco.com", 85),
  ],
};

describe("content plan", () => {
  it("shows article count, coverage size and expandable clusters", async () => {
    render(<ContentPlanView seed={seed.keyword} keywords={keywords} />);

    expect(screen.getByText("Articles to write").nextElementSibling?.textContent).toBe("3");
    expect(screen.getByText("How-to / Q&A")).toBeTruthy();
    expect(screen.getByText("Small")).toBeTruthy();
    expect(screen.getByText("Bearded dragon tank setup")).toBeTruthy();
    expect(screen.getByText("Pillar page")).toBeTruthy();
    await userEvent.setup({ delay: null }).click(screen.getByText("Bearded dragon tank size"));
    expect(screen.getByText("best bearded dragon tank size")).toBeTruthy();
  });

  it("explains an empty plan", () => {
    render(<ContentPlanView seed="x" keywords={[]} />);
    expect(screen.getByText("No keywords to plan yet.")).toBeTruthy();
  });
});

describe("iSkills check", () => {
  it("scores every rule and lists the weakest sites with traffic and ranking keywords", () => {
    render(<IskillsView seed={seed} keywords={keywords} serp={serp} />);

    expect(screen.getByRole("status").textContent).toContain("Go for it");
    const beatable = screen.getByText("3+ beatable sites (authority ≤ 20)").closest("li")!;
    expect(within(beatable).getByLabelText("Pass")).toBeTruthy();
    const ai = screen.getByText("No AI Overview (preferred)").closest("li")!;
    expect(within(ai).getByLabelText("Caution")).toBeTruthy();
    const weakest = screen.getByRole("table");
    expect(within(weakest).getByText("tinyreptiles.com").closest("tr")!.textContent).toContain("45");
    expect(screen.getByText(/AI Overview present/)).toBeTruthy();
  });

  it("marks SERP rules as not checked while page 1 is loading and flags niches to avoid", () => {
    render(<IskillsView seed={keyword(9, "online casino bonus", { source: "seed" })} keywords={[]} serp={null} />);

    expect(screen.getByRole("status").textContent).toContain("Avoid this niche");
    const beatable = screen.getByText("3+ beatable sites (authority ≤ 20)").closest("li")!;
    expect(within(beatable).getByLabelText("Not checked yet")).toBeTruthy();
  });
});

describe("daily niches", () => {
  it("lists today's ideas and checks one with a click", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      date: "2026-10-22",
      ideas: [{ id: "i1", niche: "Betta tank care", seedKeyword: "betta fish tank setup", problem: "Cloudy water", audience: "new fish owners" }],
    }), { status: 200 })));
    const onCheck = vi.fn();
    render(<DailyNichesView onCheck={onCheck} />);

    expect(await screen.findByText("Betta tank care")).toBeTruthy();
    expect(screen.getByText(/Thursday, October 22/)).toBeTruthy();
    await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: "Check niche" }));
    expect(onCheck).toHaveBeenCalledWith("betta fish tank setup");
  });

  it("explains when no ideas exist yet", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ date: null, ideas: [] }), { status: 200 })));
    render(<DailyNichesView onCheck={vi.fn()} />);
    expect(await screen.findByText(/New ideas appear every morning/)).toBeTruthy();
  });
});

describe("keyword sources", () => {
  it("tags keywords found with Google Autocomplete", () => {
    render(<KeywordTable keywords={keywords} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} onSelect={vi.fn()} />);
    const row = screen.getByText("best bearded dragon tank size").closest("tr")!;
    expect(within(row).getByText("Google suggest")).toBeTruthy();
    expect(screen.getAllByText("Google suggest")).toHaveLength(1);
  });
});

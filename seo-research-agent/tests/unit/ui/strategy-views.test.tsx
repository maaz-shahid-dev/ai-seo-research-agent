// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ContentPlanView } from "@/components/dashboard/ContentPlanView";
import { DailyNichesView } from "@/components/dashboard/DailyNichesView";
import { IskillsView } from "@/components/dashboard/IskillsView";
import { KeywordTable } from "@/components/dashboard/KeywordTable";
import { LaunchPlanView } from "@/components/dashboard/LaunchPlanView";
import { NicheTypeCard } from "@/components/dashboard/NicheTypeCard";
import type { KeywordDto, SerpAnalysisDto } from "@/features/research/types";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function keyword(id: number, name: string, overrides: Partial<KeywordDto> = {}): KeywordDto {
  return {
    id, keyword: name, source: "related", intent: "informational", searchVolume: 1_000, cpcMicros: null, competition: null,
    difficulty: 20, trend: null, countryCode: "US", languageCode: "en", nicheScore: null, allintitleCount: null, ...overrides,
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
      ideas: [{
        id: "i1", niche: "Betta tank care", seedKeyword: "betta fish tank setup", problem: "Cloudy water", audience: "new fish owners",
        nicheType: "info", countryCode: "GB", searchVolume: 2_400, difficulty: 12, lowAuthorityCount: 4,
      }],
    }), { status: 200 })));
    const onCheck = vi.fn();
    render(<DailyNichesView onCheck={onCheck} />);

    expect(await screen.findByText("Betta tank care")).toBeTruthy();
    expect(screen.getByText(/Thursday, October 22/)).toBeTruthy();
    expect(screen.getByText("2,400")).toBeTruthy();
    expect(screen.getByText("4/10")).toBeTruthy();
    expect(screen.getByText(/United Kingdom/)).toBeTruthy();
    await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: "Check niche" }));
    expect(onCheck).toHaveBeenCalledWith("betta fish tank setup", "GB");
  });

  it("filters to low-DR ideas and sorts by volume", async () => {
    const idea = (id: string, niche: string, searchVolume: number, lowAuthorityCount: number | null) => ({
      id, niche, seedKeyword: niche.toLowerCase(), problem: "p", audience: "a", nicheType: "info", countryCode: "US",
      searchVolume, difficulty: 20, lowAuthorityCount,
    });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      date: "2026-10-22",
      ideas: [idea("a", "Small niche", 500, 5), idea("b", "Big niche", 9_000, 1), idea("c", "Unchecked niche", 3_000, null)],
    }), { status: 200 })));
    const user = userEvent.setup({ delay: null });
    render(<DailyNichesView onCheck={vi.fn()} />);
    await screen.findByText("Small niche");

    await user.selectOptions(screen.getByLabelText("Sort ideas"), "volume");
    const names = () => screen.getAllByRole("listitem").map((item) => item.querySelector("p")!.textContent);
    expect(names()).toEqual(["Big niche", "Unchecked niche", "Small niche"]);

    await user.click(screen.getByRole("button", { name: /Low DR/ }));
    expect(names()).toEqual(["Small niche"]);
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

describe("launch plan", () => {
  it("shows steps, domains, structure, calendar and expandable briefs", async () => {
    const user = userEvent.setup({ delay: null });
    render(<LaunchPlanView runId="run-1" seed={seed.keyword} keywords={keywords} nicheType="info" />);

    expect(screen.getByText("Launch steps, A to Z")).toBeTruthy();
    expect(screen.getByRole("checkbox", { name: /Lock the niche/ })).toBeTruthy();
    expect(screen.getByText("beardeddragontanksetup.com")).toBeTruthy();
    expect(screen.getByText("Start here")).toBeTruthy();
    expect(screen.getByText("Week 1")).toBeTruthy();

    const brief = screen.getByText("Bearded Dragon Tank Setup: The Complete Guide", { selector: "details p" });
    await user.click(brief);
    const details = brief.closest("details")!;
    expect(within(details).getByText("Outline (H2s)")).toBeTruthy();
    expect(within(details).getByText("Target keyword").nextElementSibling?.textContent).toBe("bearded dragon tank setup");
  });

  it("ticks launch steps per search, remembers them and exports the plan", async () => {
    const user = userEvent.setup({ delay: null });
    const blobs: Blob[] = [];
    const createObjectURL = vi.fn((blob: Blob) => { blobs.push(blob); return "blob:plan"; });
    Object.assign(URL, { createObjectURL, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    window.localStorage.clear();

    const { unmount } = render(<LaunchPlanView runId="run-1" seed={seed.keyword} keywords={keywords} nicheType="info" />);
    const step = screen.getByRole("checkbox", { name: /Lock the niche/ });
    expect(screen.getByText(/^0 of [0-9]+ done$/)).toBeTruthy();
    await user.click(step);
    expect((step as HTMLInputElement).checked).toBe(true);
    expect(screen.getByText(/^1 of [0-9]+ done$/)).toBeTruthy();
    unmount();

    render(<LaunchPlanView runId="run-1" seed={seed.keyword} keywords={keywords} nicheType="info" />);
    expect((screen.getByRole("checkbox", { name: /Lock the niche/ }) as HTMLInputElement).checked).toBe(true);
    cleanup();
    render(<LaunchPlanView runId="run-2" seed={seed.keyword} keywords={keywords} nicheType="info" />);
    expect((screen.getByRole("checkbox", { name: /Lock the niche/ }) as HTMLInputElement).checked).toBe(false);

    await user.click(screen.getByRole("button", { name: "Export plan" }));
    expect(click).toHaveBeenCalledOnce();
    expect(createObjectURL).toHaveBeenCalledOnce();
    const markdown = await blobs[0]!.text();
    expect(markdown).toContain("# Launch plan: bearded dragon tank setup");
    expect(markdown).toContain("## Content briefs");
    click.mockRestore();
    window.localStorage.clear();
  });

  it("explains an empty plan", () => {
    render(<LaunchPlanView runId="run-1" seed="x" keywords={[]} nicheType="info" />);
    expect(screen.getByText("No keywords to plan yet.")).toBeTruthy();
  });
});

describe("niche type card", () => {
  it("explains money, strategy and cautions for the type", () => {
    render(<NicheTypeCard type="apps" />);
    expect(screen.getByRole("heading", { name: "Apps & APK" })).toBeTruthy();
    expect(screen.getByText(/Never host or link modded/)).toBeTruthy();
  });
});

describe("daily niche filters", () => {
  it("filters ideas by niche type", async () => {
    const user = userEvent.setup({ delay: null });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      date: "2026-10-22",
      ideas: [
        { id: "a", niche: "AI agents for small business", seedKeyword: "ai agents for small business", problem: "p", audience: "owners", nicheType: "ai" },
        { id: "b", niche: "CRM for freelancers", seedKeyword: "best crm for freelancers", problem: "p", audience: "freelancers", nicheType: "saas" },
      ],
    }), { status: 200 })));
    render(<DailyNichesView onCheck={vi.fn()} />);

    await screen.findByText("CRM for freelancers");
    await user.click(screen.getByRole("button", { name: "AI tools & agents (1)" }));
    expect(screen.queryByText("CRM for freelancers")).toBeNull();
    expect(screen.getByText("AI agents for small business", { selector: "p" })).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "All types (2)" }));
    expect(screen.getByText("CRM for freelancers")).toBeTruthy();
  });
});

describe("launch plan briefs", () => {
  it("shows ten briefs first and the rest on request", async () => {
    const user = userEvent.setup({ delay: null });
    const many = Array.from({ length: 14 }, (_, i) => keyword(100 + i, `bearded dragon tank topic${String.fromCharCode(97 + i)}`, { searchVolume: 1_000 - i }));
    render(<LaunchPlanView runId="run-1" seed={seed.keyword} keywords={[seed, ...many]} nicheType="info" />);

    const briefs = () => screen.getByText("Content briefs").closest("section")!.querySelectorAll("details").length;
    expect(briefs()).toBe(10);
    await user.click(screen.getByRole("button", { name: /Show all \d+ briefs/ }));
    expect(briefs()).toBe(15);
    await user.click(screen.getByRole("button", { name: "Show fewer" }));
    expect(briefs()).toBe(10);
  });
});

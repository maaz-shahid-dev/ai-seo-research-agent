// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { CoverageView } from "@/components/dashboard/CoverageView";
import { KeywordTable } from "@/components/dashboard/KeywordTable";
import { OverviewStats } from "@/components/dashboard/OverviewStats";
import { rankOpportunities } from "@/features/research/opportunity";
import type { KeywordDto } from "@/features/research/types";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

const blobs: Blob[] = [];

afterEach(() => {
  cleanup();
  blobs.length = 0;
  vi.restoreAllMocks();
});

function stubDownloads() {
  Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => { blobs.push(blob); return "blob:x"; }), revokeObjectURL: vi.fn() });
  vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
}

function keyword(id: number, name: string, overrides: Partial<KeywordDto> = {}): KeywordDto {
  return {
    id, keyword: name, source: "related", intent: "informational", searchVolume: 1_000, cpcMicros: 1_000_000, competition: null,
    difficulty: 25, trend: null, countryCode: "US", languageCode: "en", nicheScore: null, allintitleCount: null, ...overrides,
  };
}

const keywords = [
  keyword(1, "ai tools", { searchVolume: 20_000, difficulty: 70, intent: "commercial" }),
  keyword(2, "best ai tools", { searchVolume: 9_000, difficulty: 40, intent: "commercial" }),
  keyword(3, "how to use ai tools", { searchVolume: 2_000, difficulty: 12 }),
  keyword(4, "ai tools checklist", { searchVolume: 300, difficulty: 8 }),
];
const names = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("button").find((button) => !button.getAttribute("aria-pressed"))!.textContent);

describe("keyword explorer", () => {
  it("stars favorites, filters to them and exports exactly the shown rows", async () => {
    stubDownloads();
    const user = userEvent.setup({ delay: null });
    const done = new Set<string>();
    const toggle = vi.fn((id: string) => (done.has(id) ? done.delete(id) : done.add(id)));
    const props = { keywords, opportunities: rankOpportunities(keywords), exportName: "ai-tools-keywords", hasMore: false, loadingMore: false, onLoadMore: vi.fn(), onSelect: vi.fn() };
    const { rerender } = render(<KeywordTable {...props} favorites={{ done, toggle }} />);

    await user.click(screen.getByRole("button", { name: "Add “how to use ai tools” to favorites" }));
    expect(toggle).toHaveBeenCalledWith("3");
    rerender(<KeywordTable {...props} favorites={{ done: new Set(done), toggle }} />);
    expect(screen.getByRole("button", { name: "Remove “how to use ai tools” from favorites" }).getAttribute("aria-pressed")).toBe("true");

    await user.selectOptions(screen.getByLabelText("Intent"), "commercial");
    expect(names().sort()).toEqual(["ai tools", "best ai tools"]);
    expect(screen.getByText("2 shown")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "JSON" }));
    const json = JSON.parse(await blobs[0]!.text()) as Array<{ keyword: string; opportunity: number; tier: string; cpcUsd: number }>;
    expect(json.map((row) => row.keyword).sort()).toEqual(["ai tools", "best ai tools"]);
    expect(json[0]).toMatchObject({ opportunity: expect.any(Number), tier: expect.any(String), cpcUsd: 1 });

    await user.selectOptions(screen.getByLabelText("Intent"), "");
    await user.click(screen.getByRole("button", { name: "Favorites" }));
    expect(names()).toEqual(["how to use ai tools"]);
    await user.click(screen.getByRole("button", { name: "CSV" }));
    const csv = await blobs[1]!.text();
    expect(csv.split("\r\n")[0]).toBe(`"keyword","searchVolume","difficulty","cpcUsd","intent","opportunity","tier","source"`);
    expect(csv).toContain(`"how to use ai tools"`);
    expect(csv).not.toContain(`"best ai tools"`);
  });
});

describe("coverage view", () => {
  it("groups real keywords and opens one", async () => {
    stubDownloads();
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<CoverageView seed="ai tools" keywords={keywords} onSelect={onSelect} exportName="ai-tools-keywords" />);

    for (const label of ["Questions", "Modifiers", "After the topic", "Tools", "Affiliate"]) {
      expect(screen.getByText(label, { selector: "summary span" })).toBeTruthy();
    }
    const questions = screen.getByText("Questions", { selector: "summary span" }).closest("details")!;
    expect(within(questions).getByText("1 easy")).toBeTruthy();
    await user.click(within(questions).getByRole("button", { name: /how to use ai tools/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 3 }));

    await user.click(screen.getByRole("button", { name: "Export CSV" }));
    expect(await blobs[0]!.text()).toContain(`"Questions","how to use ai tools","2000","12"`);
  });

  it("explains when nothing could be grouped", () => {
    render(<CoverageView seed="betta fish" keywords={[keyword(1, "betta fish")]} onSelect={vi.fn()} exportName="x" />);
    expect(screen.getByText(/No keyword variations/)).toBeTruthy();
  });
});

describe("overview stats", () => {
  it("summarizes keywords, volume, difficulty and the top opportunity", () => {
    render(<OverviewStats keywords={keywords} opportunities={rankOpportunities(keywords)} />);
    expect(screen.getByText("4")).toBeTruthy();
    expect(screen.getByText("31,300")).toBeTruthy();
    expect(screen.getByText("33 / 100")).toBeTruthy();
    expect(screen.getByText(/^Prime · \d+ · /)).toBeTruthy();
  });
});

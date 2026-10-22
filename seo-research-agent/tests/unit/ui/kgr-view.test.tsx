// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { KgrView } from "@/components/dashboard/KgrView";
import type { KeywordDto } from "@/features/research/types";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function keyword(id: number, name: string, searchVolume: number | null, allintitleCount: number | null = null): KeywordDto {
  return {
    id, keyword: name, source: "related", intent: "informational", searchVolume, cpcMicros: null, competition: null,
    difficulty: 10, trend: null, countryCode: "US", languageCode: "en", nicheScore: null, allintitleCount,
  };
}

const row = (name: string) => screen.getByText(name).closest("tr")!;

describe("KGR view", () => {
  it("checks unchecked low-volume keywords and rates them", async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(JSON.stringify({
      keywords: [{ id: 1, allintitleCount: 20 }, { id: 2, allintitleCount: 300 }], failed: 0,
    }), { status: 200 }));
    vi.stubGlobal("fetch", fetchMock);
    render(<KgrView runId="run-1" keywords={[
      keyword(1, "betta tank for office", 200),
      keyword(2, "betta tank ideas", 150),
      keyword(3, "betta care sheet", 100, 50),
      keyword(4, "betta fish", 40_000),
    ]} />);

    expect(screen.queryByText("betta fish")).toBeNull();
    expect(within(row("betta care sheet")).getByText("Possible")).toBeTruthy();
    expect(within(row("betta tank ideas")).getByText("Not checked")).toBeTruthy();

    await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: "Check 2 keywords" }));

    expect(await within(row("betta tank for office")).findByText("Golden")).toBeTruthy();
    expect(within(row("betta tank for office")).getByText("0.10")).toBeTruthy();
    expect(within(row("betta tank ideas")).getByText("Crowded")).toBeTruthy();
    expect(JSON.parse(fetchMock.mock.calls[0]![1].body)).toEqual({ keywordIds: [1, 2] });
    expect(fetchMock.mock.calls[0]![0]).toBe("/api/research/run-1/kgr");
    expect(screen.queryByRole("button", { name: /Check/ })).toBeNull();
    // Best ratio first.
    expect(screen.getAllByRole("row").slice(1).map((item) => (item as HTMLTableRowElement).cells[0]!.textContent))
      .toEqual(["betta tank for office", "betta care sheet", "betta tank ideas"]);
  });

  it("explains when no keyword qualifies and shows request errors", async () => {
    const { unmount } = render(<KgrView runId="run-1" keywords={[keyword(4, "betta fish", 40_000)]} />);
    expect(screen.getByText(/No keywords with 250 or fewer/)).toBeTruthy();
    unmount();

    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ error: { message: "Too many requests. Try again later." } }), { status: 429 })));
    render(<KgrView runId="run-1" keywords={[keyword(1, "betta tank for office", 200)]} />);
    await userEvent.setup({ delay: null }).click(screen.getByRole("button", { name: "Check 1 keyword" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Too many requests");
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { DailyNichesView } from "@/components/dashboard/DailyNichesView";
import type { NicheIdeaDto } from "@/features/research/types";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const idea = (id: string, niche: string, overrides: Partial<NicheIdeaDto> = {}): NicheIdeaDto => ({
  id, niche, seedKeyword: niche.toLowerCase(), problem: "p", audience: "a", nicheType: "info", countryCode: "US",
  searchVolume: 500, difficulty: 20, lowAuthorityCount: 3, ideaDate: "2026-10-22", reaction: null, ...overrides,
});

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status });

function stubApi(failReactions = false) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init: RequestInit = {}) => {
    const url = String(input);
    if (init.method === "PUT") return failReactions ? json({ error: { message: "Could not save. Try again." } }, 503) : json({});
    if (url.includes("view=favorites")) return json({ date: null, dates: ["2026-10-22", "2026-10-21"], ideas: [idea("old", "Old favorite", { ideaDate: "2026-10-21", reaction: "favorite" })] });
    if (url.includes("date=2026-10-21")) return json({ date: "2026-10-21", dates: ["2026-10-22", "2026-10-21"], ideas: [idea("y1", "Yesterday idea", { ideaDate: "2026-10-21" })] });
    return json({ date: "2026-10-22", dates: ["2026-10-22", "2026-10-21"], ideas: [idea("a", "Betta tanks"), idea("b", "Sourdough rescue")] });
  });
  vi.stubGlobal("fetch", fetchMock);
  return fetchMock;
}

describe("daily niche reactions", () => {
  it("stars and dismisses ideas, saving each change for the user", async () => {
    const fetchMock = stubApi();
    const user = userEvent.setup({ delay: null });
    render(<DailyNichesView onCheck={vi.fn()} />);
    await screen.findByText("Betta tanks");

    await user.click(screen.getByRole("button", { name: "Add “Betta tanks” to favorites" }));
    expect(screen.getByRole("button", { name: "Remove “Betta tanks” from favorites" }).getAttribute("aria-pressed")).toBe("true");
    const put = fetchMock.mock.calls.find(([, init]) => init?.method === "PUT")!;
    expect(put[0]).toBe("/api/niche-ideas/a/reaction");
    expect(JSON.parse(String(put[1]!.body))).toEqual({ status: "favorite" });

    await user.click(screen.getByRole("button", { name: "Dismiss “Sourdough rescue”" }));
    expect(screen.queryByText("Sourdough rescue")).toBeNull();
    await user.click(screen.getByRole("button", { name: "Show dismissed (1)" }));
    expect(screen.getByText("Sourdough rescue")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Restore “Sourdough rescue”" }));
    expect(screen.queryByRole("button", { name: /Show dismissed/ })).toBeNull();
  });

  it("shows favorites from every day and past days by date", async () => {
    stubApi();
    const user = userEvent.setup({ delay: null });
    render(<DailyNichesView onCheck={vi.fn()} />);
    await screen.findByText("Betta tanks");

    await user.selectOptions(screen.getByLabelText("Day"), "2026-10-21");
    expect(await screen.findByText("Yesterday idea")).toBeTruthy();

    await user.click(screen.getByRole("button", { name: "Favorites" }));
    expect(await screen.findByText("Old favorite")).toBeTruthy();
    expect(screen.getByText(/· Oct 21/)).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Remove “Old favorite” from favorites" }));
    expect(screen.getByText(/No favorites yet/)).toBeTruthy();
  });

  it("rolls back and explains when saving fails", async () => {
    stubApi(true);
    const user = userEvent.setup({ delay: null });
    render(<DailyNichesView onCheck={vi.fn()} />);
    await screen.findByText("Betta tanks");

    await user.click(screen.getByRole("button", { name: "Add “Betta tanks” to favorites" }));
    expect((await screen.findByRole("alert")).textContent).toContain("Could not save");
    await waitFor(() => expect(screen.getByRole("button", { name: "Add “Betta tanks” to favorites" }).getAttribute("aria-pressed")).toBe("false"));
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HistoryView } from "@/components/dashboard/HistoryView";
import type { KeywordDto, ResearchRunDto } from "@/features/research/types";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

const run = (id: string, query: string, status = "completed"): ResearchRunDto => ({
  id, projectId: "p1", query, countryCode: "US", languageCode: "en", device: "desktop", keywordLimit: 100, status, version: 1,
  progress: 100, keywordCount: 3, errorCode: null, errorMessage: null, createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null,
} as ResearchRunDto);

const keyword = (id: number, name: string, searchVolume: number): KeywordDto => ({
  id, keyword: name, source: "related", intent: "informational", searchVolume, cpcMicros: null, competition: null,
  difficulty: 20, trend: null, countryCode: "US", languageCode: "en", nicheScore: null, allintitleCount: null,
});

const json = (body: unknown) => new Response(JSON.stringify(body), { status: 200 });

describe("compare searches", () => {
  it("compares two finished searches, loading every keyword page", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url.startsWith("/api/research?")) return json({ runs: [run("a", "betta tank"), run("b", "betta care"), run("c", "running", "running")], nextCursor: null });
      if (url === "/api/research/a") return json({ run: run("a", "betta tank"), keywords: [keyword(1, "betta tank", 900)], nextCursor: 1, analysis: null, pendingSerpCount: 0 });
      if (url === "/api/research/a?after=1") return json({ run: run("a", "betta tank"), keywords: [keyword(2, "betta food", 300)], nextCursor: null, analysis: null, pendingSerpCount: 0 });
      if (url === "/api/research/b") return json({ run: run("b", "betta care"), keywords: [keyword(3, "betta tank", 1_200), keyword(4, "betta lifespan", 50)], nextCursor: null, analysis: null, pendingSerpCount: 0 });
      throw new Error(`unexpected ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);
    const user = userEvent.setup({ delay: null });
    render(<HistoryView projectId="p1" projectName="P" onOpen={vi.fn()} onDeleted={vi.fn()} />);
    await screen.findByText("betta tank");

    expect((screen.getByRole("checkbox", { name: "Select “running” to compare" }) as HTMLInputElement).disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Select “betta tank” to compare" }));
    expect((screen.getByRole("button", { name: "Compare" }) as HTMLButtonElement).disabled).toBe(true);
    await user.click(screen.getByRole("checkbox", { name: "Select “betta care” to compare" }));
    await user.click(screen.getByRole("button", { name: "Compare" }));

    expect(await screen.findByRole("button", { name: "In both (1)" })).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("betta tank")).toBeTruthy();
    expect(within(screen.getByRole("table")).getByText("1,200")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Only in A (1)" }));
    expect(within(screen.getByRole("table")).getByText("betta food")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Only in B (1)" }));
    expect(within(screen.getByRole("table")).getByText("betta lifespan")).toBeTruthy();
    expect(fetchMock).toHaveBeenCalledWith("/api/research/a?after=1", expect.anything());

    await user.click(screen.getByRole("button", { name: "Back to history" }));
    expect(screen.getByRole("heading", { name: "History" })).toBeTruthy();
  });
});

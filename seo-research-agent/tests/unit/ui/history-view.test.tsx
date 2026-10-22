// @vitest-environment jsdom

import { cleanup, render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { HistoryView } from "@/components/dashboard/HistoryView";
import type { ResearchRunDto } from "@/features/research/types";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
});

function run(id: string, query: string, overrides: Partial<ResearchRunDto> = {}): ResearchRunDto {
  return {
    id, projectId: "p1", query, countryCode: "US", languageCode: "en", device: "desktop", keywordLimit: 100,
    status: "completed", version: 3, progress: 100, keywordCount: 84, errorCode: null, errorMessage: null,
    createdAt: new Date().toISOString(), updatedAt: new Date().toISOString(), finishedAt: null, ...overrides,
  } as ResearchRunDto;
}

const json = (body: unknown, status = 200) => new Response(status === 204 ? null : JSON.stringify(body), { status });

function renderHistory(fetchMock: ReturnType<typeof vi.fn>) {
  vi.stubGlobal("fetch", fetchMock);
  const onOpen = vi.fn();
  const onDeleted = vi.fn();
  render(<HistoryView projectId="p1" projectName="My niches" onOpen={onOpen} onDeleted={onDeleted} />);
  return { onOpen, onDeleted, user: userEvent.setup({ delay: null }) };
}

describe("history screen", () => {
  it("lists searches, loads more pages and opens one", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      url.includes("cursor=next")
        ? json({ runs: [run("r3", "cast iron care", { countryCode: "GB", status: "failed" })], nextCursor: null })
        : json({ runs: [run("r1", "betta fish tank setup"), run("r2", "sourdough starter")], nextCursor: "next" }));
    const { onOpen, user } = renderHistory(fetchMock);

    expect(await screen.findByText("betta fish tank setup")).toBeTruthy();
    expect(screen.getAllByText(/84 keywords/)).toHaveLength(2);
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(await screen.findByText("cast iron care")).toBeTruthy();
    expect(screen.getByText(/United Kingdom/)).toBeTruthy();
    expect(screen.getByText("Failed")).toBeTruthy();
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();

    await user.click(screen.getByText("sourdough starter"));
    expect(onOpen).toHaveBeenCalledWith(expect.objectContaining({ id: "r2" }));
  });

  it("searches by topic", async () => {
    const fetchMock = vi.fn(async (url: string) =>
      new URL(url, "https://app.test").searchParams.get("q") === "betta"
        ? json({ runs: [run("r1", "betta fish tank setup")], nextCursor: null })
        : json({ runs: [run("r1", "betta fish tank setup"), run("r2", "sourdough starter")], nextCursor: null }));
    const { user } = renderHistory(fetchMock);
    await screen.findByText("sourdough starter");

    await user.type(screen.getByLabelText("Search history"), "betta");
    await waitFor(() => expect(fetchMock).toHaveBeenLastCalledWith(expect.stringContaining("q=betta"), expect.anything()));
    await waitFor(() => expect(screen.queryByText("sourdough starter")).toBeNull());
    expect(await screen.findByText("betta fish tank setup")).toBeTruthy();
  });

  it("deletes a search only after confirming", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "DELETE" ? json(null, 204) : json({ runs: [run("r1", "betta fish tank setup")], nextCursor: null }));
    const { onDeleted, user } = renderHistory(fetchMock);
    await screen.findByText("betta fish tank setup");

    await user.click(screen.getByRole("button", { name: "Delete “betta fish tank setup”" }));
    await user.click(screen.getByRole("button", { name: "Cancel" }));
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await user.click(screen.getByRole("button", { name: "Delete “betta fish tank setup”" }));
    await user.click(within(screen.getByRole("listitem")).getByRole("button", { name: "Delete" }));
    await waitFor(() => expect(onDeleted).toHaveBeenCalledWith("r1"));
    expect(fetchMock).toHaveBeenLastCalledWith("/api/research/r1", expect.objectContaining({ method: "DELETE" }));
    expect(screen.queryByText("betta fish tank setup")).toBeNull();
    expect(screen.getByText(/No searches yet/)).toBeTruthy();
  });

  it("keeps the row and explains when deleting fails", async () => {
    const fetchMock = vi.fn(async (_url: string, init?: RequestInit) =>
      init?.method === "DELETE"
        ? json({ error: { message: "Research run not found." } }, 404)
        : json({ runs: [run("r1", "betta fish tank setup")], nextCursor: null }));
    const { onDeleted, user } = renderHistory(fetchMock);
    await screen.findByText("betta fish tank setup");

    await user.click(screen.getByRole("button", { name: "Delete “betta fish tank setup”" }));
    await user.click(within(screen.getByRole("listitem")).getByRole("button", { name: "Delete" }));
    expect((await screen.findByRole("alert")).textContent).toContain("not found");
    expect(screen.getByText("betta fish tank setup")).toBeTruthy();
    expect(onDeleted).not.toHaveBeenCalled();
  });
});

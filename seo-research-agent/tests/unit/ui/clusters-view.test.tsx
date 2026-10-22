// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ClustersView } from "@/components/dashboard/ClustersView";
import type { KeywordDto } from "@/features/research/types";

afterEach(cleanup);

function keyword(id: number, name: string, searchVolume: number, difficulty: number): KeywordDto {
  return {
    id, keyword: name, source: "related", intent: "informational", searchVolume, cpcMicros: null, competition: null,
    difficulty, trend: null, countryCode: "US", languageCode: "en", nicheScore: null, allintitleCount: null,
  };
}

const keywords = [
  keyword(1, "betta fish tank", 9_000, 40),
  keyword(2, "betta fish tank setup", 3_000, 20),
  keyword(3, "betta fish tank setup guide", 500, 10),
  keyword(4, "betta fish food", 2_000, 30),
  keyword(5, "best betta fish food", 800, 50),
];

describe("clusters view", () => {
  it("shows clusters with totals and opens a cluster's keywords", async () => {
    const user = userEvent.setup({ delay: null });
    const onSelect = vi.fn();
    render(<ClustersView seed="betta fish tank" keywords={keywords} onSelect={onSelect} />);

    const cards = screen.getAllByRole("listitem");
    expect(cards.length).toBeGreaterThan(1);
    const food = cards.find((card) => card.textContent?.includes("Food"))!;
    expect(within(food).getByText("2,800")).toBeTruthy();
    expect(within(food).getByText("40")).toBeTruthy();

    await user.click(within(food).getByRole("button"));
    const drawer = screen.getByRole("dialog", { name: "Food" });
    await user.click(within(drawer).getByRole("button", { name: /best betta fish food/ }));
    expect(onSelect).toHaveBeenCalledWith(expect.objectContaining({ id: 5 }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("closes the drawer with Escape and explains an empty plan", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<ClustersView seed="betta fish tank" keywords={keywords} onSelect={vi.fn()} />);
    await user.click(screen.getAllByRole("listitem")[0]!.querySelector("button")!);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();
    unmount();

    render(<ClustersView seed="x" keywords={[]} onSelect={vi.fn()} />);
    expect(screen.getByText(/No clusters yet/)).toBeTruthy();
  });
});

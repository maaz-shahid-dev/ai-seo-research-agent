// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { filtersFromUrl, sortFromUrl, sortToUrl } from "@/components/dashboard/KeywordTableParts";
import { KeywordTable } from "@/components/dashboard/KeywordTable";
import { rankOpportunities } from "@/features/research/opportunity";
import type { KeywordDto } from "@/features/research/types";
import { pick, readParam, writeParams } from "@/lib/url-state";

vi.mock("next-auth/react", () => ({ signOut: vi.fn() }));

afterEach(cleanup);

function keyword(id: number, name: string, overrides: Partial<KeywordDto> = {}): KeywordDto {
  return {
    id, keyword: name, source: "related", intent: "informational", searchVolume: 1_000, cpcMicros: null, competition: null,
    difficulty: 25, trend: null, countryCode: "US", languageCode: "en", nicheScore: null, allintitleCount: null, ...overrides,
  };
}

const keywords = [
  keyword(1, "ai tools", { searchVolume: 20_000, intent: "commercial", difficulty: 70 }),
  keyword(2, "best ai tools", { searchVolume: 9_000, intent: "commercial", difficulty: 40 }),
  keyword(3, "how to use ai tools", { searchVolume: 2_000, difficulty: 12 }),
];
const names = () => screen.getAllByRole("row").slice(1).map((row) => within(row).getAllByRole("button")[0]!.textContent);

describe("url state helpers", () => {
  it("only accepts known values and writes without reloading", () => {
    expect(pick("history", ["research", "history"] as const, "research")).toBe("history");
    expect(pick("<script>", ["research", "history"] as const, "research")).toBe("research");
    expect(pick(null, ["a"] as const, "a")).toBe("a");

    window.history.replaceState(null, "", "/?keep=1");
    writeParams({ tab: "keywords", q: "", missing: null });
    expect(window.location.search).toBe("?keep=1&tab=keywords");
    expect(readParam("tab")).toBe("keywords");
  });

  it("parses keyword filters and sort defensively", () => {
    const params = new URLSearchParams({ q: "x".repeat(300), intent: "evil", kd: "30", tier: "prime", fav: "1" });
    expect(filtersFromUrl((name) => params.get(name))).toEqual({ text: "x".repeat(100), intent: "", maxDifficulty: "30", tier: "prime", favoritesOnly: true });
    expect(sortFromUrl("searchVolume-asc")).toEqual({ key: "searchVolume", direction: "asc" });
    expect(sortFromUrl("none")).toBeNull();
    expect(sortFromUrl("dropTable-asc")).toBeUndefined();
    expect(sortToUrl({ key: "difficulty", direction: "desc" })).toBe("difficulty-desc");
    expect(sortToUrl(undefined)).toBeNull();
  });
});

describe("shareable keyword view", () => {
  const props = { keywords, opportunities: rankOpportunities(keywords), exportName: "x", hasMore: false, loadingMore: false, onLoadMore: vi.fn(), onSelect: vi.fn() };

  it("restores filters and sort from the URL", () => {
    window.history.replaceState(null, "", "/?intent=commercial&sort=searchVolume-asc");
    render(<KeywordTable {...props} syncUrl />);
    expect((screen.getByLabelText("Intent") as HTMLSelectElement).value).toBe("commercial");
    expect(names()).toEqual(["best ai tools", "ai tools"]);
  });

  it("writes changes back to the URL, and leaves it alone without syncUrl", async () => {
    const user = userEvent.setup({ delay: null });
    const { unmount } = render(<KeywordTable {...props} syncUrl />);
    await user.selectOptions(screen.getByLabelText("Maximum difficulty"), "30");
    await user.click(screen.getByRole("button", { name: "Volume" }));
    expect(new URLSearchParams(window.location.search).get("kd")).toBe("30");
    expect(new URLSearchParams(window.location.search).get("sort")).toBe("searchVolume-desc");
    unmount();

    window.history.replaceState(null, "", "/");
    render(<KeywordTable {...props} />);
    await user.selectOptions(screen.getByLabelText("Maximum difficulty"), "20");
    expect(window.location.search).toBe("");
  });
});

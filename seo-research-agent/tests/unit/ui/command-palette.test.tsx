// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { AppShell } from "@/components/layout/AppShell";
import { filterCommands, isPaletteShortcut, type Command } from "@/lib/commands";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
});

const command = (id: string, label: string, group = "Go to", keywords?: string): Command => ({ id, label, group, keywords, run: vi.fn() });

describe("command filtering", () => {
  const commands = [command("h", "History"), command("r", "Research"), command("t", "Keywords", "Open tab", "betta"), command("s", "Betta tank setup", "Recent searches")];

  it("matches every word across label, group and keywords, label prefixes first", () => {
    expect(filterCommands(commands, "").map((item) => item.id)).toEqual(["h", "r", "t", "s"]);
    expect(filterCommands(commands, "betta").map((item) => item.id)).toEqual(["s", "t"]);
    expect(filterCommands(commands, "open key").map((item) => item.id)).toEqual(["t"]);
    expect(filterCommands(commands, "nothing")).toEqual([]);
  });

  it("recognizes Ctrl+K and Cmd+K only", () => {
    const key = (overrides: Partial<KeyboardEvent>) => ({ key: "k", ctrlKey: false, metaKey: false, altKey: false, shiftKey: false, ...overrides });
    expect(isPaletteShortcut(key({ ctrlKey: true }))).toBe(true);
    expect(isPaletteShortcut(key({ metaKey: true, key: "K" }))).toBe(true);
    expect(isPaletteShortcut(key({}))).toBe(false);
    expect(isPaletteShortcut(key({ ctrlKey: true, shiftKey: true }))).toBe(false);
  });
});

describe("command palette", () => {
  function renderShell(commands: Command[]) {
    render(
      <AppShell view="research" onNavigate={vi.fn()} user={{ name: "Maaz Shahid" }} demo={false} onSignOut={vi.fn()} sidebar={null} commands={commands}>
        <p>page</p>
      </AppShell>,
    );
    return userEvent.setup({ delay: null });
  }

  it("opens with Ctrl+K, filters, moves with arrows and runs with Enter", async () => {
    const history = command("h", "History");
    const research = command("r", "Research");
    const user = renderShell([history, research]);

    await user.keyboard("{Control>}k{/Control}");
    const dialog = screen.getByRole("dialog", { name: "Quick actions" });
    const input = within(dialog).getByRole("combobox", { name: "Search actions" });
    expect(document.activeElement).toBe(input);

    await user.keyboard("{ArrowDown}");
    expect(within(dialog).getByRole("option", { name: "Research" }).getAttribute("aria-selected")).toBe("true");
    expect(input.getAttribute("aria-activedescendant")).toBe(within(dialog).getByRole("option", { name: "Research" }).id);
    await user.keyboard("{Enter}");
    expect(research.run).toHaveBeenCalledOnce();
    expect(screen.queryByRole("dialog", { name: "Quick actions" })).toBeNull();

    await user.click(screen.getAllByRole("button", { name: "Quick actions" })[0]!);
    await user.type(screen.getByRole("combobox"), "hist");
    expect(screen.getAllByRole("option").map((option) => option.textContent)).toEqual(["History"]);
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog", { name: "Quick actions" })).toBeNull();
    expect(history.run).not.toHaveBeenCalled();
  });

  it("includes the theme switch and explains no matches", async () => {
    const user = renderShell([]);
    await user.keyboard("{Meta>}k{/Meta}");
    await user.type(screen.getByRole("combobox"), "dark");
    await user.keyboard("{Enter}");
    expect(document.documentElement.classList.contains("dark")).toBe(true);

    await user.keyboard("{Control>}k{/Control}");
    await user.type(screen.getByRole("combobox"), "zzz");
    expect(screen.getByText("No matching actions.")).toBeTruthy();
  });
});

describe("opening result tabs from the palette", () => {
  it("switches to the requested tab and ignores unknown ones", async () => {
    const { act } = await import("@testing-library/react");
    const { ResearchResults, OPEN_RESULT_TAB_EVENT } = await import("@/components/dashboard/ResearchResults");
    vi.stubGlobal("fetch", vi.fn(() => new Promise(() => {})));
    const project = { id: "p", name: "P", countryCode: "US", languageCode: "en", targetDomain: null, status: "active", createdAt: "", updatedAt: "" } as never;
    render(<ResearchResults runId="r" analysis={null} project={project} onProjectUpdate={vi.fn()} keywords={[]} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} />);

    act(() => { window.dispatchEvent(new CustomEvent(OPEN_RESULT_TAB_EVENT, { detail: "kgr" })); });
    expect(screen.getByRole("tab", { name: "KGR" }).getAttribute("aria-selected")).toBe("true");
    act(() => { window.dispatchEvent(new CustomEvent(OPEN_RESULT_TAB_EVENT, { detail: "<script>" })); });
    expect(screen.getByRole("tab", { name: "Overview" }).getAttribute("aria-selected")).toBe("true");
    vi.unstubAllGlobals();
  });
});

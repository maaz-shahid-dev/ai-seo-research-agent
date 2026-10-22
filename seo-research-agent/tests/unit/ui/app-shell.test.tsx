// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { SearchBar } from "@/components/dashboard/SearchBar";
import { AppShell } from "@/components/layout/AppShell";
import { ScoreRing } from "@/components/ui/ScoreRing";

afterEach(cleanup);

function renderShell(demo = false) {
  const onNavigate = vi.fn();
  const onSignOut = vi.fn();
  render(
    <AppShell
      view="research"
      onNavigate={onNavigate}
      user={{ name: "Maaz Shahid" }}
      demo={demo}
      onSignOut={onSignOut}
      sidebar={<button type="button">recent search</button>}
    >
      <p>page content</p>
    </AppShell>,
  );
  return { onNavigate, onSignOut, user: userEvent.setup({ delay: null }) };
}

describe("app shell", () => {
  it("shows navigation, the signed-in user and page content", async () => {
    const { onNavigate, onSignOut, user } = renderShell();

    expect(screen.getByRole("button", { name: "Research" }).getAttribute("aria-current")).toBe("page");
    expect(screen.getByText("MS")).toBeTruthy();
    expect(screen.getByText("page content")).toBeTruthy();
    expect(screen.queryByText("Demo data")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Daily niches" }));
    expect(onNavigate).toHaveBeenCalledWith("ideas");
    await user.click(screen.getByRole("button", { name: "Sign out" }));
    expect(onSignOut).toHaveBeenCalledOnce();
  });

  it("labels demo data clearly", () => {
    renderShell(true);
    expect(screen.getAllByText("Demo data").length).toBeGreaterThan(0);
  });

  it("opens the mobile drawer, closes it with Escape, and closes after navigating", async () => {
    const { onNavigate, user } = renderShell();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    const drawer = screen.getByRole("dialog", { name: "Menu" });
    expect(within(drawer).getByRole("button", { name: "Projects" })).toBeTruthy();
    await user.keyboard("{Escape}");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(screen.getByRole("button", { name: "Close menu" }));
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "Projects" }));
    expect(onNavigate).toHaveBeenCalledWith("projects");
    expect(screen.queryByRole("dialog")).toBeNull();

    await user.click(screen.getByRole("button", { name: "Open menu" }));
    await user.click(within(screen.getByRole("dialog")).getByRole("button", { name: "recent search" }));
    expect(screen.queryByRole("dialog")).toBeNull();
  });
});

describe("search bar", () => {
  it("submits typed topics and example topics", async () => {
    const user = userEvent.setup({ delay: null });
    const onSubmit = vi.fn();
    const { rerender } = render(
      <SearchBar query="" onQueryChange={vi.fn()} onSubmit={onSubmit} pending={false} error={null} showExamples />,
    );

    await user.click(screen.getByRole("button", { name: "sourdough starter problems" }));
    expect(onSubmit).toHaveBeenCalledWith("sourdough starter problems");

    rerender(<SearchBar query="x" onQueryChange={vi.fn()} onSubmit={onSubmit} pending={false} error="Keyword research isn't available yet." showExamples={false} />);
    expect(screen.queryByRole("button", { name: "sourdough starter problems" })).toBeNull();
    expect(screen.getByRole("alert").textContent).toContain("isn't available yet");
  });
});

describe("score ring", () => {
  it("clamps and announces the score", () => {
    render(<ScoreRing value={140} label="Niche score" tone="good" />);
    expect(screen.getByRole("img", { name: "Niche score: 100 out of 100" })).toBeTruthy();
  });
});

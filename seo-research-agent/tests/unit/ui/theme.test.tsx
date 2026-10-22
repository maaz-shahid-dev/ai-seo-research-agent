// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it } from "vitest";

import { ThemeToggle } from "@/components/layout/ThemeToggle";
import { parseTheme } from "@/lib/theme";

afterEach(() => {
  cleanup();
  document.documentElement.classList.remove("dark");
  document.cookie = "theme=; Path=/; Max-Age=0";
});

describe("theme", () => {
  it("only accepts dark explicitly", () => {
    expect(parseTheme("dark")).toBe("dark");
    expect(parseTheme("light")).toBe("light");
    expect(parseTheme(undefined)).toBe("light");
    expect(parseTheme("dark; injected")).toBe("light");
  });

  it("toggles the class and remembers the choice in a cookie", async () => {
    const user = userEvent.setup({ delay: null });
    render(<ThemeToggle />);

    await user.click(screen.getByRole("button", { name: "Switch to dark theme" }));
    expect(document.documentElement.classList.contains("dark")).toBe(true);
    expect(document.cookie).toContain("theme=dark");

    await user.click(screen.getByRole("button", { name: "Switch to light theme" }));
    expect(document.documentElement.classList.contains("dark")).toBe(false);
    expect(document.cookie).toContain("theme=light");
  });
});

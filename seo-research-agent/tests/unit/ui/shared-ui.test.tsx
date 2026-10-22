// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { Card, StatCard } from "@/components/ui/Card";
import { EmptyState } from "@/components/ui/EmptyState";
import { ErrorState } from "@/components/ui/ErrorState";

afterEach(cleanup);

describe("shared UI", () => {
  it("renders cards as the requested element with extra classes", () => {
    render(<Card as="section" aria-label="Report" className="space-y-3">body</Card>);
    const card = screen.getByRole("region", { name: "Report" });
    expect(card.className).toContain("rounded-xl");
    expect(card.className).toContain("space-y-3");
  });

  it("shows a stat with its detail", () => {
    render(<dl><StatCard label="Keywords" value="73" detail="in this search" /></dl>);
    expect(screen.getByText("Keywords").tagName).toBe("DT");
    expect(screen.getByText("73")).toBeTruthy();
    expect(screen.getByText("in this search")).toBeTruthy();
  });

  it("announces errors and shows empty states with actions", () => {
    render(<><ErrorState action={<button type="button">Retry</button>}>Could not load.</ErrorState><EmptyState title="Nothing yet" action={<button type="button">Start</button>}>Run a search.</EmptyState></>);
    expect(screen.getByRole("alert").textContent).toContain("Could not load.");
    expect(screen.getByRole("button", { name: "Retry" })).toBeTruthy();
    expect(screen.getByText("Nothing yet")).toBeTruthy();
    expect(screen.getByRole("button", { name: "Start" })).toBeTruthy();
  });
});

// @vitest-environment jsdom

import { cleanup, render, screen, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReportActions } from "@/components/report/ReportActions";
import { ReportDocument } from "@/components/report/ReportDocument";
import type { ResearchReport } from "@/features/research/report";

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

const report: ResearchReport = {
  title: "betta fish tank", market: "United Kingdom", createdAt: "2026-10-22T10:00:00.000Z",
  stats: { keywords: 4, monthlySearches: 13_600, averageDifficulty: 25 },
  summary: "Steady demand with easy long-tail topics.", nextSteps: ["Publish a pillar guide."],
  topOpportunities: [{ keyword: "best betta fish tank", searchVolume: 3_000, difficulty: 30, score: 70, tier: "Prime" }],
  coverage: [{ label: "Questions", count: 1, easyCount: 1, totalVolume: 1_200, examples: ["how to clean a betta fish tank"] }],
  clusters: [{ topic: "clean", type: "How-to / Q&A", mainKeyword: "how to clean a betta fish tank", keywords: 1, totalVolume: 1_200, averageDifficulty: 12 }],
  totalClusters: 3,
};

describe("report", () => {
  it("renders every section of the document", () => {
    render(<ReportDocument report={report} />);
    expect(screen.getByRole("heading", { level: 1, name: "Betta Fish Tank" })).toBeTruthy();
    expect(screen.getByText("United Kingdom · October 22, 2026")).toBeTruthy();
    expect(screen.getByText("13,600")).toBeTruthy();
    for (const title of ["Summary", "Top opportunities", "Content coverage", "Content plan · top 1 of 3 pages"]) {
      expect(screen.getByRole("heading", { level: 2, name: title })).toBeTruthy();
    }
    const plan = screen.getByRole("heading", { level: 2, name: /Content plan/ }).closest("section")!;
    expect(within(plan).getByText("Clean")).toBeTruthy();
  });

  it("prints and downloads the Markdown", async () => {
    const user = userEvent.setup({ delay: null });
    const print = vi.spyOn(window, "print").mockImplementation(() => {});
    const blobs: Blob[] = [];
    Object.assign(URL, { createObjectURL: vi.fn((blob: Blob) => { blobs.push(blob); return "blob:x"; }), revokeObjectURL: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => {});
    render(<ReportActions backHref="/?run=r" markdown="# Report" fileName="betta-report.md" />);

    expect(screen.getByRole("link", { name: "Back to research" }).getAttribute("href")).toBe("/?run=r");
    await user.click(screen.getByRole("button", { name: "Print or save as PDF" }));
    expect(print).toHaveBeenCalledOnce();
    await user.click(screen.getByRole("button", { name: "Markdown" }));
    expect(await blobs[0]!.text()).toBe("# Report");
  });
});

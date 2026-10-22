// @vitest-environment jsdom

import { cleanup, render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { afterEach, describe, expect, it, vi } from "vitest";

import { InsightsCard } from "@/components/dashboard/InsightsCard";
import { KeywordTable } from "@/components/dashboard/KeywordTable";
import type { AiAnalysisDto, KeywordDto } from "@/features/research/types";

afterEach(cleanup);

function keywords(count: number): KeywordDto[] {
  return Array.from({ length: count }, (_, index) => ({
    id: index + 1,
    keyword: index === 0 ? "running shoes for women" : `running keyword ${index + 1}`,
    source: "related",
    intent: index === 0 ? "unknown" : "commercial",
    searchVolume: index === 0 ? null : 1_000 + index,
    cpcMicros: null,
    competition: null,
    difficulty: [10, 45, 80][index % 3]!,
    trend: null,
    countryCode: "US",
    languageCode: "en",
  }));
}

describe("keyword table", () => {
  it("hides the filter for short lists and shows dashes for missing data", () => {
    render(<KeywordTable keywords={keywords(3)} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} />);

    expect(screen.queryByLabelText("Filter keywords")).toBeNull();
    const firstRow = screen.getByText("running shoes for women").closest("tr")!;
    expect(firstRow.textContent).toContain("—");
    expect(screen.queryByRole("button", { name: "Load more" })).toBeNull();
  });

  it("filters long lists and explains when nothing matches", async () => {
    const user = userEvent.setup({ delay: null });
    render(<KeywordTable keywords={keywords(12)} hasMore={false} loadingMore={false} onLoadMore={vi.fn()} />);

    await user.type(screen.getByLabelText("Filter keywords"), "WOMEN");
    expect(screen.getAllByRole("row")).toHaveLength(2);

    await user.clear(screen.getByLabelText("Filter keywords"));
    await user.type(screen.getByLabelText("Filter keywords"), "zzz");
    expect(screen.getByText("No keywords match this filter.")).toBeTruthy();
  });

  it("explains an empty result and loads more pages on request", async () => {
    const user = userEvent.setup({ delay: null });
    const onLoadMore = vi.fn();
    render(<KeywordTable keywords={[]} hasMore loadingMore={false} onLoadMore={onLoadMore} />);

    expect(screen.getByText("No keywords found for this topic.")).toBeTruthy();
    await user.click(screen.getByRole("button", { name: "Load more" }));
    expect(onLoadMore).toHaveBeenCalledOnce();
  });
});

describe("AI summary card", () => {
  const base: AiAnalysisDto = {
    id: "40000000-0000-4000-8000-000000000001",
    status: "queued",
    summary: null,
    output: null,
    errorMessage: null,
    updatedAt: "2026-10-21T00:00:00.000Z",
  };

  it("renders nothing when no analysis exists", () => {
    const { container } = render(<InsightsCard analysis={null} />);
    expect(container.textContent).toBe("");
  });

  it("shows progress while the summary is written", () => {
    render(<InsightsCard analysis={{ ...base, status: "running" }} />);
    expect(screen.getByRole("status").textContent).toContain("Writing AI summary");
  });

  it("omits empty sections and caps each list at three items", () => {
    const statement = (text: string) => ({ statement: text, citationIds: ["kw_1"] });
    render(
      <InsightsCard
        analysis={{
          ...base,
          status: "completed",
          summary: "Demand is steady.",
          errorMessage: null,
          output: {
            summary: statement("Demand is steady."),
            opportunitySignals: ["a", "b", "c", "d"].map((letter) => statement(`Opportunity ${letter}`)),
            risks: [],
            missingEvidence: ["SERP data"],
            nextSteps: [statement("Write a guide.")],
          },
        }}
      />,
    );

    expect(screen.getByText("Demand is steady.")).toBeTruthy();
    expect(screen.getByText("Opportunity c")).toBeTruthy();
    expect(screen.queryByText("Opportunity d")).toBeNull();
    expect(screen.queryByText("Risks")).toBeNull();
    expect(screen.getByText("Write a guide.")).toBeTruthy();
  });
});

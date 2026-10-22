import { describe, expect, it } from "vitest";

import { authorityBuckets, siteTypeBreakdown } from "@/features/research/serp-insights";

describe("SERP insights", () => {
  it("buckets authority with DR 20 or less marked easy and unknowns apart", () => {
    const { buckets, unknown } = authorityBuckets([{ authority: 0 }, { authority: 20 }, { authority: 21 }, { authority: 100 }, { authority: null }]);
    expect(buckets.map((bucket) => [bucket.label, bucket.count, bucket.easy])).toEqual([
      ["0–20", 2, true], ["21–40", 1, false], ["41–60", 0, false], ["61–80", 0, false], ["81–100", 1, false],
    ]);
    expect(unknown).toBe(1);
  });

  it("counts kinds of sites, largest first", () => {
    expect(siteTypeBreakdown([{ siteType: "forum" }, { siteType: "other" }, { siteType: "other" }, { siteType: "video" }])).toEqual([
      { type: "other", label: "Websites", count: 2 },
      { type: "forum", label: "Forums", count: 1 },
      { type: "video", label: "Video", count: 1 },
    ]);
    expect(siteTypeBreakdown([])).toEqual([]);
  });
});

import { describe, expect, it } from "vitest";

import { capitalize, formatCurrencyMicros, formatNumber, formatRelativeTime } from "@/lib/format";

describe("display formatting", () => {
  it("formats numbers and treats missing values as a dash", () => {
    expect(formatNumber(14_800)).toBe("14,800");
    expect(formatNumber(0)).toBe("0");
    expect(formatNumber(null)).toBe("—");
  });

  it("converts provider micros to dollars", () => {
    expect(formatCurrencyMicros(2_450_000)).toBe("$2.45");
    expect(formatCurrencyMicros(0)).toBe("$0.00");
    expect(formatCurrencyMicros(null)).toBe("—");
  });

  it("describes recent times relatively and older ones by date", () => {
    const now = new Date("2026-10-22T12:00:00.000Z");
    expect(formatRelativeTime("2026-10-22T11:59:30.000Z", now)).toBe("just now");
    expect(formatRelativeTime("2026-10-22T11:55:00.000Z", now)).toBe("5 minutes ago");
    expect(formatRelativeTime("2026-10-22T09:00:00.000Z", now)).toBe("3 hours ago");
    expect(formatRelativeTime("2026-10-21T12:00:00.000Z", now)).toBe("yesterday");
    expect(formatRelativeTime("2026-10-01T12:00:00.000Z", now)).toBe("Oct 1");
  });

  it("capitalizes labels", () => {
    expect(capitalize("commercial")).toBe("Commercial");
    expect(capitalize("")).toBe("");
  });
});

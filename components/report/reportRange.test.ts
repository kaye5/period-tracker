import { describe, expect, it } from "vitest";
import { toCivil } from "@/lib/date/civil";
import { formatReportRange, resolveReportRange, subtractMonths } from "./reportRange";

const d = (y: number, m: number, day: number) => toCivil(y, m, day);

describe("subtractMonths", () => {
  it("subtracts whole months within the same year", () => {
    expect(subtractMonths(d(2026, 7, 23), 3)).toBe(d(2026, 4, 23));
  });

  it("crosses a year boundary", () => {
    expect(subtractMonths(d(2026, 1, 15), 3)).toBe(d(2025, 10, 15));
  });

  it("clamps the day-of-month down when the target month is shorter (Mar 31 - 1mo)", () => {
    expect(subtractMonths(d(2026, 3, 31), 1)).toBe(d(2026, 2, 28)); // 2026 not a leap year
  });

  it("clamps to Feb 29 in a leap year", () => {
    expect(subtractMonths(d(2024, 3, 31), 1)).toBe(d(2024, 2, 29));
  });

  it("subtracts 12 months (a full year) cleanly", () => {
    expect(subtractMonths(d(2026, 7, 23), 12)).toBe(d(2025, 7, 23));
  });
});

describe("resolveReportRange", () => {
  const today = d(2026, 7, 23);

  it("3m/6m/12m presets always end today", () => {
    expect(resolveReportRange("3m", today).range).toEqual({ from: d(2026, 4, 23), to: today });
    expect(resolveReportRange("6m", today).range).toEqual({ from: d(2026, 1, 23), to: today });
    expect(resolveReportRange("12m", today).range).toEqual({ from: d(2025, 7, 23), to: today });
  });

  it("custom range with both dates set and from <= to resolves cleanly", () => {
    const result = resolveReportRange("custom", today, { from: d(2026, 1, 1), to: d(2026, 3, 1) });
    expect(result.error).toBeNull();
    expect(result.range).toEqual({ from: d(2026, 1, 1), to: d(2026, 3, 1) });
  });

  it("custom range missing either bound is an honest error, not a guess", () => {
    expect(resolveReportRange("custom", today, { from: null, to: d(2026, 3, 1) }).range).toBeNull();
    expect(resolveReportRange("custom", today, { from: d(2026, 1, 1), to: null }).error).not.toBeNull();
  });

  it("custom range with from after to is rejected", () => {
    const result = resolveReportRange("custom", today, { from: d(2026, 5, 1), to: d(2026, 1, 1) });
    expect(result.range).toBeNull();
    expect(result.error).toContain("start date");
  });

  it("custom range extending past today is clamped to today, not rejected", () => {
    const result = resolveReportRange("custom", today, { from: d(2026, 1, 1), to: d(2026, 12, 31) });
    expect(result.error).toBeNull();
    expect(result.range).toEqual({ from: d(2026, 1, 1), to: today });
  });
});

describe("formatReportRange", () => {
  it("formats both ends as full dates", () => {
    const text = formatReportRange({ from: d(2026, 1, 1), to: d(2026, 7, 23) });
    expect(text).toContain("Jan 1, 2026");
    expect(text).toContain("Jul 23, 2026");
  });
});

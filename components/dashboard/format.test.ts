import { describe, expect, it } from "vitest";
import type { CivilDate } from "@/lib/date/civil";
import {
  civilDateParts,
  formatCycleCount,
  formatDateRange,
  formatDayCount,
  formatLongDate,
  formatMonthDay,
} from "./format";

const d = (s: string) => s as CivilDate;

describe("civilDateParts", () => {
  it("reads year/month/day from a civil date string without constructing a Date", () => {
    expect(civilDateParts(d("2026-07-26"))).toEqual({ year: 2026, month: 7, day: 26 });
  });
});

describe("formatMonthDay", () => {
  it("formats month + day, no year", () => {
    expect(formatMonthDay(d("2026-07-26"))).toBe("July 26");
    expect(formatMonthDay(d("2026-01-01"))).toBe("January 1");
    expect(formatMonthDay(d("2026-12-31"))).toBe("December 31");
  });
});

describe("formatLongDate", () => {
  it("includes the year by default", () => {
    expect(formatLongDate(d("2026-07-26"))).toBe("July 26, 2026");
  });

  it("omits the year when it matches the reference year", () => {
    expect(formatLongDate(d("2026-07-26"), 2026)).toBe("July 26");
  });

  it("keeps the year when it differs from the reference year", () => {
    expect(formatLongDate(d("2025-07-26"), 2026)).toBe("July 26, 2025");
  });
});

describe("formatDateRange", () => {
  it("collapses same month + year: 'July 26–29'", () => {
    expect(formatDateRange(d("2026-07-26"), d("2026-07-29"))).toBe("July 26–29");
  });

  it("shows both months when they differ within the same year", () => {
    expect(formatDateRange(d("2026-07-29"), d("2026-08-02"))).toBe("July 29 – August 2");
  });

  it("shows both full dates with year when the range crosses a year boundary", () => {
    expect(formatDateRange(d("2026-12-30"), d("2027-01-02"))).toBe(
      "December 30, 2026 – January 2, 2027",
    );
  });

  it("handles a single-day range (low === high) without collapsing to one date", () => {
    expect(formatDateRange(d("2026-07-26"), d("2026-07-26"))).toBe("July 26–26");
  });
});

describe("formatDayCount", () => {
  it("pluralizes correctly", () => {
    expect(formatDayCount(1)).toBe("1 day");
    expect(formatDayCount(2)).toBe("2 days");
    expect(formatDayCount(0)).toBe("0 days");
  });

  it("takes the absolute value and rounds", () => {
    expect(formatDayCount(-3)).toBe("3 days");
    expect(formatDayCount(2.6)).toBe("3 days");
  });
});

describe("formatCycleCount", () => {
  it("pluralizes correctly", () => {
    expect(formatCycleCount(1)).toBe("1 cycle");
    expect(formatCycleCount(0)).toBe("0 cycles");
    expect(formatCycleCount(5)).toBe("5 cycles");
  });
});

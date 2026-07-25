import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import {
  buildQuickPeriodDayLog,
  buildQuickPeriodDayLogs,
  formatDragRangeLabel,
  isDateWithinDragRange,
  quickPeriodDatesInRange,
} from "./quickPeriodLog";

const TODAY = parseCivil("2026-07-23");

describe("quickPeriodDatesInRange", () => {
  it("is inclusive of both ends, chronological order", () => {
    const dates = quickPeriodDatesInRange({ start: parseCivil("2026-07-10"), end: parseCivil("2026-07-12") });
    expect(dates).toEqual([parseCivil("2026-07-10"), parseCivil("2026-07-11"), parseCivil("2026-07-12")]);
  });

  it("returns exactly one date for a single-day range", () => {
    const dates = quickPeriodDatesInRange({ start: parseCivil("2026-07-10"), end: parseCivil("2026-07-10") });
    expect(dates).toEqual([parseCivil("2026-07-10")]);
  });
});

describe("buildQuickPeriodDayLog", () => {
  it("creates a minimal menstrual-bleeding DayLog when nothing existed for the date", () => {
    const date = parseCivil("2026-07-10");
    const result = buildQuickPeriodDayLog(date, TODAY, undefined);
    expect(result).toEqual({
      date,
      bleeding: "menstrual",
      pain: { severity: "none" },
      symptoms: [],
      loggedAt: TODAY,
    });
  });

  it("preserves every other recorded field of an existing log (R7: never silently discard)", () => {
    const date = parseCivil("2026-07-10");
    const existing: DayLog = {
      date,
      bleeding: "spotting",
      pain: { severity: "moderate", sites: ["back"] },
      symptoms: ["cramps", "fatigue"],
      mood: ["low"],
      notes: "felt off today",
      loggedAt: parseCivil("2026-07-09"), // a back-entry — must survive untouched
    };
    const result = buildQuickPeriodDayLog(date, TODAY, existing);
    expect(result.bleeding).toBe("menstrual");
    expect(result.pain).toEqual({ severity: "moderate", sites: ["back"] });
    expect(result.symptoms).toEqual(["cramps", "fatigue"]);
    expect(result.mood).toEqual(["low"]);
    expect(result.notes).toBe("felt off today");
    expect(result.loggedAt).toBe(parseCivil("2026-07-09"));
  });

  it("clears nothingToReport, since the day can't be both a true negative and a period day", () => {
    const date = parseCivil("2026-07-10");
    const existing: DayLog = {
      date,
      bleeding: "none",
      pain: { severity: "none" },
      symptoms: [],
      nothingToReport: true,
      loggedAt: date,
    };
    const result = buildQuickPeriodDayLog(date, TODAY, existing);
    expect(result.nothingToReport).toBeUndefined();
    expect(result.bleeding).toBe("menstrual");
  });
});

describe("buildQuickPeriodDayLogs", () => {
  it("builds one payload per date in the range, looking each up in the provided map", () => {
    const existingDate = parseCivil("2026-07-11");
    const existing: DayLog = {
      date: existingDate,
      bleeding: "none",
      pain: { severity: "none" },
      symptoms: ["bloating"],
      loggedAt: existingDate,
    };
    const map = new Map([[existingDate, existing]]);
    const results = buildQuickPeriodDayLogs(
      { start: parseCivil("2026-07-10"), end: parseCivil("2026-07-11") },
      TODAY,
      map,
    );
    expect(results).toHaveLength(2);
    expect(results[0].date).toBe(parseCivil("2026-07-10"));
    expect(results[0].symptoms).toEqual([]);
    expect(results[1].date).toBe(existingDate);
    expect(results[1].symptoms).toEqual(["bloating"]);
    expect(results.every((r) => r.bleeding === "menstrual")).toBe(true);
  });
});

describe("formatDragRangeLabel", () => {
  it("uses singular phrasing for a one-day range", () => {
    const label = formatDragRangeLabel({ start: parseCivil("2026-07-10"), end: parseCivil("2026-07-10") });
    expect(label).toBe("Mark Jul 10 as a period day?");
  });

  it("uses plural phrasing with a count and both endpoints for a multi-day range", () => {
    const label = formatDragRangeLabel({ start: parseCivil("2026-07-10"), end: parseCivil("2026-07-12") });
    expect(label).toBe("Mark 3 days (Jul 10 to Jul 12) as period days?");
  });
});

describe("isDateWithinDragRange", () => {
  const range = { start: parseCivil("2026-07-10"), end: parseCivil("2026-07-12") };

  it("is false for a null range", () => {
    expect(isDateWithinDragRange(parseCivil("2026-07-11"), null)).toBe(false);
  });

  it("is true for both endpoints and everything between", () => {
    expect(isDateWithinDragRange(parseCivil("2026-07-10"), range)).toBe(true);
    expect(isDateWithinDragRange(parseCivil("2026-07-11"), range)).toBe(true);
    expect(isDateWithinDragRange(parseCivil("2026-07-12"), range)).toBe(true);
  });

  it("is false just outside either end", () => {
    expect(isDateWithinDragRange(parseCivil("2026-07-09"), range)).toBe(false);
    expect(isDateWithinDragRange(parseCivil("2026-07-13"), range)).toBe(false);
  });
});

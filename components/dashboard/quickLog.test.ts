import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { Cycle, DayLog } from "@/lib/domain/types";
import { applyQuickAction, quickPeriodStatus, quickSymptoms } from "./quickLog";

const TODAY = parseCivil("2026-11-14");
const YESTERDAY = parseCivil("2026-11-13");

const rich: DayLog = {
  date: TODAY,
  bleeding: "none",
  pain: { severity: "mild", sites: ["back"] },
  symptoms: ["headache"],
  notes: "keep me",
  nothingToReport: true,
  loggedAt: YESTERDAY,
};

function cycle(start: string, menstrualDays: string[], endDate: string | null): Cycle {
  return {
    index: 0,
    startDate: parseCivil(start),
    nextStartDate: null,
    lengthDays: null,
    status: "in_progress",
    weight: 1,
    episode: {
      startDate: parseCivil(start),
      endDate: endDate === null ? null : parseCivil(endDate),
      menstrualDays: menstrualDays.map(parseCivil),
      spottingDays: [],
      durationDays: null,
      endInferred: true,
    },
  } as Cycle;
}

describe("applyQuickAction", () => {
  it("creates a minimal log for a period start on an empty day", () => {
    expect(applyQuickAction(undefined, { kind: "period", on: true, start: true }, TODAY, TODAY)).toEqual({
      date: TODAY,
      bleeding: "menstrual",
      periodBoundary: "start",
      pain: { severity: "none" },
      symptoms: [],
      nothingToReport: undefined,
      loggedAt: TODAY,
    });
  });

  it("keeps every other recorded fact and the original loggedAt", () => {
    const out = applyQuickAction(rich, { kind: "mood", mood: "calm" }, TODAY, TODAY);
    expect(out).toMatchObject({ pain: rich.pain, symptoms: ["headache"], notes: "keep me", loggedAt: YESTERDAY });
    expect(out.mood).toEqual(["calm"]);
    expect(out.nothingToReport).toBeUndefined();
  });

  it("toggles moods and symptoms off again", () => {
    const once = applyQuickAction(rich, { kind: "mood", mood: "calm" }, TODAY, TODAY);
    expect(applyQuickAction(once, { kind: "mood", mood: "calm" }, TODAY, TODAY).mood).toBeUndefined();
    expect(applyQuickAction(rich, { kind: "symptom", symptom: "headache" }, TODAY, TODAY).symptoms).toEqual([]);
  });

  it("period off clears flow and boundary but keeps the rest", () => {
    const on = applyQuickAction(rich, { kind: "flow", flow: "heavy" }, TODAY, TODAY);
    expect(on.bleeding).toBe("menstrual");
    const off = applyQuickAction(on, { kind: "period", on: false }, TODAY, TODAY);
    expect(off).toMatchObject({ bleeding: "none", flow: undefined, periodBoundary: undefined, notes: "keep me" });
  });

  it("last day marks the end boundary on a period day", () => {
    const out = applyQuickAction(undefined, { kind: "lastDay", on: true }, YESTERDAY, TODAY);
    expect(out).toMatchObject({ date: YESTERDAY, bleeding: "menstrual", periodBoundary: "end" });
  });

  it("nothing-to-report replaces the day with a true negative", () => {
    const out = applyQuickAction(rich, { kind: "nothing" }, TODAY, TODAY);
    expect(out).toEqual({
      date: TODAY,
      bleeding: "none",
      pain: { severity: "none" },
      symptoms: [],
      nothingToReport: true,
      loggedAt: YESTERDAY,
    });
  });
});

describe("quickPeriodStatus", () => {
  it("is 'today' when today is already a period day", () => {
    expect(quickPeriodStatus({ ...rich, bleeding: "menstrual" }, [], TODAY)).toEqual({ kind: "today" });
  });

  it("is 'ongoing' with the last recorded day for a recent open period", () => {
    const cycles = [cycle("2026-11-11", ["2026-11-11", "2026-11-12", "2026-11-13"], null)];
    expect(quickPeriodStatus(undefined, cycles, TODAY)).toEqual({ kind: "ongoing", lastPeriodDay: YESTERDAY });
  });

  it("is 'none' for a closed period or one left open for too long", () => {
    expect(quickPeriodStatus(undefined, [cycle("2026-11-11", ["2026-11-11"], "2026-11-11")], TODAY)).toEqual({ kind: "none" });
    expect(quickPeriodStatus(undefined, [cycle("2026-09-01", ["2026-09-01"], null)], TODAY)).toEqual({ kind: "none" });
  });
});

describe("quickSymptoms", () => {
  it("puts the most-logged first, then fills from the fallback without duplicates", () => {
    const freq = [
      { symptom: "bloating" as const, occurrences: 2 },
      { symptom: "acne" as const, occurrences: 5 },
      { symptom: "fatigue" as const, occurrences: 0 },
    ];
    expect(quickSymptoms(freq, ["cramps", "acne", "headache"], 4)).toEqual(["acne", "bloating", "cramps", "headache"]);
  });
});

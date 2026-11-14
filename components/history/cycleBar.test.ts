import { describe, expect, it } from "vitest";
import { toCivil } from "@/lib/date/civil";
import type { Cycle } from "@/lib/domain/types";
import { cycleBarDays, cycleBarScale, toPct } from "./cycleBar";

const d = (day: number) => toCivil(2026, 1, day);

function cycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    index: 0,
    startDate: d(1),
    nextStartDate: d(30),
    lengthDays: 29,
    status: "ok",
    weight: 1,
    episode: {
      startDate: d(1),
      endDate: d(5),
      menstrualDays: [d(1), d(2), d(3), d(4), d(5)],
      spottingDays: [],
      durationDays: 5,
      endInferred: false,
    },
    ...overrides,
  };
}

describe("cycleBarDays", () => {
  it("uses the recorded length and period duration for a completed cycle", () => {
    expect(cycleBarDays(cycle(), d(20), 28)).toEqual({ days: 29, periodDays: 5, estimateDays: 0 });
  });

  it("ends the in-progress cycle at today and marks the rest up to the typical length as estimate", () => {
    const c = cycle({ nextStartDate: null, lengthDays: null, status: "in_progress" });
    expect(cycleBarDays(c, d(10), 28.4)).toEqual({ days: 10, periodDays: 5, estimateDays: 18 });
    expect(cycleBarDays(c, d(10), null).estimateDays).toBe(0);
    expect(cycleBarDays(c, d(31), 28).estimateDays).toBe(0);
  });

  it("falls back to the last menstrual day for an ongoing period and clamps to the bar", () => {
    const c = cycle({
      nextStartDate: null,
      lengthDays: null,
      episode: { ...cycle().episode, endDate: null, durationDays: null, menstrualDays: [d(1), d(2), d(3)] },
    });
    expect(cycleBarDays(c, d(2), null)).toEqual({ days: 2, periodDays: 2, estimateDays: 0 });
  });
});

describe("cycleBarScale", () => {
  it("spans the longest bar including estimate, or the average when longer", () => {
    expect(cycleBarScale([{ days: 30, periodDays: 5, estimateDays: 0 }, { days: 10, periodDays: 4, estimateDays: 25 }], 28)).toBe(35);
    expect(cycleBarScale([{ days: 20, periodDays: 5, estimateDays: 0 }], 28)).toBe(28);
    expect(toPct(14, 28)).toBe(50);
  });
});

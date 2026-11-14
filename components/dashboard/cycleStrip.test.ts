import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { Cycle, FertilityEstimate, PredictionResult } from "@/lib/domain/types";
import { buildCycleStrip } from "./cycleStrip";

const current = {
  index: 0,
  startDate: parseCivil("2026-11-01"),
  nextStartDate: null,
  lengthDays: null,
  status: "in_progress",
  weight: 1,
  episode: {
    startDate: parseCivil("2026-11-01"),
    endDate: parseCivil("2026-11-04"),
    menstrualDays: ["2026-11-01", "2026-11-02", "2026-11-03", "2026-11-04"].map(parseCivil),
    spottingDays: [],
    durationDays: 4,
    endInferred: false,
  },
} as Cycle;

const prediction = {
  center: parseCivil("2026-11-29"),
  high: parseCivil("2026-12-02"),
  low: parseCivil("2026-11-26"),
} as PredictionResult;

const fertility = {
  fertileLow: parseCivil("2026-11-10"),
  fertileHigh: parseCivil("2026-11-15"),
  ovulationLow: parseCivil("2026-11-14"),
  ovulationHigh: parseCivil("2026-11-15"),
} as FertilityEstimate;

describe("buildCycleStrip", () => {
  it("spans cycle start to the day before the predicted next start", () => {
    const strip = buildCycleStrip({ cycles: [current], prediction, fertility: null, today: parseCivil("2026-11-14") })!;
    expect(strip.days).toHaveLength(28);
    expect(strip.todayIndex).toBe(13);
    expect(strip.days.slice(0, 5).map((d) => d.kind)).toEqual(["menstrual", "menstrual", "menstrual", "menstrual", "unknown"]);
    expect(strip.days[13].future).toBe(false);
    expect(strip.days[14].future).toBe(true);
  });

  it("uses the engine's phase estimate only when fertility is on", () => {
    const strip = buildCycleStrip({ cycles: [current], prediction, fertility, today: parseCivil("2026-11-14") })!;
    expect(strip.days[5].kind).toBe("follicular");
    expect(strip.days[13].kind).toBe("ovulatory");
    expect(strip.days[20].kind).toBe("luteal");
  });

  it("stretches to today when the period is overdue, and is null with no prediction", () => {
    const late = buildCycleStrip({ cycles: [current], prediction, fertility: null, today: parseCivil("2026-12-05") })!;
    expect(late.days).toHaveLength(35);
    expect(late.todayIndex).toBe(34);
    expect(
      buildCycleStrip({ cycles: [current], prediction: { ...prediction, center: null }, fertility: null, today: parseCivil("2026-11-14") }),
    ).toBeNull();
  });
});

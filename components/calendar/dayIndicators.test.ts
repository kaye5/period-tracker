import { describe, expect, it } from "vitest";
import { parseCivil, type CivilDate } from "@/lib/date/civil";
import type { DayLog, FertilityEstimate, PredictionResult } from "@/lib/domain/types";
import { computeDayIndicators, describeDayIndicators } from "./dayIndicators";

const TODAY = parseCivil("2026-07-22");

function makeDayLog(overrides: Partial<DayLog> = {}): DayLog {
  return {
    date: TODAY,
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: TODAY,
    ...overrides,
  };
}

function makePrediction(overrides: Partial<PredictionResult> = {}): PredictionResult {
  return {
    kind: "personal",
    center: parseCivil("2026-08-05"),
    low: parseCivil("2026-08-02"),
    high: parseCivil("2026-08-08"),
    predictedLengthDays: 28,
    confidence: "more_consistent",
    confidenceReason: "test",
    basis: { usableCycles: 6, windowCycles: 6, effectiveN: 6, sigma: 2, halfWidthDays: 3, calibrationFactor: 1 },
    ...overrides,
  };
}

function makeFertility(overrides: Partial<FertilityEstimate> = {}): FertilityEstimate {
  return {
    ovulationLow: parseCivil("2026-07-20"),
    ovulationHigh: parseCivil("2026-07-24"),
    fertileLow: parseCivil("2026-07-17"),
    fertileHigh: parseCivil("2026-07-25"),
    confidenceNote: "test",
    disclaimer: "test",
    ...overrides,
  };
}

describe("computeDayIndicators", () => {
  it("flags today", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isToday).toBe(true);
  });

  it("is not today for any other date", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-21"),
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isToday).toBe(false);
  });

  it("reports recorded menstrual bleeding", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual", flow: "medium" }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.recordedBleeding).toBe("menstrual");
    expect(result.hasLog).toBe(true);
  });

  it("marks a menstrual day whose previous day was not menstrual as the period start", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      previousBleeding: "none",
      nextBleeding: "menstrual",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPeriodStart).toBe(true);
    expect(result.isPeriodEnd).toBe(false);
  });

  it("marks a menstrual day whose next day was not menstrual as the period end", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      previousBleeding: "menstrual",
      nextBleeding: "none",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPeriodStart).toBe(false);
    expect(result.isPeriodEnd).toBe(true);
  });

  it("treats a menstrual day between two menstrual days as neither start nor end", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      previousBleeding: "menstrual",
      nextBleeding: "menstrual",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPeriodStart).toBe(false);
    expect(result.isPeriodEnd).toBe(false);
  });

  it("honours an explicit periodBoundary even when neighbours would say otherwise", () => {
    const end = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual", periodBoundary: "end" }),
      previousBleeding: "menstrual",
      nextBleeding: "menstrual", // engine would say "middle", but the user said "last day"
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(end.isPeriodEnd).toBe(true);
  });

  it("marks a lone menstrual day (no menstrual neighbours) as both start and end", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      previousBleeding: "none",
      nextBleeding: "none",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPeriodStart).toBe(true);
    expect(result.isPeriodEnd).toBe(true);
  });

  it("never flags start/end on a non-menstrual day", () => {
    const spotting = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "spotting" }),
      previousBleeding: "none",
      nextBleeding: "none",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(spotting.isPeriodStart).toBe(false);
    expect(spotting.isPeriodEnd).toBe(false);
  });

  it("reports recorded spotting distinctly from menstrual bleeding", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "spotting" }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.recordedBleeding).toBe("spotting");
    expect(result.recordedBleeding).not.toBe("menstrual");
  });

  it("flags nothingToReport as a known (not unknown) day", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ nothingToReport: true }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.hasLog).toBe(true);
    expect(result.loggedNothingToReport).toBe(true);
  });

  it("flags symptoms-or-notes independent of bleeding", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ symptoms: ["cramps"] }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.hasSymptomsOrNotes).toBe(true);
  });

  it("flags symptoms-or-notes for notes alone", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ notes: "felt off" }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.hasSymptomsOrNotes).toBe(true);
  });

  it("does not flag symptoms-or-notes for a bare nothingToReport day", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ nothingToReport: true }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.hasSymptomsOrNotes).toBe(false);
  });

  it("marks a day inside the predicted range as predicted when nothing was recorded", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-08-05"),
      today: TODAY,
      dayLog: null,
      prediction: makePrediction(),
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPredictedPeriod).toBe(true);
  });

  it("does not mark a day outside the predicted range as predicted", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-08-20"),
      today: TODAY,
      dayLog: null,
      prediction: makePrediction(),
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPredictedPeriod).toBe(false);
  });

  it("suppresses the predicted marker on a day that already has recorded bleeding (recorded wins)", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-08-05"),
      today: TODAY,
      dayLog: makeDayLog({ date: parseCivil("2026-08-05"), bleeding: "menstrual" }),
      prediction: makePrediction(),
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPredictedPeriod).toBe(false);
    expect(result.recordedBleeding).toBe("menstrual");
  });

  it("never shows fertility indicators when fertilityEnabled is false, even with fertility data present", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-21"),
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: makeFertility(),
      fertilityEnabled: false,
    });
    expect(result.isFertileWindow).toBe(false);
    expect(result.isOvulationWindow).toBe(false);
  });

  it("shows the fertile window and ovulation range only when enabled", () => {
    const fertileDay = computeDayIndicators({
      date: parseCivil("2026-07-18"),
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: makeFertility(),
      fertilityEnabled: true,
    });
    expect(fertileDay.isFertileWindow).toBe(true);
    expect(fertileDay.isOvulationWindow).toBe(false);

    const ovulationDay = computeDayIndicators({
      date: parseCivil("2026-07-22"),
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: makeFertility(),
      fertilityEnabled: true,
    });
    expect(ovulationDay.isFertileWindow).toBe(true);
    expect(ovulationDay.isOvulationWindow).toBe(true);
  });

  it("range bounds are inclusive", () => {
    const lowBoundary = computeDayIndicators({
      date: parseCivil("2026-08-02"),
      today: TODAY,
      dayLog: null,
      prediction: makePrediction(),
      fertility: null,
      fertilityEnabled: false,
    });
    const highBoundary = computeDayIndicators({
      date: parseCivil("2026-08-08"),
      today: TODAY,
      dayLog: null,
      prediction: makePrediction(),
      fertility: null,
      fertilityEnabled: false,
    });
    expect(lowBoundary.isPredictedPeriod).toBe(true);
    expect(highBoundary.isPredictedPeriod).toBe(true);
  });

  it("treats a null prediction center/low/high (suppressed prediction) as no predicted days", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-08-05"),
      today: TODAY,
      dayLog: null,
      prediction: makePrediction({ low: null, high: null, center: null }),
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPredictedPeriod).toBe(false);
  });
});

describe("describeDayIndicators", () => {
  it("names every indicator kind as a non-colour text fragment", () => {
    const base: CivilDate = TODAY;
    const combos: Array<[string, Parameters<typeof computeDayIndicators>[0]]> = [
      [
        "period recorded",
        { date: base, today: TODAY, dayLog: makeDayLog({ bleeding: "menstrual" }), prediction: null, fertility: null, fertilityEnabled: false },
      ],
      [
        "spotting recorded",
        { date: base, today: TODAY, dayLog: makeDayLog({ bleeding: "spotting" }), prediction: null, fertility: null, fertilityEnabled: false },
      ],
      [
        "predicted period range",
        { date: parseCivil("2026-08-05"), today: TODAY, dayLog: null, prediction: makePrediction(), fertility: null, fertilityEnabled: false },
      ],
      [
        "estimated fertile window",
        { date: parseCivil("2026-07-18"), today: TODAY, dayLog: null, prediction: null, fertility: makeFertility(), fertilityEnabled: true },
      ],
      [
        "estimated ovulation range",
        { date: parseCivil("2026-07-22"), today: TODAY, dayLog: null, prediction: null, fertility: makeFertility(), fertilityEnabled: true },
      ],
      [
        "symptoms or notes logged",
        { date: base, today: TODAY, dayLog: makeDayLog({ symptoms: ["headache"] }), prediction: null, fertility: null, fertilityEnabled: false },
      ],
      [
        "today",
        { date: TODAY, today: TODAY, dayLog: null, prediction: null, fertility: null, fertilityEnabled: false },
      ],
    ];

    for (const [expectedFragment, input] of combos) {
      const fragments = describeDayIndicators(computeDayIndicators(input));
      expect(fragments.some((f) => f.includes(expectedFragment))).toBe(true);
      // Every fragment must be prose, not a colour name or a CSS token — the guard
      // against "colour alone carries meaning" (SPEC.md §4.2).
      for (const fragment of fragments) {
        expect(fragment).not.toMatch(/#[0-9a-f]{3,6}\b/i);
        expect(fragment).not.toMatch(/\b(red|pink|teal|amber|colou?r)\b/i);
      }
    }
  });

  it("falls back to a plain 'no records' fragment for an empty day", () => {
    const fragments = describeDayIndicators(
      computeDayIndicators({
        date: parseCivil("2026-07-10"),
        today: TODAY,
        dayLog: null,
        prediction: null,
        fertility: null,
        fertilityEnabled: false,
      }),
    );
    expect(fragments).toEqual(["no records"]);
  });
});

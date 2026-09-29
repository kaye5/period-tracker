import { describe, expect, it } from "vitest";
import { parseCivil, type CivilDate } from "@/lib/date/civil";
import type { Cycle, DayLog, FertilityEstimate, PredictionResult } from "@/lib/domain/types";
import {
  computeDayIndicators,
  describeDayIndicators,
  expectedPeriodRange,
  predictedPeriodRange,
} from "./dayIndicators";

const TODAY = parseCivil("2026-07-22");
/** A day strictly before TODAY. End-of-period can only be INFERRED for days whose
 * following day has already happened; see computeDayIndicators. */
const PAST = parseCivil("2026-07-10");

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

/** The predicted BLEEDING SPAN for `makePrediction()` (centre 2026-08-05) at a 5-day
 * typical period: 08-05..08-09. `prediction.low..high` is NOT this — it is start-date
 * uncertainty and must never reach the grid (see predictedPeriodRange). */
const PREDICTED_SPAN = predictedPeriodRange(
  { center: parseCivil("2026-08-05") } as PredictionResult,
  5,
  TODAY,
);

function makeCycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    index: -1,
    startDate: parseCivil("2026-07-01"),
    nextStartDate: null,
    lengthDays: null,
    status: "in_progress",
    weight: 1.0,
    episode: {
      startDate: parseCivil("2026-07-01"),
      endDate: null,
      menstrualDays: [parseCivil("2026-07-01")],
      spottingDays: [],
      durationDays: null,
      endInferred: true,
    },
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

  it("marks a past menstrual day whose next day was not menstrual as the period end", () => {
    const result = computeDayIndicators({
      date: PAST,
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

  it("marks a lone PAST menstrual day (no menstrual neighbours) as both start and end", () => {
    const result = computeDayIndicators({
      date: PAST,
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

  it("does not infer a period end when the next day has no log — it may still be ongoing", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      previousBleeding: "none",
      // nextBleeding omitted === that day has no log at all.
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPeriodStart).toBe(true);
    expect(result.isPeriodEnd).toBe(false);
    expect(describeDayIndicators(result)).toContain("period recorded, first day");
  });

  it("still honours an explicit end boundary logged on today", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual", periodBoundary: "end" }),
      previousBleeding: "menstrual",
      nextBleeding: "none",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
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
      predictedPeriod: PREDICTED_SPAN,
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
      predictedPeriod: PREDICTED_SPAN,
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
      predictedPeriod: PREDICTED_SPAN,
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

  it("marks the predicted BLEEDING SPAN inclusively, and nothing beyond it", () => {
    const on = (date: string) =>
      computeDayIndicators({
        date: parseCivil(date),
        today: TODAY,
        dayLog: null,
        prediction: makePrediction(),
        predictedPeriod: PREDICTED_SPAN,
        fertility: null,
        fertilityEnabled: false,
      }).isPredictedPeriod;

    // Span is centre (08-05) .. centre + 4 (08-09), inclusive at both ends.
    expect(on("2026-08-05")).toBe(true);
    expect(on("2026-08-09")).toBe(true);
    // The reported bug: `prediction.low..high` is the START-DATE uncertainty band
    // (08-02..08-08 here), which at low cycle counts is ±8-15 days and dashed most of the
    // month. Days inside that band but outside the bleeding span must stay unmarked.
    expect(on("2026-08-02")).toBe(false);
    expect(on("2026-08-04")).toBe(false);
    expect(on("2026-08-10")).toBe(false);
  });

  it("draws no predicted days once the whole predicted span is already past", () => {
    // An overdue period leaves `prediction.center` where it was, so without this the
    // grid dashed five days in a month the user has scrolled past and showed nothing at
    // all in the current one. The (stale) range is still stated on the dashboard card.
    const overdueToday = parseCivil("2026-09-20");
    expect(predictedPeriodRange(makePrediction(), 5, overdueToday)).toBeNull();
    expect(
      computeDayIndicators({
        date: parseCivil("2026-08-05"),
        today: overdueToday,
        dayLog: null,
        prediction: makePrediction(),
        predictedPeriod: predictedPeriodRange(makePrediction(), 5, overdueToday),
        fertility: null,
        fertilityEnabled: false,
      }).isPredictedPeriod,
    ).toBe(false);
  });

  it("treats a suppressed prediction (null centre) as no predicted days at all", () => {
    const suppressed = makePrediction({ low: null, high: null, center: null });
    expect(predictedPeriodRange(suppressed, 5, TODAY)).toBeNull();
    const result = computeDayIndicators({
      date: parseCivil("2026-08-05"),
      today: TODAY,
      dayLog: null,
      prediction: suppressed,
      predictedPeriod: predictedPeriodRange(suppressed, 5, TODAY),
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPredictedPeriod).toBe(false);
  });
});

describe("computeDayIndicators — phase", () => {
  const cycle = makeCycle(); // starts 2026-07-01, in-progress
  const prediction = makePrediction(); // high 2026-08-08
  const fertility = makeFertility(); // ovulationLow 07-20, ovulationHigh 07-24

  it("keeps the OVARIAN phase on a recorded bleeding day", () => {
    // The reported bug: `cyclePhase` short-circuited to "menstrual" whenever isBleeding,
    // so a logged period day carried no follicular/luteal information and DayCell drew no
    // phase underline. The menstrual phase is a SUBSET of the follicular phase; the
    // bleeding fact is carried separately by the cell's fill and droplet glyph.
    const result = computeDayIndicators({
      date: parseCivil("2026-07-01"),
      today: TODAY,
      dayLog: makeDayLog({ date: parseCivil("2026-07-01"), bleeding: "menstrual" }),
      prediction,
      fertility,
      fertilityEnabled: true,
      cycles: [cycle],
    });
    expect(result.phase).toBe("follicular");
    expect(describeDayIndicators(result)).toEqual([
      "period recorded, first day",
      "estimated follicular phase",
    ]);
  });

  it("is follicular before the estimated ovulation window", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-05"),
      today: TODAY,
      dayLog: null,
      prediction,
      fertility,
      fertilityEnabled: true,
      cycles: [cycle],
    });
    expect(result.phase).toBe("follicular");
  });

  it("is ovulatory within the estimated ovulation window", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-22"),
      today: TODAY,
      dayLog: null,
      prediction,
      fertility,
      fertilityEnabled: true,
      cycles: [cycle],
    });
    expect(result.phase).toBe("ovulatory");
  });

  it("is luteal after the estimated ovulation window (and before the predicted high)", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-26"),
      today: TODAY,
      dayLog: null,
      prediction,
      fertility,
      fertilityEnabled: true,
      cycles: [cycle],
    });
    expect(result.phase).toBe("luteal");
  });

  it("is null when fertility is disabled, even on an otherwise-classifiable day", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-05"),
      today: TODAY,
      dayLog: null,
      prediction,
      fertility,
      fertilityEnabled: false,
      cycles: [cycle],
    });
    expect(result.phase).toBeNull();
  });

  it("is null for a date outside every known cycle's bounds", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-06-15"), // before the only cycle's startDate
      today: TODAY,
      dayLog: null,
      prediction,
      fertility,
      fertilityEnabled: true,
      cycles: [cycle],
    });
    expect(result.phase).toBeNull();
  });

  it("is null when no cycles are passed at all", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-05"),
      today: TODAY,
      dayLog: null,
      prediction,
      fertility,
      fertilityEnabled: true,
    });
    expect(result.phase).toBeNull();
  });

  it("gives days in a PAST cycle no phase at all", () => {
    const completed = makeCycle({
      index: 0,
      startDate: parseCivil("2026-06-01"),
      nextStartDate: parseCivil("2026-07-01"),
      status: "ok",
    });
    // `fertility` is a single estimate derived backwards from the NEXT predicted period,
    // so it says nothing about where ovulation fell in an earlier cycle. Classifying
    // historical days against it made the whole calendar history "follicular" — including
    // the days right before a past period, which are the opposite phase.
    for (const day of ["2026-06-05", "2026-06-15", "2026-06-25", "2026-06-30"]) {
      const result = computeDayIndicators({
        date: parseCivil(day),
        today: TODAY,
        dayLog: null,
        prediction,
        fertility,
        fertilityEnabled: true,
        cycles: [cycle, completed],
      });
      expect(result.phase, `${day} should have no phase`).toBeNull();
    }
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
        { date: parseCivil("2026-08-05"), today: TODAY, dayLog: null, prediction: makePrediction(), predictedPeriod: PREDICTED_SPAN, fertility: null, fertilityEnabled: false },
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
        "estimated follicular phase",
        {
          date: parseCivil("2026-07-05"),
          today: TODAY,
          dayLog: null,
          prediction: makePrediction(),
          fertility: makeFertility(),
          fertilityEnabled: true,
          cycles: [makeCycle()],
        },
      ],
      [
        "estimated luteal phase",
        {
          date: parseCivil("2026-07-26"),
          today: TODAY,
          dayLog: null,
          prediction: makePrediction(),
          fertility: makeFertility(),
          fertilityEnabled: true,
          cycles: [makeCycle()],
        },
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

describe("expectedPeriodRange", () => {
  const ongoing = makeCycle({
    startDate: parseCivil("2026-07-20"),
    episode: {
      startDate: parseCivil("2026-07-20"),
      endDate: null,
      menstrualDays: [parseCivil("2026-07-20"), parseCivil("2026-07-21")],
      spottingDays: [],
      durationDays: null,
      endInferred: true,
    },
  });
  const duration = 5; // typical period length in days

  it("spans from the day after the last logged day to the typical end", () => {
    // Started 07-20, typically 5 days => through 07-24; last logged 07-21 => from 07-22.
    expect(expectedPeriodRange([ongoing], duration, TODAY)).toEqual({
      from: parseCivil("2026-07-22"),
      through: parseCivil("2026-07-24"),
    });
  });

  it("is null once the period has already run its typical length", () => {
    const longRun = makeCycle({
      startDate: parseCivil("2026-07-20"),
      episode: {
        startDate: parseCivil("2026-07-20"),
        endDate: null,
        menstrualDays: [
          parseCivil("2026-07-20"),
          parseCivil("2026-07-21"),
          parseCivil("2026-07-22"),
          parseCivil("2026-07-23"),
          parseCivil("2026-07-24"),
        ],
        spottingDays: [],
        durationDays: null,
        endInferred: true,
      },
    });
    expect(expectedPeriodRange([longRun], duration, TODAY)).toBeNull();
  });

  it("is null once the whole expected span is in the past", () => {
    // An episode the engine never closed (the user simply stopped logging) kept painting
    // dotted "period expected to continue" cells in a historical month forever. An
    // expectation about days that have already passed unlogged is not an expectation.
    const staleToday = parseCivil("2026-09-29");
    expect(expectedPeriodRange([ongoing], duration, staleToday)).toBeNull();
  });

  it("is null with no typical length yet, and null when the episode is closed", () => {
    expect(expectedPeriodRange([ongoing], null, TODAY)).toBeNull();
    const closed = makeCycle({
      episode: { ...ongoing.episode, endDate: parseCivil("2026-07-22") },
    });
    expect(expectedPeriodRange([closed], duration, TODAY)).toBeNull();
  });
});

describe("computeDayIndicators — expected period days", () => {
  const expectedPeriod = { from: parseCivil("2026-07-22"), through: parseCivil("2026-07-24") };

  it("marks an unlogged day inside the expected range", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-23"),
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      expectedPeriod,
    });
    expect(result.isExpectedPeriodDay).toBe(true);
    expect(describeDayIndicators(result)).toContain("period expected to continue");
  });

  it("never overrides a day that has a log, and stays off outside the range", () => {
    const logged = computeDayIndicators({
      date: parseCivil("2026-07-23"),
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "none", nothingToReport: true }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      expectedPeriod,
    });
    expect(logged.isExpectedPeriodDay).toBe(false);

    const after = computeDayIndicators({
      date: parseCivil("2026-07-25"),
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      expectedPeriod,
    });
    expect(after.isExpectedPeriodDay).toBe(false);
  });
});

describe("computeDayIndicators — period end needs positive evidence", () => {
  it("DOES infer an end when the next day is logged as not bleeding", () => {
    const result = computeDayIndicators({
      date: TODAY,
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      previousBleeding: "menstrual",
      nextBleeding: "none", // explicitly logged, not merely absent
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPeriodEnd).toBe(true);
  });

  it("does NOT infer an end for a past day whose next day was never logged", () => {
    // The reported bug: yesterday logged as a period day, today not yet logged, and
    // yesterday rendered with both a start and an end badge.
    const result = computeDayIndicators({
      date: parseCivil("2026-07-21"),
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      previousBleeding: "none",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
    });
    expect(result.isPeriodStart).toBe(true);
    expect(result.isPeriodEnd).toBe(false);
  });
});

describe("computeDayIndicators — boundaries come from engine episodes", () => {
  const ongoingEpisode = {
    startDate: parseCivil("2026-07-20"),
    endDate: null,
    menstrualDays: [parseCivil("2026-07-20"), parseCivil("2026-07-21")],
    spottingDays: [],
    durationDays: null,
    endInferred: true,
  };

  it("shows no end badge on an open episode, even when the next day is logged as none", () => {
    // The reported bug: a logged "nothing to report" (or any log) on the following day
    // was enough for the calendar to close the period, so the day rendered with BOTH a
    // start and an end badge although the user never marked the period as ended.
    const result = computeDayIndicators({
      date: parseCivil("2026-07-21"),
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      nextBleeding: "none",
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      episodes: [ongoingEpisode],
    });
    expect(result.isPeriodEnd).toBe(false);
    expect(describeDayIndicators(result)).not.toContain("period recorded, last day");
  });

  it("marks the start day of an open episode", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-20"),
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      episodes: [ongoingEpisode],
    });
    expect(result.isPeriodStart).toBe(true);
    expect(result.isPeriodEnd).toBe(false);
  });

  it("marks the end day once the engine has actually closed the episode", () => {
    const closed = { ...ongoingEpisode, endDate: parseCivil("2026-07-21"), durationDays: 2 };
    const result = computeDayIndicators({
      date: parseCivil("2026-07-21"),
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual" }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      episodes: [closed],
    });
    expect(result.isPeriodEnd).toBe(true);
  });

  it("still honours an explicit user-logged end on an open episode", () => {
    const result = computeDayIndicators({
      date: parseCivil("2026-07-21"),
      today: TODAY,
      dayLog: makeDayLog({ bleeding: "menstrual", periodBoundary: "end" }),
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      episodes: [ongoingEpisode],
    });
    expect(result.isPeriodEnd).toBe(true);
  });
});

describe("period length is bounded before it is painted", () => {
  it("clamps an out-of-range typical length instead of marking the whole month", () => {
    // `reportedTypicalPeriodDays` reaches us from a number input whose `max` attribute is
    // not enforced on a typed value, and `stats.periodDuration` is whatever was logged.
    // An unclamped length here is the original "the whole month is a period" bug again.
    const range = predictedPeriodRange(
      makePrediction({ center: parseCivil("2026-07-25") }),
      90,
      TODAY,
    );
    expect(range).toEqual({ from: parseCivil("2026-07-25"), through: parseCivil("2026-08-07") });

    const july20 = parseCivil("2026-07-20");
    const ongoing = expectedPeriodRange(
      [
        makeCycle({
          startDate: july20,
          episode: {
            startDate: july20,
            endDate: null,
            menstrualDays: [july20],
            spottingDays: [],
            durationDays: null,
            endInferred: true,
          },
        }),
      ],
      90,
      TODAY,
    );
    // Clamped to 14 days -> through 2026-08-02. Unclamped it would reach 2026-10-17.
    expect(ongoing).toEqual({ from: parseCivil("2026-07-21"), through: parseCivil("2026-08-02") });
  });

  it("does not mark one day as both the ongoing period and the predicted next one", () => {
    // Reachable only when a predicted cycle is shorter than a period; DayCell would
    // otherwise apply border-dashed AND border-dotted to the same element.
    const overlap = parseCivil("2026-07-05");
    const result = computeDayIndicators({
      date: overlap,
      today: TODAY,
      dayLog: null,
      prediction: null,
      fertility: null,
      fertilityEnabled: false,
      expectedPeriod: { from: parseCivil("2026-07-02"), through: parseCivil("2026-07-14") },
      predictedPeriod: { from: parseCivil("2026-07-04"), through: parseCivil("2026-07-08") },
    });
    expect(result.isExpectedPeriodDay).toBe(true);
    expect(result.isPredictedPeriod).toBe(false);
    expect(describeDayIndicators(result)).toContain("period expected to continue");
    expect(describeDayIndicators(result)).not.toContain("predicted period range");
  });
});

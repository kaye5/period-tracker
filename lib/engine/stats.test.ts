import { describe, expect, it } from "vitest";

import { addDays, parseCivil, type CivilDate } from "@/lib/date/civil";
import { COVERAGE_MIN_CYCLE, WINDOW } from "@/lib/engine/constants";
import type { BleedingEpisode, Cycle, CycleStatus, DayLog, SymptomId } from "@/lib/domain/types";
import {
  MIN_USABLE_CYCLES_FOR_FIGO_RANGE,
  MIN_USABLE_CYCLES_FOR_REGULARITY_BAND,
  REGULARITY_TYPICAL_VARIATION_MAX_DAYS,
  REGULARITY_VERY_CONSISTENT_MAX_DAYS,
  buildVariabilityHeadline,
  computeCycleStatistics,
  medianCycleLengthDifference,
  predictedVsActualSeries,
  regularityBandFromMedianCld,
  usableCyclesForStats,
  type ResolvedPredictionLike,
} from "@/lib/engine/stats";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const d = (s: string): CivilDate => parseCivil(s);

function episode(
  startDate: CivilDate,
  durationDays: number | null,
  overrides: Partial<BleedingEpisode> = {},
): BleedingEpisode {
  const menstrualDays: CivilDate[] = [];
  if (durationDays !== null) {
    for (let i = 0; i < durationDays; i++) menstrualDays.push(addDays(startDate, i));
  }
  return {
    startDate,
    endDate: durationDays === null ? null : addDays(startDate, durationDays - 1),
    menstrualDays,
    spottingDays: [],
    durationDays,
    endInferred: false,
    ...overrides,
  };
}

function makeCycle(
  index: number,
  startDate: CivilDate,
  lengthDays: number | null,
  status: CycleStatus = "ok",
  weight = 1,
): Cycle {
  return {
    index,
    startDate,
    nextStartDate: lengthDays === null ? null : addDays(startDate, lengthDays),
    lengthDays,
    status,
    weight,
    episode: episode(startDate, lengthDays === null ? null : Math.min(5, lengthDays)),
  };
}

/** Build a cycle history, most recent LAST in `lengths`, anchored so the most recent cycle
 * starts on `lastStart`. Index 0 = most recent, per the type contract. */
function historyFrom(lastStart: CivilDate, lengths: number[]): Cycle[] {
  const reversed = [...lengths].reverse();
  const cycles: Cycle[] = [];
  let start = lastStart;
  for (let i = 0; i < reversed.length; i++) {
    start = addDays(start, -reversed[i]);
    cycles.push(makeCycle(i, start, reversed[i]));
  }
  return cycles;
}

function dayLog(date: CivilDate, overrides: Partial<DayLog> = {}): DayLog {
  return {
    date,
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: date,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// StatSummary shape — "never emit an average without its variation"
// ---------------------------------------------------------------------------

describe("StatSummary shape", () => {
  it("typicalCycleLength is always an object with center/low/high/n, never a bare number", () => {
    const cycles = historyFrom(d("2026-07-01"), [28, 29, 30]);
    const stats = computeCycleStatistics({ cycles, episodes: [], dayLogs: [] });
    expect(stats.typicalCycleLength).not.toBeNull();
    expect(typeof stats.typicalCycleLength).toBe("object");
    expect(stats.typicalCycleLength).toEqual(
      expect.objectContaining({
        center: expect.any(Number),
        low: expect.any(Number),
        high: expect.any(Number),
        n: expect.any(Number),
      }),
    );
  });

  it("is null (not zero, not NaN) with no usable cycles", () => {
    const stats = computeCycleStatistics({ cycles: [], episodes: [], dayLogs: [] });
    expect(stats.typicalCycleLength).toBeNull();
    expect(stats.figoRange).toBeNull();
    expect(stats.periodDuration).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// usableCyclesForStats — post-skip-correction filtering
// ---------------------------------------------------------------------------

describe("usableCyclesForStats", () => {
  it("excludes non-ok statuses and the in-progress cycle", () => {
    const cycles: Cycle[] = [
      makeCycle(0, d("2026-07-01"), null, "in_progress"),
      makeCycle(1, d("2026-06-01"), 30, "ok"),
      makeCycle(2, d("2026-05-01"), 31, "gap_unknown"),
      makeCycle(3, d("2026-04-01"), 29, "skip_suspected"),
      makeCycle(4, d("2026-03-01"), 28, "excluded_by_user"),
      makeCycle(5, d("2026-02-01"), 27, "ok"),
    ];
    const usable = usableCyclesForStats(cycles);
    expect(usable.map((c) => c.index)).toEqual([1, 5]);
  });

  it("caps at WINDOW (12), keeping the most recent", () => {
    const lengths = Array.from({ length: 15 }, () => 28);
    const cycles = historyFrom(d("2026-12-01"), lengths);
    const usable = usableCyclesForStats(cycles);
    expect(usable.length).toBe(WINDOW);
    expect(usable[0].index).toBe(0); // most recent first
  });
});

// ---------------------------------------------------------------------------
// FIGO range, regularity band, and the N-gates from "Edge cases by N"
// ---------------------------------------------------------------------------

describe("figoRange and regularityBand gating", () => {
  it("figoRange and regularityBand are null below the N=6 gate even though typicalCycleLength is available", () => {
    const cycles = historyFrom(d("2026-07-01"), [26, 33, 28, 30, 29]); // n = 5
    const stats = computeCycleStatistics({ cycles, episodes: [], dayLogs: [] });
    expect(stats.typicalCycleLength).not.toBeNull();
    expect(stats.figoRange).toBeNull();
    expect(stats.regularityBand).toBeNull();
    expect(stats.variabilityHeadline).toBeNull();
  });

  it("figoRange and regularityBand appear at exactly N=6 usable cycles", () => {
    expect(MIN_USABLE_CYCLES_FOR_REGULARITY_BAND).toBe(MIN_USABLE_CYCLES_FOR_FIGO_RANGE);
    const cycles = historyFrom(d("2026-07-01"), [26, 33, 28, 30, 29, 27]); // n = 6
    const stats = computeCycleStatistics({ cycles, episodes: [], dayLogs: [] });
    expect(stats.figoRange).not.toBeNull();
    expect(stats.figoRange!.n).toBe(MIN_USABLE_CYCLES_FOR_FIGO_RANGE);
    expect(stats.figoRange!.low).toBe(26);
    expect(stats.figoRange!.high).toBe(33);
    expect(stats.regularityBand).not.toBeNull();
  });

  it("headline matches the exact research template", () => {
    const cycles = historyFrom(d("2026-07-01"), [26, 33, 28, 30, 29, 27]);
    const stats = computeCycleStatistics({ cycles, episodes: [], dayLogs: [] });
    expect(stats.variabilityHeadline).toBe(
      "Over your last 6 cycles, your cycle length ranged from 26 to 33 days.",
    );
  });

  it("buildVariabilityHeadline returns null for a null figoRange", () => {
    expect(buildVariabilityHeadline(null)).toBeNull();
  });

  it("regularity band thresholds: <=3 very_consistent, 4-8 typical_variation, >=9 high_variation", () => {
    expect(regularityBandFromMedianCld(0)).toBe("very_consistent");
    expect(regularityBandFromMedianCld(REGULARITY_VERY_CONSISTENT_MAX_DAYS)).toBe("very_consistent");
    expect(regularityBandFromMedianCld(REGULARITY_VERY_CONSISTENT_MAX_DAYS + 1)).toBe("typical_variation");
    expect(regularityBandFromMedianCld(REGULARITY_TYPICAL_VARIATION_MAX_DAYS)).toBe("typical_variation");
    expect(regularityBandFromMedianCld(REGULARITY_TYPICAL_VARIATION_MAX_DAYS + 1)).toBe("high_variation");
  });

  it("never produces an 'irregular' badge value — only the three named bands exist", () => {
    const cycles = historyFrom(d("2026-07-01"), [24, 38, 24, 38, 24, 38]); // deliberately wide
    const stats = computeCycleStatistics({ cycles, episodes: [], dayLogs: [] });
    expect(["very_consistent", "typical_variation", "high_variation", null]).toContain(
      stats.regularityBand,
    );
  });
});

// ---------------------------------------------------------------------------
// Median cycle-length difference (arithmetic, from raw cycle lengths)
// ---------------------------------------------------------------------------

describe("medianCycleLengthDifference", () => {
  it("computes the median of consecutive absolute differences", () => {
    // most-recent-first lengths: 30, 28, 32, 29 -> diffs |30-28|=2, |28-32|=4, |32-29|=3
    const cycles = historyFrom(d("2026-07-01"), [29, 32, 28, 30]); // chronological input, most recent = 30
    const result = medianCycleLengthDifference(cycles);
    expect(result).not.toBeNull();
    expect(result!.value).toBe(3); // median of [2, 4, 3]
    expect(result!.n).toBe(4);
  });

  it("is null below 2 usable cycles", () => {
    expect(medianCycleLengthDifference(historyFrom(d("2026-07-01"), [30]))).toBeNull();
    expect(medianCycleLengthDifference([])).toBeNull();
  });
});

// ---------------------------------------------------------------------------
// Period duration
// ---------------------------------------------------------------------------

describe("periodDuration", () => {
  it("summarizes known episode durations, ignoring ongoing (null-duration) episodes", () => {
    const episodes: BleedingEpisode[] = [
      episode(d("2026-07-01"), 5),
      episode(d("2026-06-01"), 4),
      episode(d("2026-05-01"), 6),
      episode(d("2026-04-01"), null), // ongoing — excluded
    ];
    const stats = computeCycleStatistics({ cycles: [], episodes, dayLogs: [] });
    expect(stats.periodDuration).toEqual({ center: 5, low: 4, high: 6, n: 3 });
  });
});

// ---------------------------------------------------------------------------
// Flow pattern by period day, heavy-flow days
// ---------------------------------------------------------------------------

describe("flow pattern and heavy-flow days", () => {
  it("tallies flow level by 1-indexed period day across episodes", () => {
    const ep1 = episode(d("2026-07-01"), 3);
    const ep2 = episode(d("2026-08-01"), 3);
    const episodes = [ep1, ep2];
    const dayLogs: DayLog[] = [
      dayLog(d("2026-07-01"), { bleeding: "menstrual", flow: "heavy" }),
      dayLog(d("2026-07-02"), { bleeding: "menstrual", flow: "medium" }),
      dayLog(d("2026-07-03"), { bleeding: "menstrual", flow: "light" }),
      dayLog(d("2026-08-01"), { bleeding: "menstrual", flow: "very_heavy" }),
      dayLog(d("2026-08-02"), { bleeding: "menstrual", flow: "medium" }),
      dayLog(d("2026-08-03"), { bleeding: "menstrual", flow: "spotting" }),
    ];
    const stats = computeCycleStatistics({ cycles: [], episodes, dayLogs });
    const day1 = stats.flowPattern.find((p) => p.periodDay === 1)!;
    expect(day1.flowCounts.heavy).toBe(1);
    expect(day1.flowCounts.very_heavy).toBe(1);
    expect(day1.loggedDayCount).toBe(2);
    expect(day1.heavyOrHigherCount).toBe(2);

    expect(stats.heavyFlowDays).toEqual([d("2026-07-01"), d("2026-08-01")]);
    expect(stats.heavyFlowDayCount).toBe(2);
  });

  it("does not count days with no explicit flow level toward loggedDayCount", () => {
    const ep = episode(d("2026-07-01"), 2);
    const dayLogs: DayLog[] = [dayLog(d("2026-07-01"), { bleeding: "menstrual" })]; // no flow field
    const stats = computeCycleStatistics({ cycles: [], episodes: [ep], dayLogs });
    const day1 = stats.flowPattern.find((p) => p.periodDay === 1)!;
    expect(day1.loggedDayCount).toBe(0);
  });
});

// ---------------------------------------------------------------------------
// Symptom frequency — presence-only, nothingToReport as the only confirmed negative
// ---------------------------------------------------------------------------

describe("symptomFrequency", () => {
  it("counts occurrences and distinct cycles, and treats bare empty symptoms arrays as unknown", () => {
    const cycles = historyFrom(d("2026-09-01"), [30, 30]); // two cycles
    const c0 = cycles[0]; // most recent
    const c1 = cycles[1];

    const dayLogs: DayLog[] = [
      dayLog(c0.startDate, { symptoms: ["cramps"] }),
      dayLog(addDays(c0.startDate, 1), { symptoms: [], nothingToReport: true }), // confirmed negative
      dayLog(addDays(c0.startDate, 2), { symptoms: [] }), // unknown — no nothingToReport flag
      dayLog(c1.startDate, { symptoms: ["cramps", "headache"] }),
    ];

    const stats = computeCycleStatistics({ cycles, episodes: [], dayLogs });
    const cramps = stats.symptomFrequency.find((f) => f.symptom === "cramps")!;
    expect(cramps.occurrences).toBe(2);
    expect(cramps.cyclesWithOccurrence).toBe(2);
    // known days: c0 day0 (present), c0 day1 (confirmed negative), c1 day0 (present) = 3;
    // the bare-empty-array day is excluded from the denominator.
    expect(cramps.knownDays).toBe(3);
    expect(cramps.cyclesConsidered).toBe(2);

    const headache = stats.symptomFrequency.find((f) => f.symptom === "headache")!;
    expect(headache.occurrences).toBe(1);
    expect(headache.cyclesWithOccurrence).toBe(1);
  });

  it("returns every symptom in the panel, even with zero occurrences", () => {
    const stats = computeCycleStatistics({ cycles: [], episodes: [], dayLogs: [] });
    const symptomIds: SymptomId[] = stats.symptomFrequency.map((f) => f.symptom);
    expect(symptomIds).toContain("cramps");
    expect(symptomIds).toContain("sleep_change"); // tier C included too
    for (const f of stats.symptomFrequency) {
      expect(f.occurrences).toBe(0);
    }
  });
});

// ---------------------------------------------------------------------------
// Symptoms by cycle day — window classification and the backward-wins tie-break
// ---------------------------------------------------------------------------

describe("symptomsByCycleDay", () => {
  it("classifies a day inside W_PREMENSTRUAL using the backward offset from nextStartDate", () => {
    const cycle = makeCycle(0, d("2026-07-01"), 28); // nextStartDate = 2026-07-29
    const premenstrualDay = addDays(cycle.nextStartDate as CivilDate, -3); // offset -3, inside -7..-1
    const dayLogs: DayLog[] = [dayLog(premenstrualDay, { symptoms: ["headache"] })];
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs });
    const point = stats.symptomsByCycleDay.find(
      (p) => p.symptom === "headache" && p.window === "premenstrual",
    );
    expect(point).toBeDefined();
    expect(point!.offset).toBe(-3);
    expect(point!.occurrences).toBe(1);
  });

  it("classifies a day inside W_MENSTRUAL using the forward offset from startDate", () => {
    const cycle = makeCycle(0, d("2026-07-01"), 40); // long cycle so windows don't overlap
    const menstrualDay = addDays(cycle.startDate, 1); // forward day 2, inside 1..4
    const dayLogs: DayLog[] = [dayLog(menstrualDay, { symptoms: ["cramps"], bleeding: "menstrual" })];
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs });
    const point = stats.symptomsByCycleDay.find(
      (p) => p.symptom === "cramps" && p.window === "menstrual",
    );
    expect(point).toBeDefined();
    expect(point!.offset).toBe(2);
  });

  it("backward window wins when a short cycle makes a day claimable by both", () => {
    // A 10-day cycle: forward day 4 (inside W_MENSTRUAL's 1..4 AND W_FOLLICULAR_REF's
    // 4..10) is also backward day -7 (inside W_PREMENSTRUAL's -7..-1) relative to a
    // next start only 10 days after this cycle's start.
    const cycle = makeCycle(0, d("2026-07-01"), 10); // nextStartDate = 2026-07-11
    const contestedDay = addDays(cycle.startDate, 3); // forward day 4, backward day -7
    const dayLogs: DayLog[] = [dayLog(contestedDay, { symptoms: ["bloating"] })];
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs });
    const bloatingPoints = stats.symptomsByCycleDay.filter((p) => p.symptom === "bloating");
    expect(bloatingPoints).toHaveLength(1);
    expect(bloatingPoints[0].window).toBe("premenstrual");
  });

  it("never classifies a day in the in-progress cycle (no nextStartDate)", () => {
    const cycle = makeCycle(0, d("2026-07-01"), null); // in-progress
    const dayLogs: DayLog[] = [
      dayLog(addDays(cycle.startDate, 1), { symptoms: ["cramps"], bleeding: "menstrual" }),
    ];
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs });
    expect(stats.symptomsByCycleDay.filter((p) => p.symptom === "cramps")).toHaveLength(0);
  });

  it("excludes bleeding days from the follicular reference window", () => {
    const cycle = makeCycle(0, d("2026-07-01"), 40);
    const dayInRefWindow = addDays(cycle.startDate, 5); // forward day 6, inside 4..10
    const dayLogs: DayLog[] = [
      dayLog(dayInRefWindow, { symptoms: ["fatigue"], bleeding: "menstrual" }),
    ];
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs });
    expect(stats.symptomsByCycleDay.filter((p) => p.symptom === "fatigue")).toHaveLength(0);
  });

  it("omits offsets with no known data rather than emitting a fake zero", () => {
    const cycle = makeCycle(0, d("2026-07-01"), 40);
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs: [] });
    expect(stats.symptomsByCycleDay).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// Missing-data indicators
// ---------------------------------------------------------------------------

describe("missingDataIndicators", () => {
  it("flags a cycle below COVERAGE_MIN_CYCLE as insufficient", () => {
    const cycle = makeCycle(0, d("2026-07-01"), 10); // 10-day cycle, only 2 days logged
    const dayLogs: DayLog[] = [dayLog(cycle.startDate), dayLog(addDays(cycle.startDate, 1))];
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs });
    const indicator = stats.missingDataIndicators.find((m) => m.cycleIndex === 0)!;
    expect(indicator.totalDays).toBe(10);
    expect(indicator.loggedDays).toBe(2);
    expect(indicator.coverage).toBeCloseTo(0.2);
    expect(indicator.sufficientData).toBe(false);
    expect(COVERAGE_MIN_CYCLE).toBe(0.5); // guards the threshold this test relies on
  });

  it("flags a well-logged cycle as sufficient", () => {
    const cycle = makeCycle(0, d("2026-07-01"), 10);
    const dayLogs: DayLog[] = Array.from({ length: 9 }, (_, i) => dayLog(addDays(cycle.startDate, i)));
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs });
    const indicator = stats.missingDataIndicators.find((m) => m.cycleIndex === 0)!;
    expect(indicator.sufficientData).toBe(true);
  });

  it("skips the in-progress cycle", () => {
    const cycle = makeCycle(0, d("2026-07-01"), null);
    const stats = computeCycleStatistics({ cycles: [cycle], episodes: [], dayLogs: [] });
    expect(stats.missingDataIndicators).toHaveLength(0);
  });
});

// ---------------------------------------------------------------------------
// completedCycleCount
// ---------------------------------------------------------------------------

describe("completedCycleCount", () => {
  it("counts every cycle with a known length, regardless of status", () => {
    const cycles: Cycle[] = [
      makeCycle(0, d("2026-07-01"), null, "in_progress"),
      makeCycle(1, d("2026-06-01"), 30, "ok"),
      makeCycle(2, d("2026-05-01"), 31, "gap_unknown"),
      makeCycle(3, d("2026-04-01"), 29, "skip_suspected"),
    ];
    const stats = computeCycleStatistics({ cycles, episodes: [], dayLogs: [] });
    expect(stats.completedCycleCount).toBe(3); // excludes only the in-progress cycle
  });
});

// ---------------------------------------------------------------------------
// predictedVsActualSeries
// ---------------------------------------------------------------------------

describe("predictedVsActualSeries", () => {
  it("sorts chronologically by anchorStart and assigns a stable increasing cycleIndex", () => {
    const resolved: ResolvedPredictionLike[] = [
      {
        anchorStart: d("2026-06-01"),
        predictedStart: d("2026-06-29"),
        actualStart: d("2026-07-01"),
        signedErrorDays: 2,
        insideWindow: true,
      },
      {
        anchorStart: d("2026-05-01"),
        predictedStart: d("2026-05-29"),
        actualStart: d("2026-05-28"),
        signedErrorDays: -1,
        insideWindow: true,
      },
    ];
    const series = predictedVsActualSeries(resolved);
    expect(series.map((p) => p.anchorStart)).toEqual([d("2026-05-01"), d("2026-06-01")]);
    expect(series.map((p) => p.cycleIndex)).toEqual([0, 1]);
  });

  it("passes through a real-shaped ResolvedPrediction (structural typing) unchanged", () => {
    const resolvedFromB = {
      anchorStart: d("2026-05-01"),
      predictedStart: d("2026-05-29"),
      windowLow: d("2026-05-24"),
      windowHigh: d("2026-06-03"),
      actualStart: d("2026-05-30"),
      signedErrorDays: 1,
      absoluteErrorDays: 1,
      insideWindow: true,
    };
    const series = predictedVsActualSeries([resolvedFromB]);
    expect(series[0].actualStart).toBe(d("2026-05-30"));
    expect(series[0].signedErrorDays).toBe(1);
  });
});

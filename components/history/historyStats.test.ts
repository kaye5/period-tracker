import { describe, expect, it } from "vitest";
import { toCivil } from "@/lib/date/civil";
import type { StatSummary, SymptomId } from "@/lib/domain/types";
import type {
  CycleStatistics,
  FlowPatternDay,
  MissingDataIndicator,
  SymptomCycleDayPoint,
  SymptomFrequency,
} from "@/lib/engine/stats";
import {
  buildHistoryStatsViewModel,
  cycleLengthDisplay,
  flowPatternSummary,
  missingDataRows,
  periodDurationDisplay,
  statTileDisplay,
  summarizeStat,
  symptomFrequencyRows,
  symptomsByCycleDayRows,
  variabilityDisplay,
} from "./historyStats";

const d = (day: number) => toCivil(2026, 1, day);

describe("summarizeStat", () => {
  it("returns null when the engine emitted no summary", () => {
    expect(summarizeStat(null, "Typical cycle length")).toBeNull();
  });

  it("shows the center rounded and the low-high range together, never the center alone", () => {
    const stat: StatSummary = { center: 29.5, low: 27, high: 34, n: 8 };
    const result = summarizeStat(stat, "Typical cycle length");
    expect(result).not.toBeNull();
    expect(result!.headline).toContain("30");
    expect(result!.rangeText).toContain("27");
    expect(result!.rangeText).toContain("34");
    expect(result!.rangeText).toContain("8");
  });

  it("N=1: low===high===center gets an honest 'not enough data for a range' message, not a fake range", () => {
    const stat: StatSummary = { center: 30, low: 30, high: 30, n: 1 };
    const result = summarizeStat(stat, "Typical cycle length");
    expect(result!.rangeText).not.toContain("30–30");
    expect(result!.rangeText.toLowerCase()).toContain("1");
  });

  it("cycleLengthDisplay/periodDurationDisplay label their headline distinctly", () => {
    const stat: StatSummary = { center: 5, low: 4, high: 6, n: 4 };
    expect(cycleLengthDisplay(stat)!.headline).toContain("cycle length");
    expect(periodDurationDisplay(stat)!.headline).toContain("period length");
  });
});

describe("statTileDisplay", () => {
  it("returns null when the engine emitted no summary", () => {
    expect(statTileDisplay(null)).toBeNull();
  });

  it("has no label prefix in value, and keeps low/high/n together in sub — never a lone center", () => {
    const stat: StatSummary = { center: 29.5, low: 27, high: 34, n: 8 };
    const result = statTileDisplay(stat);
    expect(result).not.toBeNull();
    expect(result!.value).toBe("30 days");
    expect(result!.sub).toContain("27");
    expect(result!.sub).toContain("34");
    expect(result!.sub).toContain("8");
  });

  it("N=1: low===high===center gets an honest 'not enough data' sub, not a fake range", () => {
    const stat: StatSummary = { center: 30, low: 30, high: 30, n: 1 };
    const result = statTileDisplay(stat);
    expect(result!.sub).not.toContain("30–30");
    expect(result!.sub.toLowerCase()).toContain("1");
  });

  it("counts n in the caller's noun — 'period' for episode stats, never 'cycle'", () => {
    const stat: StatSummary = { center: 5, low: 4, high: 6, n: 3 };
    const result = statTileDisplay(stat, "days", "period");
    expect(result!.sub).toContain("3 periods");
    expect(result!.sub).not.toContain("cycle");
  });
});

describe("variabilityDisplay", () => {
  it("is null when the engine gated the FIGO range out (N<6)", () => {
    expect(variabilityDisplay(null, null, null)).toBeNull();
  });

  it("restates the engine's own headline verbatim and labels the band", () => {
    const stat: StatSummary = { center: 30, low: 25, high: 36, n: 8 };
    const result = variabilityDisplay(stat, "Over your last 8 cycles, your cycle length ranged from 25 to 36 days.", "typical_variation");
    expect(result!.headline).toBe("Over your last 8 cycles, your cycle length ranged from 25 to 36 days.");
    expect(result!.bandLabel).toBe("Typical variation");
  });

  it("bandLabel is null when the band itself is gated out even though figoRange exists", () => {
    const stat: StatSummary = { center: 30, low: 25, high: 36, n: 8 };
    const result = variabilityDisplay(stat, "headline", null);
    expect(result!.bandLabel).toBeNull();
  });
});

describe("flowPatternSummary", () => {
  it("counts logged flow days and restates heavy-flow dates without inventing any", () => {
    const flowPattern: FlowPatternDay[] = [
      { periodDay: 1, flowCounts: { spotting: 0, light: 1, medium: 0, heavy: 0, very_heavy: 0 }, loggedDayCount: 1, heavyOrHigherCount: 0 },
      { periodDay: 2, flowCounts: { spotting: 0, light: 0, medium: 0, heavy: 2, very_heavy: 0 }, loggedDayCount: 2, heavyOrHigherCount: 2 },
    ];
    const heavy = [d(2), d(3)];
    const result = flowPatternSummary(flowPattern, heavy);
    expect(result.daysWithLoggedFlow).toBe(3);
    expect(result.heavyFlowDayCount).toBe(2);
    expect(result.heavyFlowDatesText).toContain("Jan 2, 2026");
    expect(result.heavyFlowDatesText).toContain("Jan 3, 2026");
  });

  it("gives an honest empty message with zero heavy-flow days", () => {
    const result = flowPatternSummary([], []);
    expect(result.heavyFlowDatesText.toLowerCase()).toContain("no heavy-flow days");
  });
});

describe("symptomFrequencyRows", () => {
  function freq(symptom: SymptomId, overrides: Partial<SymptomFrequency> = {}): SymptomFrequency {
    return { symptom, occurrences: 0, cyclesWithOccurrence: 0, knownDays: 0, cyclesConsidered: 0, ...overrides };
  }

  it("omits symptoms that were never observed (knownDays === 0)", () => {
    const rows = symptomFrequencyRows([freq("cramps", { knownDays: 0 })]);
    expect(rows).toHaveLength(0);
  });

  it("includes a human label and a rate that states the denominator, sorted by occurrences desc", () => {
    const rows = symptomFrequencyRows([
      freq("headache", { occurrences: 2, knownDays: 10, cyclesWithOccurrence: 1, cyclesConsidered: 3 }),
      freq("cramps", { occurrences: 8, knownDays: 10, cyclesWithOccurrence: 3, cyclesConsidered: 3 }),
    ]);
    expect(rows[0].symptom).toBe("cramps");
    expect(rows[0].label).toBe("cramps");
    expect(rows[0].rateText).toContain("8 of 10");
    expect(rows[0].rateText).toContain("80%");
    expect(rows[0].rateText).toContain("3 of 3");
  });
});

describe("symptomsByCycleDayRows", () => {
  it("collapses per-offset points into one row per symptom+window and omits unobserved windows", () => {
    const points: SymptomCycleDayPoint[] = [
      { symptom: "headache", window: "premenstrual", offset: -7, occurrences: 1, knownDays: 2 },
      { symptom: "headache", window: "premenstrual", offset: -6, occurrences: 2, knownDays: 2 },
      { symptom: "headache", window: "menstrual", offset: 1, occurrences: 0, knownDays: 0 },
    ];
    const rows = symptomsByCycleDayRows(points);
    expect(rows).toHaveLength(1);
    expect(rows[0].symptom).toBe("headache");
    expect(rows[0].window).toBe("premenstrual");
    expect(rows[0].occurrences).toBe(3);
    expect(rows[0].knownDays).toBe(4);
    expect(rows[0].rateText).toContain("3 of 4");
  });
});

describe("missingDataRows", () => {
  it("only surfaces cycles the engine flagged as under-logged", () => {
    const indicators: MissingDataIndicator[] = [
      { cycleIndex: 0, startDate: d(1), totalDays: 30, loggedDays: 28, coverage: 28 / 30, sufficientData: true },
      { cycleIndex: 1, startDate: d(10), totalDays: 30, loggedDays: 5, coverage: 5 / 30, sufficientData: false },
    ];
    const rows = missingDataRows(indicators);
    expect(rows).toHaveLength(1);
    expect(rows[0].cycleIndex).toBe(1);
    expect(rows[0].coverageText).toContain("5 of 30");
  });
});

describe("buildHistoryStatsViewModel", () => {
  it("assembles every field from a full CycleStatistics without throwing on nulls", () => {
    const stats: CycleStatistics = {
      completedCycleCount: 0,
      typicalCycleLength: null,
      figoRange: null,
      variabilityHeadline: null,
      medianCycleLengthDifference: null,
      regularityBand: null,
      periodDuration: null,
      flowPattern: [],
      heavyFlowDays: [],
      heavyFlowDayCount: 0,
      symptomFrequency: [],
      symptomsByCycleDay: [],
      missingDataIndicators: [],
    };
    const vm = buildHistoryStatsViewModel(stats);
    expect(vm.completedCycleCountText).toContain("0");
    expect(vm.cycleLength).toBeNull();
    expect(vm.periodDuration).toBeNull();
    expect(vm.variability).toBeNull();
    expect(vm.flow.heavyFlowDayCount).toBe(0);
    expect(vm.symptomFrequency).toEqual([]);
    expect(vm.missingData).toEqual([]);
  });
});

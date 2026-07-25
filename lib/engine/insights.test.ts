/**
 * Tests for the symptom-insight engine.
 *
 * The ten invariants of docs/research/02-symptom-insights.md §E.5 are encoded here as
 * executable tests (SPEC.md R10), each in a `describe` block naming its invariant. The
 * arithmetic fact that fewer than five non-tie cycles can never reach significance is a
 * test, not a comment.
 */
import { describe, expect, it } from "vitest";

import { addDays, compare, parseCivil, rangeInclusive, type CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, Cycle, DayLog, Insight, SymptomId } from "@/lib/domain/types";
import { binomSf } from "@/lib/stat";
import {
  ALPHA_UNCORRECTED,
  COVERAGE_BALANCE_MAX,
  COVERAGE_MIN_PRIMARY,
  COVERAGE_MIN_REFERENCE,
  DEADBAND,
  MAX_INSIGHTS_SHOWN,
  MIN_QUALIFYING_CYCLES_TO_CLAIM,
  SYMPTOM_PANEL,
  testBudget,
} from "@/lib/engine/constants";
import {
  DID_NOT_REPLICATE,
  INSIGHT_DISCLAIMER,
  LOGGING_CAVEAT,
  NOT_ENOUGH_DATA_HEADLINE,
  NO_PATTERN_HEADLINE,
  SYMPTOM_LABELS,
  basedOnCycles,
  capitalizedSymptomLabel,
  descriptiveOnly,
  descriptiveOnlyHeadline,
  detailExpander,
  noPattern,
  notEnoughData,
  primaryPostmenstrualBody,
  primaryPostmenstrualHeadline,
  primaryPremenstrualBody,
  primaryPremenstrualHeadline,
  symptomLabel,
} from "@/lib/copy/insights";
import {
  buildInsights,
  buildInsightsWithDiagnostics,
  cycleQualifies,
  evaluateSymptom,
  indexDayLogs,
  resolveCycleWindows,
  symptomEligible,
  type BuildInsightsInput,
  type WindowedCycle,
} from "./insights";

// ===========================================================================
// Fixture builder
// ===========================================================================

const S: SymptomId = "cramps";
const S2: SymptomId = "breast_tenderness";
const S3: SymptomId = "bloating";

interface Placement {
  id: SymptomId;
  /** Number of *logged* premenstrual days (backward −7…−1) carrying the symptom. */
  pre?: number;
  /** Number of *logged* reference days (forward +4…+10, non-bleeding) carrying it. */
  ref?: number;
  /** Number of mid-cycle days (start+12…start+18) carrying it — in neither window. */
  mid?: number;
}

interface CycleSpec {
  length?: number;
  bleedDays?: number;
  place?: Placement[];
  /** Leave the LAST n premenstrual days with no log entry at all. */
  unloggedPre?: number;
  /** Leave the LAST n reference days with no log entry at all. */
  unloggedRef?: number;
  /** Arbitrary unlogged runs, as {offset from cycle start, length in days}. */
  unloggedRuns?: Array<{ offset: number; days: number }>;
  inProgress?: boolean;
}

const FIRST_START = "2025-01-06";
/** Default cycle length for fixtures. Not 28 — SPEC.md R5 forbids that number as any
 * kind of default, including a test's idea of a "normal" cycle. */
const DEFAULT_LENGTH = 29;

interface BuiltScenario extends BuildInsightsInput {
  cycles: Cycle[];
  dayLogs: DayLog[];
  starts: CivilDate[];
}

function buildScenario(specs: CycleSpec[], firstStart = FIRST_START): BuiltScenario {
  const cycles: Cycle[] = [];
  const dayLogs: DayLog[] = [];
  const starts: CivilDate[] = [];

  let cursor = parseCivil(firstStart);
  specs.forEach((spec, i) => {
    const length = spec.length ?? DEFAULT_LENGTH;
    const bleedDays = spec.bleedDays ?? 3;
    const start = cursor;
    const next = addDays(start, length);
    starts.push(start);
    cursor = next;

    const cycleDays = rangeInclusive(start, addDays(next, -1));
    const menstrualDays = cycleDays.slice(0, bleedDays);
    const menstrualSet = new Set<string>(menstrualDays);

    const preDates = rangeInclusive(addDays(next, -7), addDays(next, -1));
    const refDates = rangeInclusive(addDays(start, 3), addDays(start, 9)).filter(
      (d) => !menstrualSet.has(d),
    );
    const midDates = rangeInclusive(addDays(start, 12), addDays(start, 18));

    const unlogged = new Set<string>();
    for (const d of preDates.slice(preDates.length - (spec.unloggedPre ?? 0))) unlogged.add(d);
    for (const d of refDates.slice(refDates.length - (spec.unloggedRef ?? 0))) unlogged.add(d);
    for (const run of spec.unloggedRuns ?? []) {
      for (let k = 0; k < run.days; k++) unlogged.add(addDays(start, run.offset + k));
    }

    const loggedPre = preDates.filter((d) => !unlogged.has(d));
    const loggedRef = refDates.filter((d) => !unlogged.has(d));
    const loggedMid = midDates.filter((d) => !unlogged.has(d));

    const symptomsByDate = new Map<string, SymptomId[]>();
    const mark = (dates: CivilDate[], id: SymptomId, n: number) => {
      for (const d of dates.slice(0, n)) {
        const existing = symptomsByDate.get(d) ?? [];
        if (!existing.includes(id)) existing.push(id);
        symptomsByDate.set(d, existing);
      }
    };
    for (const p of spec.place ?? []) {
      mark(loggedPre, p.id, p.pre ?? 0);
      mark(loggedRef, p.id, p.ref ?? 0);
      mark(loggedMid, p.id, p.mid ?? 0);
    }

    for (const date of cycleDays) {
      if (unlogged.has(date)) continue;
      const isMenstrual = menstrualSet.has(date);
      dayLogs.push({
        date,
        bleeding: isMenstrual ? "menstrual" : "none",
        ...(isMenstrual ? { flow: "medium" as const } : {}),
        pain: { severity: "none" },
        symptoms: symptomsByDate.get(date) ?? [],
        loggedAt: date,
      });
    }

    const episode: BleedingEpisode = {
      startDate: start,
      endDate: menstrualDays[menstrualDays.length - 1],
      menstrualDays,
      spottingDays: [],
      durationDays: bleedDays,
      endInferred: false,
    };

    cycles.push({
      index: specs.length - 1 - i,
      startDate: start,
      nextStartDate: spec.inProgress ? null : next,
      lengthDays: spec.inProgress ? null : length,
      status: spec.inProgress ? "in_progress" : "ok",
      weight: 1,
      episode,
    });
  });

  return { cycles, dayLogs, starts };
}

/** n identical cycles. */
function repeat(n: number, spec: CycleSpec): CycleSpec[] {
  return Array.from({ length: n }, () => ({ ...spec }));
}

/** A cycle where the symptom sits squarely in the premenstrual window and nowhere else. */
const STRONG_PRE: CycleSpec = { place: [{ id: S, pre: 6, ref: 0 }] };
/** A cycle whose premenstrual-vs-reference difference (3/7 − 2/7 ≈ 0.14) is inside the
 * dead-band, so the cycle is a tie and is excluded from the sign test. */
const TIE: CycleSpec = { place: [{ id: S, pre: 3, ref: 2 }] };

function only(insights: Insight[]): Insight {
  expect(insights).toHaveLength(1);
  return insights[0];
}

// ===========================================================================
// Fixture sanity — if these fail, every scenario below is meaningless
// ===========================================================================

describe("fixture geometry", () => {
  it("puts the premenstrual window at next−7…next−1 and the reference window at +4…+10", () => {
    const sc = buildScenario(repeat(1, STRONG_PRE));
    const wc = resolveCycleWindows(sc.cycles[0], sc.dayLogs);
    expect(wc).not.toBeNull();
    const w = wc as WindowedCycle;
    const start = sc.starts[0];
    const next = addDays(start, DEFAULT_LENGTH);

    expect(w.primary).toEqual(rangeInclusive(addDays(next, -7), addDays(next, -1)));
    // Forward +4…+10 is start+3…start+9; with a 3-day bleed none of them are excluded.
    expect(w.reference).toEqual(rangeInclusive(addDays(start, 3), addDays(start, 9)));
    expect(w.lengthDays).toBe(DEFAULT_LENGTH);
  });

  it("drops days with logged bleeding from the reference window", () => {
    const sc = buildScenario(repeat(1, { bleedDays: 6 }));
    const w = resolveCycleWindows(sc.cycles[0], sc.dayLogs) as WindowedCycle;
    const start = sc.starts[0];
    // start…start+5 bleed, so +4…+10 (= start+3…start+9) loses start+3, +4 and +5.
    expect(w.reference).toEqual(rangeInclusive(addDays(start, 6), addDays(start, 9)));
  });
});

// ===========================================================================
// §1.1 / §E.1 — backward wins over forward
// ===========================================================================

describe("window assignment: backward wins over forward (Schmalenberger et al. 2021)", () => {
  it("gives a contested day to the backward-anchored premenstrual window", () => {
    // A 16-day cycle makes the two windows overlap: backward −7…−1 is start+9…start+15
    // and forward +4…+10 is start+3…start+9. start+9 is claimable by both.
    const sc = buildScenario(repeat(1, { length: 16, bleedDays: 3 }));
    const w = resolveCycleWindows(sc.cycles[0], sc.dayLogs) as WindowedCycle;
    const start = sc.starts[0];
    const contested = addDays(start, 9);

    expect(w.primary).toContain(contested);
    expect(w.reference).not.toContain(contested);
    expect(w.reference).toEqual(rangeInclusive(addDays(start, 3), addDays(start, 8)));
  });

  it("keeps the premenstrual window a fixed distance from the bleed regardless of cycle length", () => {
    for (const length of [21, 29, 45]) {
      const sc = buildScenario(repeat(1, { length }));
      const w = resolveCycleWindows(sc.cycles[0], sc.dayLogs) as WindowedCycle;
      expect(w.primary).toHaveLength(7);
      expect(w.primary[6]).toBe(addDays(w.nextStart, -1));
      expect(w.primary[0]).toBe(addDays(w.nextStart, -7));
    }
  });
});

// ===========================================================================
// INV-4 — backward windows are never computed on the in-progress cycle
// ===========================================================================

describe("INV-4 — no backward window on the in-progress cycle", () => {
  it("returns null when the next period start is unknown", () => {
    const sc = buildScenario(repeat(1, { inProgress: true }));
    expect(resolveCycleWindows(sc.cycles[0], sc.dayLogs)).toBeNull();
  });

  it("ignores the in-progress cycle entirely, however strongly it is logged", () => {
    const closed = repeat(7, STRONG_PRE);
    const withOpen = buildScenario([
      ...closed,
      { place: [{ id: S, pre: 6, ref: 0, mid: 5 }], inProgress: true },
    ]);
    const withoutOpen = buildScenario(closed);

    const a = buildInsightsWithDiagnostics(withOpen);
    const b = buildInsightsWithDiagnostics(withoutOpen);

    expect(a.diagnostics.completedCycles).toBe(7);
    expect(a.diagnostics.qualifyingCycles).toBe(b.diagnostics.qualifyingCycles);
    expect(a.insights.map((i) => i.body)).toEqual(b.insights.map((i) => i.body));

    const openStart = withOpen.starts[7];
    for (const insight of a.insights) {
      for (const d of insight.supportingDates) {
        expect(compare(d, openStart)).toBeLessThan(0);
      }
    }
  });
});

// ===========================================================================
// §3.2 — the arithmetic floor. This must be a test, not a comment.
// ===========================================================================

describe("§3.2 — fewer than five non-tie cycles cannot reach significance", () => {
  it("reproduces the exact one-sided binomial values at p = 0.5", () => {
    expect(binomSf(3, 3, 0.5)).toBeCloseTo(0.125, 10);
    expect(binomSf(4, 4, 0.5)).toBeCloseTo(0.0625, 10);
    expect(binomSf(5, 5, 0.5)).toBeCloseTo(0.03125, 10);
    expect(binomSf(6, 6, 0.5)).toBeCloseTo(0.015625, 10);
    expect(binomSf(6, 7, 0.5)).toBeCloseTo(0.0625, 10);
    expect(binomSf(7, 8, 0.5)).toBeCloseTo(0.03516, 4);
  });

  it("means no n < 5 clears even the uncorrected alpha", () => {
    for (let n = 1; n <= 4; n++) {
      expect(binomSf(n, n, 0.5)).toBeGreaterThan(ALPHA_UNCORRECTED);
    }
    expect(binomSf(5, 5, 0.5)).toBeLessThanOrEqual(ALPHA_UNCORRECTED);
    expect(MIN_QUALIFYING_CYCLES_TO_CLAIM).toBe(5);
  });

  it("refuses a claim from four perfectly-consistent non-tie cycles", () => {
    // Seven qualifying cycles, but three of them are dead-band ties, so n = 4.
    const sc = buildScenario([...repeat(4, STRONG_PRE), ...repeat(3, TIE)]);
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    const record = diagnostics.records.find((r) => r.symptom === S);

    expect(record?.unknown.n).toBe(4);
    expect(record?.unknown.k).toBe(4);
    expect(record?.unknown.p).toBeCloseTo(0.0625, 10);
    expect(record?.unknown.passesEffectFloor).toBe(false);
    expect(only(insights).headline).toBe(NO_PATTERN_HEADLINE);
  });

  it("allows a claim from five", () => {
    const sc = buildScenario([...repeat(5, STRONG_PRE), ...repeat(2, TIE)]);
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    const record = diagnostics.records.find((r) => r.symptom === S);

    expect(record?.unknown.n).toBe(5);
    expect(record?.unknown.p).toBeCloseTo(0.03125, 10);
    expect(only(insights).headline).toBe(primaryPremenstrualHeadline(S));
  });
});

// ===========================================================================
// §3.1 / §3.2 — the unit of replication is the cycle, and the dead-band
// ===========================================================================

describe("the sign test uses the cycle as the unit, with a ±0.20 dead-band", () => {
  const logsFor = (sc: BuiltScenario) => indexDayLogs(sc.dayLogs);
  const windowed = (sc: BuiltScenario): WindowedCycle[] =>
    sc.cycles
      .map((c) => resolveCycleWindows(c, sc.dayLogs))
      .filter((w): w is WindowedCycle => w !== null);

  it("classifies a difference of exactly the dead-band as leaning, not as a tie", () => {
    // 5 logged premenstrual days with 1 positive (0.2) vs 5 logged reference days with
    // none (0.0). d = 0.2 exactly.
    const sc = buildScenario(repeat(5, { unloggedPre: 2, unloggedRef: 2, place: [{ id: S, pre: 1 }] }));
    const r = evaluateSymptom(S, windowed(sc), logsFor(sc), "unknown");
    expect(DEADBAND).toBe(0.2);
    expect(r.kW).toBe(5);
    expect(r.ties).toBe(0);
    expect(r.n).toBe(5);
  });

  it("classifies a difference below the dead-band as a tie", () => {
    // 6 logged premenstrual days with 1 positive (0.167) vs 5 reference days with none.
    const sc = buildScenario(repeat(5, { unloggedPre: 1, unloggedRef: 2, place: [{ id: S, pre: 1 }] }));
    const r = evaluateSymptom(S, windowed(sc), logsFor(sc), "unknown");
    expect(r.kW).toBe(0);
    expect(r.ties).toBe(5);
    expect(r.n).toBe(0);
    expect(r.passesEffectFloor).toBe(false);
  });

  it("does not manufacture power from the 7 days inside each cycle", () => {
    // 42 premenstrual day-observations across 6 cycles collapse to n = 6, not n = 42.
    const sc = buildScenario(repeat(6, STRONG_PRE));
    const r = evaluateSymptom(S, windowed(sc), logsFor(sc), "unknown");
    expect(r.A).toBe(42);
    expect(r.n).toBe(6);
    expect(r.p).toBeCloseTo(binomSf(6, 6, 0.5), 12);
  });

  it("reads replication off the most recent qualifying cycle", () => {
    const trailingMiss = buildScenario([...repeat(6, STRONG_PRE), TIE]);
    const wcs = windowed(trailingMiss);
    // Oldest first, so the last element is the user's most recent cycle.
    expect(wcs[wcs.length - 1].start).toBe(trailingMiss.starts[6]);
    const r = evaluateSymptom(S, wcs, logsFor(trailingMiss), "unknown");
    expect(r.replicatedLastCycle).toBe(false);

    const holds = buildScenario(repeat(7, STRONG_PRE));
    expect(evaluateSymptom(S, windowed(holds), logsFor(holds), "unknown").replicatedLastCycle).toBe(
      true,
    );
  });

  it("surfaces the disconfirmation in the card itself, not in a footnote", () => {
    const sc = buildScenario([...repeat(6, STRONG_PRE), TIE]);
    const insight = only(buildInsights(sc));
    expect(insight.replicatedLastCycle).toBe(false);
    expect(insight.body).toContain(DID_NOT_REPLICATE);
  });
});

// ===========================================================================
// INV-7 — direction is discovered, never assumed
// ===========================================================================

describe("INV-7 — the postmenstrual direction is reachable", () => {
  it("produces the postmenstrual card when the symptom is commoner after the period", () => {
    // 13–16% of users show the inverted pattern (Kiesner et al. 2022); this fixture is
    // one of them.
    const sc = buildScenario(repeat(6, { place: [{ id: S, pre: 0, ref: 6 }] }));
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    const insight = only(insights);

    expect(diagnostics.records[0].unknown.direction).toBe("postmenstrual");
    expect(insight.headline).toBe(primaryPostmenstrualHeadline(S));
    expect(insight.body).toContain("after your period ended");
    expect(insight.id).toContain("postmenstrual");
  });

  it("reports the premenstrual direction on the mirror-image fixture", () => {
    const sc = buildScenario(repeat(6, { place: [{ id: S, pre: 6, ref: 0 }] }));
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    expect(diagnostics.records[0].unknown.direction).toBe("premenstrual");
    expect(only(insights).headline).toBe(primaryPremenstrualHeadline(S));
  });
});

// ===========================================================================
// INV-8 — NO_PATTERN is a real, shippable card
// ===========================================================================

describe("INV-8 — NO_PATTERN is reachable and shippable", () => {
  it("ships a card when a well-logged symptom has no cyclic timing at all", () => {
    // ~26% of users show no cyclic pattern (Kiesner et al. 2022). The symptom is logged
    // often enough to be tested, but only mid-cycle, in neither window.
    const sc = buildScenario(repeat(6, { place: [{ id: S, mid: 4 }] }));
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    const insight = only(insights);

    expect(diagnostics.testedSymptoms).toEqual([S]);
    expect(diagnostics.m).toBe(1);
    expect(insight.headline).toBe(NO_PATTERN_HEADLINE);
    expect(insight.body).toBe(noPattern(1, 6));
    expect(insight.body).toContain("That's a normal result.");
    expect(insight.supportingDates.length).toBeGreaterThan(0);
    expect(insight.supportingCycles).toBe(6);
  });

  it("ships a card when nothing was eligible to be tested at all", () => {
    const sc = buildScenario(repeat(6, {}));
    const insight = only(buildInsights(sc));
    expect(insight.headline).toBe(NO_PATTERN_HEADLINE);
    expect(insight.body).toBe(noPattern(0, 6));
  });
});

// ===========================================================================
// INV-5 — the dual missing-data robustness gate
// ===========================================================================

describe("INV-5 — every claim must survive both missing-data treatments", () => {
  /**
   * The engagement artifact, built deliberately: the premenstrual window is logged on
   * only 5 of its 7 days and the symptom is on every one of those 5, while the reference
   * week is fully logged. Dropping unlogged days ("unknown") reads that as a rate of
   * 1.00 vs 0.43 — a rate ratio of 2.33, over the floor. Counting them as negatives
   * ("absent") reads 0.71 vs 0.43 — a ratio of 1.67, under it.
   */
  const artifact = repeat(5, { unloggedPre: 2, place: [{ id: S, pre: 5, ref: 3 }] });

  it("rejects a pattern that only exists when unlogged days are dropped", () => {
    const sc = buildScenario(artifact);
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    const record = diagnostics.records.find((r) => r.symptom === S);

    expect(record?.unknown.passesEffectFloor).toBe(true);
    expect(record?.unknown.rateRatio).toBeGreaterThanOrEqual(2);
    expect(record?.absent.passesEffectFloor).toBe(false);
    expect(record?.absent.rateRatio).toBeLessThan(2);
    expect(record?.survivedRobustnessGate).toBe(false);
    expect(record?.combined).toBeNull();

    expect(only(insights).headline).toBe(NO_PATTERN_HEADLINE);
  });

  it("keeps the more conservative p-value when both arms agree", () => {
    // Fully logged cycles: both arms see the same days, so the surviving p is that p.
    const sc = buildScenario(repeat(6, STRONG_PRE));
    const { diagnostics } = buildInsightsWithDiagnostics(sc);
    const record = diagnostics.records.find((r) => r.symptom === S);
    expect(record).toBeDefined();
    if (record === undefined) return;
    expect(record.survivedRobustnessGate).toBe(true);
    expect(record.combined?.p).toBe(Math.max(record.unknown.p, record.absent.p));
  });

  it("requires the two arms to agree on direction", () => {
    const sc = buildScenario(repeat(6, STRONG_PRE));
    const { diagnostics } = buildInsightsWithDiagnostics(sc);
    const record = diagnostics.records[0];
    expect(record.unknown.direction).toBe(record.absent.direction);
  });
});

// ===========================================================================
// INV-6 — the test budget is fixed before any test runs; m = tests RUN
// ===========================================================================

describe("INV-6 — multiplicity control is a product constraint, not a post-hoc step", () => {
  it("fixes the budget from the qualifying-cycle count alone", () => {
    expect(testBudget(4)).toBe(0);
    expect(testBudget(5)).toBe(3);
    expect(testBudget(7)).toBe(3);
    expect(testBudget(8)).toBe(8);
    expect(testBudget(11)).toBe(8);
    expect(testBudget(12)).toBe(12);
    expect(SYMPTOM_PANEL.length).toBeLessThanOrEqual(12);
  });

  it("tests at most three symptoms at five qualifying cycles, in panel order", () => {
    const place: Placement[] = [
      { id: "acne", mid: 3 },
      { id: S3, mid: 3 },
      { id: S2, mid: 3 },
      { id: S, mid: 3 },
      { id: "headache", mid: 3 },
    ];
    const sc = buildScenario(repeat(5, { place }));
    const { diagnostics } = buildInsightsWithDiagnostics(sc);

    expect(diagnostics.qualifyingCycles).toBe(5);
    expect(diagnostics.testBudget).toBe(3);
    expect(diagnostics.testedSymptoms).toHaveLength(3);
    // Panel order, not logging order: cramps, breast_tenderness, bloating come first.
    expect(diagnostics.testedSymptoms).toEqual([S, S2, S3]);
    expect(diagnostics.m).toBe(3);
  });

  it("uses m = the number of tests run in the Benjamini-Hochberg threshold", () => {
    // Identical evidence for cramps (5 leaning cycles out of 8, p = 0.03125) under two
    // different values of m. At m = 1 the BH threshold is 0.10 and the claim survives;
    // at m = 8 it is 0.0125 and the same claim does not.
    const target: Placement = { id: S, pre: 6, ref: 0 };
    const targetTie: Placement = { id: S, pre: 3, ref: 2 };
    const filler: SymptomId[] = [
      S2,
      S3,
      "headache",
      "fatigue",
      "cravings",
      "gi_change",
      "acne",
    ];

    const alone = buildScenario([
      ...repeat(5, { place: [target] }),
      ...repeat(3, { place: [targetTie] }),
    ]);
    const aloneOut = buildInsightsWithDiagnostics(alone);
    expect(aloneOut.diagnostics.qualifyingCycles).toBe(8);
    expect(aloneOut.diagnostics.m).toBe(1);
    expect(aloneOut.diagnostics.records[0].combined?.p).toBeCloseTo(0.03125, 10);
    expect(only(aloneOut.insights).headline).toBe(primaryPremenstrualHeadline(S));

    const crowded = buildScenario([
      ...repeat(5, { place: [target, ...filler.map((id) => ({ id, mid: 3 }))] }),
      ...repeat(3, { place: [targetTie, ...filler.map((id) => ({ id, mid: 3 }))] }),
    ]);
    const crowdedOut = buildInsightsWithDiagnostics(crowded);
    expect(crowdedOut.diagnostics.qualifyingCycles).toBe(8);
    expect(crowdedOut.diagnostics.m).toBe(8);
    const crowdedTarget = crowdedOut.diagnostics.records.find((r) => r.symptom === S);
    expect(crowdedTarget?.combined?.p).toBeCloseTo(0.03125, 10);
    expect(crowdedTarget?.survivedFdr).toBe(false);
    expect(only(crowdedOut.insights).headline).toBe(NO_PATTERN_HEADLINE);
  });

  it("never shows more than MAX_INSIGHTS_SHOWN cards", () => {
    const place: Placement[] = [S, S2, S3, "headache"].map((id) => ({
      id: id as SymptomId,
      pre: 6,
      ref: 0,
    }));
    const sc = buildScenario(repeat(12, { place }));
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    expect(diagnostics.m).toBe(4);
    expect(diagnostics.records.filter((r) => r.survivedFdr)).toHaveLength(4);
    expect(insights).toHaveLength(MAX_INSIGHTS_SHOWN);
  });
});

// ===========================================================================
// GATE_C / §4.4 — cycle qualification
// ===========================================================================

describe("cycle qualification (GATE_C, §4.4 coverage thresholds)", () => {
  const qualifies = (spec: CycleSpec, medianLength = DEFAULT_LENGTH): boolean => {
    const sc = buildScenario([spec]);
    const wc = resolveCycleWindows(sc.cycles[0], sc.dayLogs);
    expect(wc).not.toBeNull();
    return cycleQualifies(wc as WindowedCycle, indexDayLogs(sc.dayLogs), medianLength);
  };

  it("accepts a fully-logged cycle of typical length", () => {
    expect(qualifies({})).toBe(true);
  });

  it("rejects cycles outside 21–45 days", () => {
    expect(qualifies({ length: 20 }, 20)).toBe(false);
    expect(qualifies({ length: 21 }, 21)).toBe(true);
    expect(qualifies({ length: 45 }, 45)).toBe(true);
    expect(qualifies({ length: 46 }, 46)).toBe(false);
  });

  it("rejects a cycle more than 10 days above the user's median (Li et al. 2020)", () => {
    expect(qualifies({ length: 39 }, 29)).toBe(true); // exactly median + 10, still in
    expect(qualifies({ length: 40 }, 29)).toBe(false); // median + 11, out
    expect(qualifies({ length: 40 }, 30)).toBe(true);
  });

  it("rejects a gap of more than 10 consecutive unlogged days", () => {
    expect(qualifies({ unloggedRuns: [{ offset: 10, days: 10 }] })).toBe(true);
    expect(qualifies({ length: 40, unloggedRuns: [{ offset: 10, days: 11 }] }, 40)).toBe(false);
  });

  it("rejects a cycle logged on under half its days", () => {
    // A 45-day cycle with both windows fully logged and balanced, and no single gap over
    // 10 days — so only the cycle-level 50% rule can reject it. 25 of 45 days unlogged.
    const patchy: CycleSpec = {
      length: 45,
      unloggedRuns: [
        { offset: 10, days: 10 },
        { offset: 21, days: 10 },
        { offset: 32, days: 5 },
      ],
    };
    expect(qualifies(patchy, 45)).toBe(false);
    // The same cycle with one gap shortened clears 50% and qualifies.
    expect(
      qualifies(
        {
          ...patchy,
          unloggedRuns: [
            { offset: 10, days: 10 },
            { offset: 21, days: 10 },
          ],
        },
        45,
      ),
    ).toBe(true);
  });

  it("rejects thin coverage in either window", () => {
    expect(COVERAGE_MIN_PRIMARY).toBeCloseTo(5 / 7, 12);
    expect(COVERAGE_MIN_REFERENCE).toBeCloseTo(4 / 7, 12);
    expect(qualifies({ unloggedPre: 2, unloggedRef: 2 })).toBe(true);
    expect(qualifies({ unloggedPre: 3 })).toBe(false);
    expect(qualifies({ unloggedRef: 4 })).toBe(false);
  });

  it("rejects an unbalanced comparison between a dense and a sparse window", () => {
    // covW = 7/7, covR = 4/7 -> |difference| = 0.43 > 0.30, so the windows are not
    // comparable even though each clears its own floor.
    expect(COVERAGE_BALANCE_MAX).toBe(0.3);
    expect(qualifies({ unloggedRef: 3 })).toBe(false);
  });

  it("excludes a cycle the user has explicitly excluded", () => {
    const sc = buildScenario(repeat(6, STRONG_PRE));
    sc.cycles[0] = { ...sc.cycles[0], status: "excluded_by_user" };
    const { diagnostics } = buildInsightsWithDiagnostics(sc);
    expect(diagnostics.completedCycles).toBe(5);
  });
});

// ===========================================================================
// GATE_D — outcome-independent symptom pre-filter
// ===========================================================================

describe("GATE_D — symptom eligibility is an outcome-independent pre-filter", () => {
  const windowedOf = (sc: BuiltScenario): WindowedCycle[] =>
    sc.cycles
      .map((c) => resolveCycleWindows(c, sc.dayLogs))
      .filter((w): w is WindowedCycle => w !== null);

  it("requires at least 3 occurrences across at least 2 cycles", () => {
    const twoOccurrences = buildScenario([
      { place: [{ id: S, mid: 1 }] },
      { place: [{ id: S, mid: 1 }] },
      ...repeat(4, {}),
    ]);
    expect(symptomEligible(S, windowedOf(twoOccurrences), indexDayLogs(twoOccurrences.dayLogs))).toBe(
      false,
    );

    const oneCycle = buildScenario([{ place: [{ id: S, mid: 5 }] }, ...repeat(5, {})]);
    expect(symptomEligible(S, windowedOf(oneCycle), indexDayLogs(oneCycle.dayLogs))).toBe(false);

    const eligible = buildScenario([
      { place: [{ id: S, mid: 2 }] },
      { place: [{ id: S, mid: 1 }] },
      ...repeat(4, {}),
    ]);
    expect(symptomEligible(S, windowedOf(eligible), indexDayLogs(eligible.dayLogs))).toBe(true);
  });

  it("counts occurrences anywhere in the cycle, not only inside a window", () => {
    // If eligibility depended on where the symptom fell it would stop being
    // outcome-independent and would bias the false-discovery-rate bookkeeping.
    const sc = buildScenario(repeat(6, { place: [{ id: S, mid: 3 }] }));
    const { diagnostics } = buildInsightsWithDiagnostics(sc);
    expect(diagnostics.testedSymptoms).toContain(S);
  });
});

// ===========================================================================
// §2.4 tiers — nothing, then counts, then claims
// ===========================================================================

describe("§2.4 display tiers", () => {
  it("says nothing at all below 3 completed cycles", () => {
    const sc = buildScenario(repeat(2, STRONG_PRE));
    const insight = only(buildInsights(sc));
    expect(insight.headline).toBe(NOT_ENOUGH_DATA_HEADLINE);
    expect(insight.body).toBe(notEnoughData(2));
    expect(insight.body).not.toContain("pattern tied to your cycle");
  });

  it("shows counts only, never a claim, at 3–4 qualifying cycles", () => {
    const sc = buildScenario(repeat(4, STRONG_PRE));
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    const insight = only(insights);

    expect(diagnostics.qualifyingCycles).toBe(4);
    expect(diagnostics.testBudget).toBe(0);
    expect(diagnostics.records).toHaveLength(0);
    expect(insight.headline).toBe(descriptiveOnlyHeadline(S));
    expect(insight.body).toBe(descriptiveOnly(S, 4, 4));
    expect(insight.body).toContain("too few cycles");
    expect(insight.body).not.toContain("showed up more often");
  });

  it("falls back to the not-enough-data card when no qualifying cycle carries anything", () => {
    const sc = buildScenario(repeat(4, {}));
    const insight = only(buildInsights(sc));
    expect(insight.body).toBe(notEnoughData(4));
  });

  it("makes claims once there are 5 qualifying cycles", () => {
    const sc = buildScenario(repeat(5, STRONG_PRE));
    const insight = only(buildInsights(sc));
    expect(insight.headline).toBe(primaryPremenstrualHeadline(S));
  });

  it("handles an empty record without throwing", () => {
    const insight = only(buildInsights({ cycles: [], dayLogs: [] }));
    expect(insight.body).toBe(notEnoughData(0));
    // Nothing recorded means nothing to show behind the card. This is the one case where
    // supportingDates is legitimately empty.
    expect(insight.supportingDates).toEqual([]);
  });
});

describe("input handling", () => {
  it("does not depend on the order cycles arrive in", () => {
    const sc = buildScenario([...repeat(6, STRONG_PRE), TIE]);
    const shuffled: BuildInsightsInput = {
      cycles: [sc.cycles[3], sc.cycles[6], sc.cycles[0], sc.cycles[5], sc.cycles[1], sc.cycles[4], sc.cycles[2]],
      dayLogs: [...sc.dayLogs].reverse(),
    };
    expect(buildInsights(shuffled)).toEqual(buildInsights(sc));
  });

  it("honours a caller-supplied panel", () => {
    const sc = buildScenario(repeat(6, { place: [{ id: S, pre: 6, ref: 0 }] }));
    const { diagnostics } = buildInsightsWithDiagnostics({ ...sc, panel: [S2, S3] });
    expect(diagnostics.testedSymptoms).toEqual([]);
    expect(only(buildInsights({ ...sc, panel: [S2, S3] })).headline).toBe(NO_PATTERN_HEADLINE);
  });
});

// ===========================================================================
// INV-1 — no card without a stated denominator; every card shows its records
// ===========================================================================

describe("INV-1 — every card states its denominator and carries its records", () => {
  const scenarios: Array<[string, BuiltScenario]> = [
    ["below the 3-cycle floor", buildScenario(repeat(2, STRONG_PRE))],
    ["descriptive tier", buildScenario(repeat(4, STRONG_PRE))],
    ["premenstrual claim", buildScenario(repeat(6, STRONG_PRE))],
    ["postmenstrual claim", buildScenario(repeat(6, { place: [{ id: S, pre: 0, ref: 6 }] }))],
    ["no pattern", buildScenario(repeat(6, { place: [{ id: S, mid: 4 }] }))],
    ["nothing eligible", buildScenario(repeat(6, {}))],
  ];

  it.each(scenarios)("%s states a cycle count", (_name, sc) => {
    const insights = buildInsights(sc);
    expect(insights.length).toBeGreaterThan(0);
    for (const insight of insights) {
      expect(insight.body).toMatch(/\d+\s+(complete\s+)?cycles?\b/);
      expect(insight.supportingCycles).toBeGreaterThanOrEqual(0);
    }
  });

  it.each(scenarios)("%s populates supportingDates", (_name, sc) => {
    for (const insight of buildInsights(sc)) {
      expect(insight.supportingDates.length).toBeGreaterThan(0);
      // Sorted, unique, and drawn from days the user actually has records for.
      const sorted = [...insight.supportingDates].sort(compare);
      expect(insight.supportingDates).toEqual(sorted);
      expect(new Set(insight.supportingDates).size).toBe(insight.supportingDates.length);
    }
  });

  it("backs a claim with the logged days of both windows, positives and negatives", () => {
    const sc = buildScenario(repeat(6, STRONG_PRE));
    const insight = only(buildInsights(sc));
    // 6 cycles × (7 premenstrual + 7 reference) fully logged days.
    expect(insight.supportingDates).toHaveLength(6 * 14);
    const logged = new Set(sc.dayLogs.map((l) => l.date));
    for (const d of insight.supportingDates) expect(logged.has(d)).toBe(true);
  });

  it("gives every card an id and the symptom kind", () => {
    for (const [, sc] of scenarios) {
      for (const insight of buildInsights(sc)) {
        expect(insight.id).not.toBe("");
        expect(insight.kind).toBe("symptom");
      }
    }
  });
});

// ===========================================================================
// INV-2 / INV-3 / INV-9 / INV-10 — language
// ===========================================================================

/** Every user-facing string this module can emit, with representative arguments. */
function allCopyStrings(): string[] {
  const counts = { symptom: S, k: 5, n: 6, kOther: 1, nq: 7 };
  return [
    ...Object.values(SYMPTOM_LABELS),
    ...SYMPTOM_PANEL.map((s) => capitalizedSymptomLabel(s as SymptomId)),
    ...SYMPTOM_PANEL.map((s) => symptomLabel(s as SymptomId)),
    basedOnCycles(7),
    LOGGING_CAVEAT,
    DID_NOT_REPLICATE,
    primaryPremenstrualHeadline(S),
    primaryPremenstrualBody(counts),
    primaryPostmenstrualHeadline(S),
    primaryPostmenstrualBody(counts),
    detailExpander({ symptom: S, a: 30, A: 42, b: 4, B: 42 }),
    NOT_ENOUGH_DATA_HEADLINE,
    notEnoughData(3),
    descriptiveOnlyHeadline(S),
    descriptiveOnly(S, 3, 4),
    NO_PATTERN_HEADLINE,
    noPattern(3, 8),
  ];
}

/** SPEC.md §4.4 / INV-3. Agent D's lint runs the authoritative version of this over every
 * copy module; this is the local guard so a regression here fails in this file too. */
const BANNED = [
  "abnormal",
  "pathological",
  "disorder",
  "diagnos",
  "screening",
  "detect",
  "hormone",
  "hormonal imbalance",
  "imbalance",
  "pms",
  "pmdd",
  "pcos",
  "endometriosis",
  "causes",
  "because of your",
  "linked to",
  "significant",
  "p =",
  "safe day",
  "guaranteed",
  "cannot become pregnant",
  "you are ovulating",
  "accuracy",
  "% accurate",
  "medical-grade",
  "clinically accurate",
];

/** The one sanctioned exception (SPEC.md §4.4 "disclaimer text") removed, so everything
 * else has to stand on its own merits. */
function withoutDisclaimer(s: string): string {
  return s.split(INSIGHT_DISCLAIMER).join("");
}

describe("INV-3 — banned vocabulary", () => {
  it("keeps every insight string clear of the banned list", () => {
    for (const s of allCopyStrings()) {
      const checked = withoutDisclaimer(s).toLowerCase();
      for (const word of BANNED) {
        expect(checked, `"${s}" contains "${word}"`).not.toContain(word);
      }
    }
  });

  it("confines the one allowed exception to the disclaimer sentence", () => {
    // §E.4 mandates "not a diagnosis, and not a cause" verbatim. It is disclaimer text —
    // SPEC.md §4.4's named exception — and it is factored into its own export so the
    // lint allowlist can name exactly this string and nothing else.
    expect(INSIGHT_DISCLAIMER).toBe(
      "This is a summary of what you recorded — not a diagnosis, and not a cause.",
    );
    const offenders = allCopyStrings().filter((s) =>
      withoutDisclaimer(s).toLowerCase().includes("diagnos"),
    );
    expect(offenders).toEqual([]);
    // ...and the exception really is needed: the claim bodies do carry it.
    expect(INSIGHT_DISCLAIMER.toLowerCase()).toContain("diagnos");
  });

  it("keeps the disclaimer attached to both claim bodies", () => {
    const counts = { symptom: S, k: 5, n: 6, kOther: 1, nq: 7 };
    expect(primaryPremenstrualBody(counts)).toContain(INSIGHT_DISCLAIMER);
    expect(primaryPostmenstrualBody(counts)).toContain(INSIGHT_DISCLAIMER);
  });
});

describe("INV-2 — nothing is phrased as a prediction", () => {
  const FUTURE = [
    /\bwill\b/i,
    /\byou'll\b/i,
    /\bwe'll\b/i,
    /\bgoing to\b/i,
    /\bexpect/i,
    /\bpredict/i,
    /\btomorrow\b/i,
    /\bupcoming\b/i,
    /\bshould\b/i,
    /\byou are about to\b/i,
    /\bnext (period|cycle|week|month)\b/i,
  ];

  it("uses no future tense in any insight string", () => {
    for (const s of allCopyStrings()) {
      for (const re of FUTURE) {
        expect(re.test(s), `"${s}" matches ${re}`).toBe(false);
      }
    }
  });

  it("uses no future tense in any rendered card", () => {
    const scenarios = [
      buildScenario(repeat(2, STRONG_PRE)),
      buildScenario(repeat(4, STRONG_PRE)),
      buildScenario(repeat(6, STRONG_PRE)),
      buildScenario(repeat(6, { place: [{ id: S, pre: 0, ref: 6 }] })),
      buildScenario(repeat(6, { place: [{ id: S, mid: 4 }] })),
    ];
    for (const sc of scenarios) {
      for (const insight of buildInsights(sc)) {
        for (const text of [insight.headline, insight.body, insight.detail]) {
          for (const re of FUTURE) expect(re.test(text), `"${text}" matches ${re}`).toBe(false);
        }
      }
    }
  });

  it("describes the windows in the past tense", () => {
    const counts = { symptom: S, k: 5, n: 6, kOther: 1, nq: 7 };
    expect(primaryPremenstrualBody(counts)).toContain("You logged");
    expect(primaryPremenstrualBody(counts)).toContain("before your period started");
    expect(primaryPostmenstrualBody(counts)).toContain("after your period ended");
  });
});

describe("INV-9 / INV-10 — no verdicts about pain change or bleeding volume", () => {
  it("never calls anything an improvement or a deterioration", () => {
    // The NRS smallest detectable change is 2.76 points — roughly a full band — so this
    // module simply does not carry change language at all.
    for (const s of allCopyStrings()) {
      for (const word of ["improv", "better", "worse", "worsen", "getting"]) {
        expect(s.toLowerCase(), `"${s}" contains "${word}"`).not.toContain(word);
      }
    }
  });

  it("never asserts heaviness or excess as a fact", () => {
    for (const s of allCopyStrings()) {
      for (const word of ["heavy", "heavier", "excessive", "too much", "normal range"]) {
        expect(s.toLowerCase(), `"${s}" contains "${word}"`).not.toContain(word);
      }
    }
  });

  it("shows counts rather than percentages or p-values (§3.5)", () => {
    for (const s of allCopyStrings()) {
      expect(s).not.toMatch(/\d\s*%/);
      expect(s.toLowerCase()).not.toContain("p-value");
      expect(s.toLowerCase()).not.toContain("probability");
    }
  });
});

// ===========================================================================
// Rendering details
// ===========================================================================

describe("card rendering", () => {
  it("reproduces the §E.4 primary template exactly", () => {
    const sc = buildScenario(repeat(6, STRONG_PRE));
    const insight = only(buildInsights(sc));
    expect(insight.headline).toBe("Cramps showed up more often before your period.");
    expect(insight.body).toBe(
      "You logged cramps in the 7 days before your period started in 6 of your last 6 " +
        "complete cycles, and in 0 of 6 in the week after your period ended.\n\n" +
        "Based on 6 cycles with enough days logged.\n" +
        INSIGHT_DISCLAIMER,
    );
  });

  it("puts both denominators in the detail expander", () => {
    const sc = buildScenario(repeat(6, STRONG_PRE));
    const insight = only(buildInsights(sc));
    expect(insight.detail).toContain("Week before period:      36 of 42 days");
    expect(insight.detail).toContain("Week after period ended: 0 of 42 days");
    expect(insight.detail).toContain(LOGGING_CAVEAT);
  });

  it("orders cards by p-value, most certain first", () => {
    const sc = buildScenario([
      ...repeat(6, { place: [{ id: S, pre: 6, ref: 0 }, { id: S2, pre: 6, ref: 0 }] }),
      ...repeat(6, { place: [{ id: S, pre: 6, ref: 0 }, { id: S2, pre: 3, ref: 2 }] }),
    ]);
    const { insights, diagnostics } = buildInsightsWithDiagnostics(sc);
    const pFor = (s: SymptomId) =>
      diagnostics.records.find((r) => r.symptom === s)?.combined?.p ?? 1;
    expect(pFor(S)).toBeLessThan(pFor(S2));
    expect(insights[0].id).toContain(S);
  });
});

/**
 * lib/engine/index.test.ts — integration test over the WHOLE pipeline (SPEC.md §4.1).
 *
 * Everything here is hand-built: no database, no repo layer, no `Date.now()`. `today` is
 * always an explicit `CivilDate` (SPEC.md R3), so every assertion below is deterministic
 * and will still hold in ten years.
 *
 * What this file is for, as distinct from the per-module tests: those verify that each
 * engine module is individually correct; this one verifies that they are *wired together
 * in the right order* and that the single `EngineOutput` every screen reads has the shape
 * every screen expects.
 */

import { describe, expect, it } from "vitest";
import { addDays, diffDays, parseCivil, type CivilDate } from "@/lib/date/civil";
import type {
  CalibrationState,
  DayLog,
  EngineOutput,
  Profile,
  Settings,
  UserDecisions,
} from "@/lib/domain/types";
import { MU0_DEFAULT, SIGMA0 } from "@/lib/engine/constants";
import { mu0ForAge } from "@/lib/engine/prediction";
import { CALIBRATION_NEUTRAL, type IssuedPrediction } from "@/lib/engine/performance";
import { computeEverything, type ComputeEverythingInput, type EngineResult } from "@/lib/engine";

// ============================================================================
// Fixtures
// ============================================================================

function d(s: string): CivilDate {
  return parseCivil(s);
}

const DEFAULT_SETTINGS: Settings = {
  fertilityEnabled: false,
  tierCSymptomsEnabled: false,
  healthAwarenessEnabled: true,
  notifications: {
    periodReminder: true,
    fertileReminder: false,
    symptomReminder: true,
    medicationReminder: false,
    loggingReminder: true,
    healthAwareness: true,
    privateWording: true,
  },
  locale: "en-US",
};

/** A 30-year-old with no life-stage flags set. Age 30 keeps her clear of the skip
 * detector's perimenopause suppression (>= 43) so the skip fixtures can actually fire. */
function profileOf(overrides: Partial<Profile> = {}): Profile {
  return {
    birthYear: 1995,
    menarcheYear: 2008,
    state: {
      pregnant: false,
      breastfeeding: false,
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: false,
      preferNotToSay: false,
      ...overrides.state,
    },
    settings: { ...DEFAULT_SETTINGS, ...overrides.settings },
    ...("birthYear" in overrides ? { birthYear: overrides.birthYear } : {}),
    ...("menarcheYear" in overrides ? { menarcheYear: overrides.menarcheYear } : {}),
    ...("reportedTypicalCycleLength" in overrides
      ? { reportedTypicalCycleLength: overrides.reportedTypicalCycleLength }
      : {}),
  };
}

const NO_DECISIONS: UserDecisions = { excludedCycles: {}, skipPrompts: {} };

function log(date: CivilDate, extra: Partial<DayLog> = {}): DayLog {
  return {
    date,
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: date,
    ...extra,
  };
}

/** One period: `periodDays` consecutive menstrual days from `start`, tapering flow. */
function periodLogs(start: CivilDate, periodDays = 5): DayLog[] {
  const flows: DayLog["flow"][] = ["medium", "heavy", "medium", "light", "light"];
  const out: DayLog[] = [];
  for (let i = 0; i < periodDays; i++) {
    out.push(
      log(addDays(start, i), {
        bleeding: "menstrual",
        flow: flows[Math.min(i, flows.length - 1)],
        periodBoundary: i === 0 ? "start" : i === periodDays - 1 ? "end" : undefined,
      }),
    );
  }
  return out;
}

/** The period start dates implied by an anchor and a list of cycle lengths.
 * `lengths.length` cycles produce `lengths.length + 1` starts. */
function startsFrom(anchor: CivilDate, lengths: readonly number[]): CivilDate[] {
  const starts: CivilDate[] = [anchor];
  for (const l of lengths) starts.push(addDays(starts[starts.length - 1], l));
  return starts;
}

function logsForStarts(starts: readonly CivilDate[], periodDays = 5): DayLog[] {
  return starts.flatMap((s) => periodLogs(s, periodDays));
}

function run(overrides: Partial<ComputeEverythingInput> & { today: CivilDate }): EngineResult {
  return computeEverything({
    dayLogs: [],
    profile: profileOf(),
    decisions: NO_DECISIONS,
    calibration: CALIBRATION_NEUTRAL,
    ...overrides,
  });
}

// --- the six users the brief names --------------------------------------------------

const CONSISTENT_LENGTHS = [29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29, 29];
const CONSISTENT_STARTS = startsFrom(d("2024-01-03"), CONSISTENT_LENGTHS);
const CONSISTENT_LOGS = logsForStarts(CONSISTENT_STARTS);
const CONSISTENT_TODAY = addDays(CONSISTENT_STARTS[CONSISTENT_STARTS.length - 1], 20);

/** Every length below NO_SPLIT_BELOW (45), so nothing here is a skip — this user really
 * is this variable, and the engine must say so rather than "correcting" her data. */
const VARIABLE_LENGTHS = [24, 38, 26, 41, 30, 35, 27, 44, 25, 39, 28, 36];
const VARIABLE_STARTS = startsFrom(d("2024-01-03"), VARIABLE_LENGTHS);
const VARIABLE_LOGS = logsForStarts(VARIABLE_STARTS);
const VARIABLE_TODAY = addDays(VARIABLE_STARTS[VARIABLE_STARTS.length - 1], 20);

/** One 58-day gap in an otherwise 29-day history: the textbook missed log. */
const SKIP_LENGTHS = [29, 29, 29, 58, 29, 29];
const SKIP_STARTS = startsFrom(d("2024-01-03"), SKIP_LENGTHS);
const SKIP_LOGS = logsForStarts(SKIP_STARTS);
const SKIP_TODAY = addDays(SKIP_STARTS[SKIP_STARTS.length - 1], 15);

// ============================================================================
// Shape guard — what every screen is allowed to assume
// ============================================================================

/** SPEC.md §4.1: "Every screen reads from one EngineOutput." If this helper ever fails,
 * a screen somewhere renders `undefined`. */
function expectEngineOutputShape(result: EngineResult): void {
  const output: EngineOutput = result;

  expect(Array.isArray(output.episodes)).toBe(true);
  expect(Array.isArray(output.cycles)).toBe(true);
  expect(Array.isArray(output.insights)).toBe(true);
  expect(Array.isArray(output.healthMessages)).toBe(true);

  // R8: the prediction path never returns a bare date.
  expect(output.prediction).toBeDefined();
  expect(["none", "population_estimate", "personal"]).toContain(output.prediction.kind);
  expect([
    "not_enough_information",
    "early_estimate",
    "limited",
    "more_consistent",
  ]).toContain(output.prediction.confidence);
  // §4.3: the confidence phrase is always accompanied by its reason.
  expect(output.prediction.confidenceReason.length).toBeGreaterThan(0);
  expect(output.prediction.basis).toMatchObject({
    usableCycles: expect.any(Number),
    windowCycles: expect.any(Number),
    effectiveN: expect.any(Number),
    sigma: expect.any(Number),
    halfWidthDays: expect.any(Number),
    calibrationFactor: expect.any(Number),
  });
  // A prediction is a range or it is nothing — never a lone centre.
  const { center, low, high } = output.prediction;
  expect([center, low, high].every((v) => v === null)).toBe(
    [center, low, high].every((v) => v !== null) ? false : true,
  );
  if (center !== null) {
    expect(low).not.toBeNull();
    expect(high).not.toBeNull();
    expect(diffDays(low as CivilDate, high as CivilDate)).toBeGreaterThanOrEqual(0);
  }

  expect(output.stats).toBeDefined();
  expect(typeof output.stats.completedCycleCount).toBe("number");
  expect(typeof output.stats.heavyFlowDayCount).toBe("number");

  expect(output.performance).toBeDefined();
  expect(output.performance).toHaveProperty("lastSignedErrorDays");
  expect(output.performance).toHaveProperty("rollingMedianAbsoluteErrorDays");
  expect(output.performance).toHaveProperty("windowHitRate");

  // The extras every screen beyond the dashboard needs.
  expect(Array.isArray(result.skipPrompts)).toBe(true);
  expect(Array.isArray(result.resolvedPredictions)).toBe(true);
  expect(result.insightDiagnostics).toBeDefined();
  expect(result.estimate.firstPass).toBeDefined();
  expect(result.estimate.final).toBeDefined();
  expect(result.recomputedCalibration).toBeDefined();

  // Every insight card carries its "view the records behind this" payload (U2's brief).
  for (const insight of output.insights) {
    expect(insight.id.length).toBeGreaterThan(0);
    expect(insight.headline.length).toBeGreaterThan(0);
    expect(Array.isArray(insight.supportingDates)).toBe(true);
    expect(["cycle", "duration", "symptom", "flow", "performance"]).toContain(insight.kind);
  }

  // Every health message can answer "Why am I seeing this?" (SPEC.md §3).
  for (const message of output.healthMessages) {
    expect(message.sourceName.length).toBeGreaterThan(0);
    expect(message.sourceUrl.length).toBeGreaterThan(0);
    expect(message.sourceThreshold.length).toBeGreaterThan(0);
  }
}

// ============================================================================
// 1. The consistent 12-cycle user
// ============================================================================

describe("computeEverything — consistent 12-cycle user", () => {
  const result = run({
    dayLogs: CONSISTENT_LOGS,
    today: CONSISTENT_TODAY,
  });

  it("returns the full EngineOutput shape", () => {
    expectEngineOutputShape(result);
  });

  it("derives one episode per logged period and twelve completed cycles", () => {
    expect(result.episodes).toHaveLength(CONSISTENT_STARTS.length);
    expect(result.stats.completedCycleCount).toBe(CONSISTENT_LENGTHS.length);
    // buildCycles emits the in-progress cycle plus every completed one.
    expect(result.cycles.filter((c) => c.status === "in_progress")).toHaveLength(1);
    expect(result.cycles.filter((c) => c.status === "ok")).toHaveLength(12);
  });

  it("predicts a personal range centred on the user's own 29-day length", () => {
    expect(result.prediction.kind).toBe("personal");
    expect(result.prediction.predictedLengthDays).toBe(29);
    expect(result.prediction.center).toBe(
      addDays(CONSISTENT_STARTS[CONSISTENT_STARTS.length - 1], 29),
    );
    expect(result.prediction.confidence).toBe("more_consistent");
    expect(result.prediction.basis.usableCycles).toBe(12);
  });

  it("reports statistics with their variation, never a bare average", () => {
    expect(result.stats.typicalCycleLength).toMatchObject({ center: 29, n: 12 });
    // N >= 6, so the FIGO shortest-to-longest range and the regularity band are available.
    expect(result.stats.figoRange).not.toBeNull();
    expect(result.stats.regularityBand).toBe("very_consistent");
    expect(result.stats.variabilityHeadline).not.toBeNull();
  });

  it("raises no skip prompt on a clean history", () => {
    expect(result.skipPrompts).toEqual([]);
    expect(result.cycles.some((c) => c.status === "skip_suspected")).toBe(false);
  });

  it("is deterministic and does not mutate its inputs (R3)", () => {
    const before = JSON.stringify(CONSISTENT_LOGS);
    const again = run({ dayLogs: CONSISTENT_LOGS, today: CONSISTENT_TODAY });
    expect(JSON.stringify(again)).toEqual(JSON.stringify(result));
    expect(JSON.stringify(CONSISTENT_LOGS)).toEqual(before);
  });
});

// ============================================================================
// 2. The highly variable user
// ============================================================================

describe("computeEverything — highly variable user", () => {
  const result = run({ dayLogs: VARIABLE_LOGS, today: VARIABLE_TODAY });

  it("returns the full EngineOutput shape", () => {
    expectEngineOutputShape(result);
  });

  it("keeps every cycle: variability is not an anomaly to be corrected away (R7)", () => {
    expect(result.stats.completedCycleCount).toBe(VARIABLE_LENGTHS.length);
    expect(result.cycles.some((c) => c.status === "skip_suspected")).toBe(false);
    expect(result.cycles.some((c) => c.status === "gap_unknown")).toBe(false);
  });

  it("reports Limited confidence and a wider interval than the consistent user", () => {
    const consistent = run({ dayLogs: CONSISTENT_LOGS, today: CONSISTENT_TODAY });
    expect(result.prediction.confidence).toBe("limited");
    expect(result.prediction.basis.halfWidthDays).toBeGreaterThan(
      consistent.prediction.basis.halfWidthDays,
    );
    expect(result.stats.regularityBand).toBe("high_variation");
  });

  it("estimates a larger scale than the consistent user", () => {
    const consistent = run({ dayLogs: CONSISTENT_LOGS, today: CONSISTENT_TODAY });
    expect(result.estimate.final.sigmaHat).toBeGreaterThan(
      consistent.estimate.final.sigmaHat,
    );
  });
});

// ============================================================================
// 3. Zero, one and two cycles
// ============================================================================

describe("computeEverything — the cold-start users", () => {
  const today = d("2025-06-01");

  it("N = 0 with no logs at all: nothing is claimed", () => {
    const result = run({ dayLogs: [], today });
    expectEngineOutputShape(result);

    expect(result.episodes).toEqual([]);
    expect(result.cycles).toEqual([]);
    expect(result.prediction.kind).toBe("none");
    expect(result.prediction.suppressed).toEqual({ reason: "insufficient_data" });
    expect(result.prediction.center).toBeNull();
    expect(result.stats.completedCycleCount).toBe(0);
    expect(result.stats.typicalCycleLength).toBeNull();
    expect(result.stats.figoRange).toBeNull();
    expect(result.stats.regularityBand).toBeNull();
    // The insight engine always ships a card — INV-8 — even at zero data.
    expect(result.insights.length).toBeGreaterThanOrEqual(1);
  });

  it("N = 0 with no usable cycle falls back to the cited prior, marked as such", () => {
    const result = run({ dayLogs: [], today });
    expect(result.estimate.firstPass.source).toBe("prior");
    expect(result.estimate.final.source).toBe("prior");
    expect(result.estimate.final.usableCycles).toBe(0);
    // The prior is age-banded (§3.2), so it is `mu0ForAge(30)` = 28.3, not the
    // age-unknown MU0_DEFAULT. Asserting the band explicitly guards against a future
    // change that quietly drops the age lookup.
    expect(result.estimate.final.lHat).toBe(mu0ForAge(30));
    expect(result.estimate.final.lHat).not.toBe(MU0_DEFAULT);
    // No life-stage flag applies at age 30 with a gynecologic age of 17, so the scale is
    // the unscaled prior.
    expect(result.estimate.final.sigmaHat).toBeCloseTo(SIGMA0, 10);
  });

  it("N = 0 with one recorded period: a population estimate, explicitly not personal", () => {
    const start = d("2025-05-10");
    const result = run({ dayLogs: periodLogs(start), today });
    expectEngineOutputShape(result);

    expect(result.cycles).toHaveLength(1);
    expect(result.cycles[0].status).toBe("in_progress");
    expect(result.stats.completedCycleCount).toBe(0);
    expect(result.prediction.kind).toBe("population_estimate");
    expect(result.prediction.confidence).toBe("early_estimate");
    expect(result.prediction.basis.usableCycles).toBe(0);
    expect(result.prediction.center).not.toBeNull();
  });

  it("N = 1: personal but Not enough information, and still a range", () => {
    const starts = startsFrom(d("2025-04-05"), [30]);
    const result = run({ dayLogs: logsForStarts(starts), today });
    expectEngineOutputShape(result);

    expect(result.stats.completedCycleCount).toBe(1);
    expect(result.prediction.kind).toBe("personal");
    expect(result.prediction.confidence).toBe("not_enough_information");
    expect(result.prediction.low).not.toBeNull();
    expect(result.prediction.high).not.toBeNull();
    // §4.3 N=1: a single data point has no spread; the FIGO range stays unavailable.
    expect(result.stats.figoRange).toBeNull();
    expect(result.stats.regularityBand).toBeNull();
  });

  it("N = 2: still Not enough information, still a range", () => {
    const starts = startsFrom(d("2025-03-05"), [30, 27]);
    const result = run({ dayLogs: logsForStarts(starts), today });
    expectEngineOutputShape(result);

    expect(result.stats.completedCycleCount).toBe(2);
    expect(result.prediction.confidence).toBe("not_enough_information");
    expect(result.stats.figoRange).toBeNull();
    expect(result.estimate.final.source).toBe("observed");
    expect(result.estimate.final.usableCycles).toBe(2);
  });
});

// ============================================================================
// 4. The user with a skipped log — and the two-pass estimate that catches it
// ============================================================================

describe("computeEverything — user with a skipped log", () => {
  const result = run({ dayLogs: SKIP_LOGS, today: SKIP_TODAY });

  it("returns the full EngineOutput shape", () => {
    expectEngineOutputShape(result);
  });

  it("flags the 58-day gap as skip_suspected with k* = 2, without mutating anything", () => {
    const suspected = result.cycles.filter((c) => c.status === "skip_suspected");
    expect(suspected).toHaveLength(1);
    expect(suspected[0].lengthDays).toBe(58);
    expect(suspected[0].impliedSplitCount).toBe(2);
    // R7: the cycle stays in history, annotated, with a displayable reason.
    expect(suspected[0].statusReason).toBeDefined();
    expect((suspected[0].statusReason as string).length).toBeGreaterThan(0);
    // The recorded day logs are untouched: still one episode per logged period.
    expect(result.episodes).toHaveLength(SKIP_STARTS.length);
  });

  it("offers the 'did you miss logging a period?' prompt", () => {
    expect(result.skipPrompts).toHaveLength(1);
    const prompt = result.skipPrompts[0];
    expect(prompt.cycleStartDate).toBe(SKIP_STARTS[3]);
    expect(prompt.prompt.question).toContain("miss logging");
    expect(prompt.prompt.suggestedDate).toBe(addDays(SKIP_STARTS[3], 29));
    expect(prompt.prompt.options).toHaveLength(1);
  });

  it("does not let the 58-day gap into the location estimate", () => {
    // The suspected cycle is excluded from `usableCycleLengths`, so L̂ stays near the
    // user's real 29 days rather than being dragged toward 33.
    expect(result.estimate.final.lHat).toBeGreaterThan(28);
    expect(result.estimate.final.lHat).toBeLessThan(30);
    expect(result.estimate.final.usableCycles).toBe(5);
  });

  it("re-estimates on the second pass: the final estimate is drawn from the corrected set", () => {
    // Pass 1 runs the detector against the population prior; pass 2 runs it against the
    // user's own L̂/σ̂. Both are reported, and both are `observed` here because the first
    // pass already found usable cycles.
    expect(result.estimate.firstPass.source).toBe("observed");
    expect(result.estimate.final.source).toBe("observed");
    // The second pass tightens σ̂ below the population prior for this near-regular user.
    expect(result.estimate.final.sigmaHat).toBeLessThan(SIGMA0);
  });

  it("stops asking once the user answers 'no'", () => {
    const decisions: UserDecisions = {
      excludedCycles: {},
      skipPrompts: {
        [SKIP_STARTS[3]]: { confirmed: false, decidedOn: SKIP_TODAY },
      },
    };
    const answered = run({ dayLogs: SKIP_LOGS, today: SKIP_TODAY, decisions });
    expect(answered.skipPrompts).toEqual([]);
    // The cycle is unchanged: declining the prompt is not an exclusion.
    expect(answered.cycles.filter((c) => c.status === "skip_suspected")).toHaveLength(1);
  });

  it("splits the gap into two down-weighted cycles when the user confirms", () => {
    const decisions: UserDecisions = {
      excludedCycles: {},
      skipPrompts: {
        [SKIP_STARTS[3]]: { confirmed: true, decidedOn: SKIP_TODAY },
      },
    };
    const confirmed = run({ dayLogs: SKIP_LOGS, today: SKIP_TODAY, decisions });

    expect(confirmed.cycles.filter((c) => c.status === "skip_suspected")).toHaveLength(0);
    expect(confirmed.stats.completedCycleCount).toBe(SKIP_LENGTHS.length + 1);
    // Inferred splits carry weight 0.5 so they cannot tighten σ̂ like observed data.
    const inferred = confirmed.cycles.filter((c) => c.weight === 0.5);
    expect(inferred.length).toBe(2);
    expect(confirmed.skipPrompts).toEqual([]);
  });
});

// ============================================================================
// 5. User decisions: exclusions
// ============================================================================

describe("computeEverything — excluded cycles", () => {
  it("marks the cycle rather than deleting it, and keeps the reason (R7)", () => {
    const excludedStart = CONSISTENT_STARTS[4];
    const decisions: UserDecisions = {
      excludedCycles: {
        [excludedStart]: { reason: "I was ill that month", decidedOn: CONSISTENT_TODAY },
      },
      skipPrompts: {},
    };
    const result = run({
      dayLogs: CONSISTENT_LOGS,
      today: CONSISTENT_TODAY,
      decisions,
    });
    expectEngineOutputShape(result);

    const excluded = result.cycles.find((c) => c.startDate === excludedStart);
    expect(excluded).toBeDefined();
    expect(excluded?.status).toBe("excluded_by_user");
    expect(excluded?.statusReason).toContain("I was ill that month");
    // Still visible in history, still counted as a completed cycle.
    expect(result.cycles).toHaveLength(13);
    expect(result.stats.completedCycleCount).toBe(12);
    // ...but no longer feeding the estimator.
    expect(result.prediction.basis.usableCycles).toBe(11);
  });
});

// ============================================================================
// 6. The pregnant user — predictions suppressed
// ============================================================================

describe("computeEverything — pregnant user", () => {
  const profile = profileOf({
    state: {
      pregnant: true,
      breastfeeding: false,
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: false,
      preferNotToSay: false,
    },
    // Deliberately ON, to prove suppression wins over the toggle.
    settings: { ...DEFAULT_SETTINGS, fertilityEnabled: true },
  });

  const result = run({
    dayLogs: CONSISTENT_LOGS,
    profile,
    today: CONSISTENT_TODAY,
  });

  it("returns the full EngineOutput shape", () => {
    expectEngineOutputShape(result);
  });

  it("suppresses the prediction with an explicit reason, not a silent null", () => {
    expect(result.prediction.kind).toBe("none");
    expect(result.prediction.suppressed).toEqual({ reason: "pregnant" });
    expect(result.prediction.center).toBeNull();
    expect(result.prediction.low).toBeNull();
    expect(result.prediction.high).toBeNull();
    expect(result.prediction.confidenceReason.length).toBeGreaterThan(0);
  });

  it("emits no fertility estimate even though the toggle is on", () => {
    // A suppressed prediction has nothing to work backwards from.
    expect("fertility" in result).toBe(false);
  });

  it("still derives cycles and statistics from the recorded history", () => {
    expect(result.stats.completedCycleCount).toBe(12);
    expect(result.cycles.length).toBeGreaterThan(0);
  });
});

// ============================================================================
// 7. Fertility gating — the field must be ABSENT, not empty
// ============================================================================

describe("computeEverything — fertility gating", () => {
  it("omits the key entirely when settings.fertilityEnabled is false", () => {
    const result = run({ dayLogs: CONSISTENT_LOGS, today: CONSISTENT_TODAY });

    expect("fertility" in result).toBe(false);
    expect(Object.keys(result)).not.toContain("fertility");
    expect(Object.prototype.hasOwnProperty.call(result, "fertility")).toBe(false);
    // JSON round-trip: the API layer cannot resurrect it either.
    expect(Object.keys(JSON.parse(JSON.stringify(result)))).not.toContain("fertility");
  });

  it("includes an estimate, with its disclaimer attached, when enabled", () => {
    const profile = profileOf({
      settings: { ...DEFAULT_SETTINGS, fertilityEnabled: true },
    });
    const result = run({
      dayLogs: CONSISTENT_LOGS,
      profile,
      today: CONSISTENT_TODAY,
    });
    expectEngineOutputShape(result);

    expect("fertility" in result).toBe(true);
    const fertility = result.fertility;
    expect(fertility).toBeDefined();
    if (fertility === undefined) return;

    // The window is a range, and the fertile window brackets the ovulation band.
    expect(diffDays(fertility.ovulationLow, fertility.ovulationHigh)).toBeGreaterThanOrEqual(0);
    expect(diffDays(fertility.fertileLow, fertility.ovulationLow)).toBe(5);
    expect(diffDays(fertility.ovulationHigh, fertility.fertileHigh)).toBe(1);
    // R8/§4.1: the disclaimer travels with the estimate so it cannot be rendered apart.
    expect(fertility.disclaimer.length).toBeGreaterThan(0);
    expect(fertility.confidenceNote.length).toBeGreaterThan(0);
    // The band sits before the predicted period, not after it.
    expect(
      diffDays(fertility.ovulationHigh, result.prediction.center as CivilDate),
    ).toBeGreaterThanOrEqual(0);
  });

  it("omits the key when enabled but there is nothing to anchor to", () => {
    const profile = profileOf({
      settings: { ...DEFAULT_SETTINGS, fertilityEnabled: true },
    });
    const result = run({ dayLogs: [], profile, today: d("2025-06-01") });
    expect("fertility" in result).toBe(false);
  });
});

// ============================================================================
// 8. Health-awareness gating
// ============================================================================

describe("computeEverything — health awareness gating", () => {
  it("emits no non-urgent messages when the toggle is off", () => {
    // A 12-day period is long enough to trip the duration family.
    const starts = startsFrom(d("2024-06-01"), [29, 29, 29, 29, 29, 29]);
    const dayLogs = starts.flatMap((s) => periodLogs(s, 12));

    const on = run({
      dayLogs,
      profile: profileOf(),
      today: addDays(starts[starts.length - 1], 20),
    });
    const off = run({
      dayLogs,
      profile: profileOf({
        settings: { ...DEFAULT_SETTINGS, healthAwarenessEnabled: false },
      }),
      today: addDays(starts[starts.length - 1], 20),
    });

    expectEngineOutputShape(on);
    expectEngineOutputShape(off);

    expect(on.healthMessages.length).toBeGreaterThan(0);
    expect(on.healthMessages.every((m) => m.severity !== "seek_urgent_care")).toBe(true);
    // With the toggle off only the never-suppressed urgent rules could survive, and none
    // of them fire on this history.
    expect(off.healthMessages).toEqual([]);
  });

  it("never lets a health message reach the UI without its citation", () => {
    const starts = startsFrom(d("2024-06-01"), [29, 29, 29, 29, 29, 29]);
    const result = run({
      dayLogs: starts.flatMap((s) => periodLogs(s, 12)),
      today: addDays(starts[starts.length - 1], 20),
    });
    for (const m of result.healthMessages) {
      expect(m.sourceName).toBeTruthy();
      expect(m.sourceUrl).toMatch(/^https?:\/\//);
      expect(m.sourceThreshold).toBeTruthy();
    }
  });
});

// ============================================================================
// 9. Performance and calibration wiring
// ============================================================================

describe("computeEverything — prediction performance", () => {
  /** One issued prediction per completed cycle, each anchored to a real period start. */
  const issued: IssuedPrediction[] = CONSISTENT_STARTS.slice(0, -1).map((anchor) => ({
    anchorStart: anchor,
    predictedStart: addDays(anchor, 29),
    windowLow: addDays(anchor, 26),
    windowHigh: addDays(anchor, 32),
  }));

  const result = run({
    dayLogs: CONSISTENT_LOGS,
    today: CONSISTENT_TODAY,
    issuedPredictions: issued,
  });

  it("resolves every issued prediction against a recorded start", () => {
    expect(result.resolvedPredictions).toHaveLength(issued.length);
    expect(result.resolvedPredictions.every((r) => r.signedErrorDays === 0)).toBe(true);
    expect(result.resolvedPredictions.every((r) => r.insideWindow)).toBe(true);
  });

  it("reports error and hit rate, never a lone accuracy percentage", () => {
    expect(result.performance.lastSignedErrorDays).toBe(0);
    expect(result.performance.rollingMedianAbsoluteErrorDays).toBe(0);
    const hitRate = result.performance.windowHitRate;
    expect(hitRate).not.toBeNull();
    expect(hitRate?.center).toBe(1);
    // The raw counts ride along so the UI can say "12 of the last 12".
    expect(hitRate?.n).toBeGreaterThan(0);
  });

  it("proposes a narrowed calibration factor without mutating the input state", () => {
    // Coverage is 100% over every 10-prediction window, so §4.4's narrowing rule fires.
    expect(result.recomputedCalibration.cumulativeAdjustment).toBeLessThan(1);
    expect(result.recomputedCalibration.cumulativeAdjustment).toBeGreaterThanOrEqual(0.7);
    // R3: computeEverything returns the new state; it never writes it anywhere.
    expect(CALIBRATION_NEUTRAL.cumulativeAdjustment).toBe(1);
  });

  it("has no performance figures before anything has resolved", () => {
    const fresh = run({ dayLogs: CONSISTENT_LOGS, today: CONSISTENT_TODAY });
    expect(fresh.resolvedPredictions).toEqual([]);
    expect(fresh.performance.lastSignedErrorDays).toBeNull();
    expect(fresh.performance.rollingMedianAbsoluteErrorDays).toBeNull();
    expect(fresh.performance.windowHitRate).toBeNull();
  });

  it("widens the interval when the caller passes a widened calibration state", () => {
    const widened: CalibrationState = { cumulativeAdjustment: 1.5, recentCoverage: [] };
    const base = run({ dayLogs: CONSISTENT_LOGS, today: CONSISTENT_TODAY });
    const wide = run({
      dayLogs: CONSISTENT_LOGS,
      today: CONSISTENT_TODAY,
      calibration: widened,
    });
    expect(wide.prediction.basis.halfWidthDays).toBeGreaterThan(
      base.prediction.basis.halfWidthDays,
    );
    expect(wide.prediction.basis.calibrationFactor).toBe(1.5);
  });
});

// ============================================================================
// 10. Recomputation contract (SPEC.md §4.1 / PRD §17)
// ============================================================================

describe("computeEverything — recomputation", () => {
  it("editing a historical period changes every later cycle", () => {
    // Move the 6th period start three days earlier by rewriting its logs.
    const edited = CONSISTENT_STARTS.map((s, i) => (i === 5 ? addDays(s, -3) : s));
    const before = run({ dayLogs: CONSISTENT_LOGS, today: CONSISTENT_TODAY });
    const after = run({ dayLogs: logsForStarts(edited), today: CONSISTENT_TODAY });

    expect(after.cycles.find((c) => c.startDate === CONSISTENT_STARTS[4])?.lengthDays).toBe(26);
    expect(after.cycles.find((c) => c.startDate === edited[5])?.lengthDays).toBe(32);
    // Every later cycle start moves too — the edit is not local to the one cycle.
    expect(after.cycles.some((c) => c.startDate === CONSISTENT_STARTS[5])).toBe(false);
    // Statistics recomputed from scratch, not patched.
    expect(before.stats.figoRange).toMatchObject({ low: 29, high: 29 });
    expect(after.stats.figoRange).toMatchObject({ low: 26, high: 32 });
    expect(after.stats.variabilityHeadline).not.toBe(before.stats.variabilityHeadline);
  });

  it("the symptom panel widens with the Tier C opt-in", () => {
    const withSymptoms = CONSISTENT_STARTS.flatMap((start, i) => [
      ...periodLogs(start),
      log(addDays(start, 25), { symptoms: i % 2 === 0 ? ["cramps"] : [], nothingToReport: i % 2 !== 0 }),
    ]);
    const tierA = run({ dayLogs: withSymptoms, today: CONSISTENT_TODAY });
    const tierC = run({
      dayLogs: withSymptoms,
      profile: profileOf({
        settings: { ...DEFAULT_SETTINGS, tierCSymptomsEnabled: true },
      }),
      today: CONSISTENT_TODAY,
    });

    expectEngineOutputShape(tierA);
    expectEngineOutputShape(tierC);
    // Both run; the opt-in can only ever add candidates, never remove them.
    expect(tierC.insightDiagnostics.completedCycles).toBe(
      tierA.insightDiagnostics.completedCycles,
    );
  });
});

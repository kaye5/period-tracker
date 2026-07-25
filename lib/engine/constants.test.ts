import { describe, expect, it } from "vitest";
import {
  ALPHA_UNCORRECTED,
  COVERAGE_BALANCE_MAX,
  COVERAGE_GUARDS,
  COVERAGE_MIN_CYCLE,
  COVERAGE_MIN_PRIMARY,
  COVERAGE_MIN_REFERENCE,
  CYCLE_LEN_ANOMALY_DELTA,
  CYCLE_LEN_MAX,
  CYCLE_LEN_MIN,
  DEADBAND,
  FDR_Q,
  LUTEAL_MEAN,
  LUTEAL_SD,
  MAX_CONSECUTIVE_UNLOGGED_DAYS,
  MAX_CYCLE,
  MAX_IMPLIED,
  MAX_INSIGHTS_SHOWN,
  MIN_CYCLE,
  MIN_CYCLES_TO_SHOW_ANYTHING,
  MIN_DISTINCT_CYCLES,
  MIN_IMPLIED,
  MIN_QUALIFYING_CYCLES_TO_CLAIM,
  MIN_RATE_DIFF,
  MIN_RATE_RATIO,
  MIN_TOTAL_OCCURRENCES,
  MU0_BY_AGE,
  MU0_DEFAULT,
  NO_SPLIT_BELOW,
  NU0,
  PRIMARY_WINDOW,
  REFERENCE_WINDOW,
  RHO,
  SIGMA0,
  SIGMA_FLOOR,
  SYMPTOM_PANEL,
  SYMPTOM_PANEL_TIER_C,
  TARGET_COVERAGE,
  TAU0,
  WINDOW,
  W_FOLLICULAR_REF,
  W_MENSTRUAL,
  W_MID_LUTEAL,
  W_PERIOVULATORY,
  W_PREMENSTRUAL,
  W_PREMENSTRUAL_ACOG,
  Z1_MIN,
  ZK_MAX,
  sigma0Scale,
  testBudget,
} from "./constants";

// These tests are a regression guard for SPEC.md R4 ("a constant with no provenance is
// a bug") and R5 (never assume 28/14): they pin the exact values transcribed verbatim
// from the research docs, so an accidental edit that "rounds" or "improves" a cited
// value fails a test instead of silently drifting.

describe("01-cycle-prediction.md constants — transcribed verbatim", () => {
  it("MU0_BY_AGE covers every age with no gaps and matches the source table exactly", () => {
    expect(MU0_BY_AGE).toEqual([
      { loInclusive: 0, hiExclusive: 26, mu0: 28.5 },
      { loInclusive: 26, hiExclusive: 31, mu0: 28.3 },
      { loInclusive: 31, hiExclusive: 36, mu0: 28.0 },
      { loInclusive: 36, hiExclusive: 41, mu0: 27.7 },
      { loInclusive: 41, hiExclusive: 46, mu0: 27.4 },
      { loInclusive: 46, hiExclusive: 51, mu0: 27.2 },
      { loInclusive: 51, hiExclusive: 200, mu0: 28.0 },
    ]);
    // No gaps: each band's hiExclusive is the next band's loInclusive.
    for (let i = 1; i < MU0_BY_AGE.length; i++) {
      expect(MU0_BY_AGE[i].loInclusive).toBe(MU0_BY_AGE[i - 1].hiExclusive);
    }
  });

  it("scalar priors match the source exactly", () => {
    expect(MU0_DEFAULT).toBe(29.0);
    expect(TAU0).toBe(4.5);
    expect(SIGMA0).toBe(3.5);
    expect(NU0).toBe(3);
  });

  it("estimator/window constants match the source exactly", () => {
    expect(WINDOW).toBe(12);
    expect(RHO).toBe(0.9);
    expect(SIGMA_FLOOR).toBe(2.0);
  });

  it("validity/skip-detection constants match the source exactly", () => {
    expect(MIN_CYCLE).toBe(10);
    expect(MAX_CYCLE).toBe(90);
    expect(NO_SPLIT_BELOW).toBe(45);
    expect(MIN_IMPLIED).toBe(19);
    expect(MAX_IMPLIED).toBe(45);
    expect(Z1_MIN).toBe(3.0);
    expect(ZK_MAX).toBe(1.5);
  });

  it("interval constants match the source exactly", () => {
    expect(TARGET_COVERAGE).toBe(0.8);
    expect(LUTEAL_MEAN).toBe(12.5);
    expect(LUTEAL_SD).toBe(2.4);
  });

  it("never hard-codes a 14-day luteal phase or a 28-day default cycle length (R5)", () => {
    expect(LUTEAL_MEAN).not.toBe(14);
    expect(MU0_DEFAULT).not.toBe(28);
  });
});

describe("sigma0Scale — age/life-stage scaling (01-cycle-prediction.md)", () => {
  it("applies no scaling for a typical adult with no flags", () => {
    expect(sigma0Scale(30, {})).toBe(1.0);
  });

  it("applies the S5 age multipliers at their documented bands", () => {
    // The pseudocode is an elif chain — <20, >=50, >=45, >=43, else baseline — so the
    // unscaled baseline (1.0) only covers ages 20-42; 43-44 already get the S14 1.25x.
    expect(sigma0Scale(19, {})).toBeCloseTo(1.45, 10); // <20
    expect(sigma0Scale(35, {})).toBeCloseTo(1.0, 10); // 20-42 baseline
    expect(sigma0Scale(42, {})).toBeCloseTo(1.0, 10); // still baseline, just under the change point
    expect(sigma0Scale(43, {})).toBeCloseTo(1.25, 10); // S14 change point, 43-44
    expect(sigma0Scale(44, {})).toBeCloseTo(1.25, 10);
    expect(sigma0Scale(45, {})).toBeCloseTo(1.45, 10); // 45-49
    expect(sigma0Scale(49, {})).toBeCloseTo(1.45, 10);
    expect(sigma0Scale(50, {})).toBeCloseTo(2.0, 10); // >=50
    expect(sigma0Scale(60, {})).toBeCloseTo(2.0, 10);
  });

  it("treats a missing age as no age scaling", () => {
    expect(sigma0Scale(null, {})).toBe(1.0);
    expect(sigma0Scale(undefined, {})).toBe(1.0);
  });

  it("applies the S16 gynaecological-age multiplier under 3 years", () => {
    expect(sigma0Scale(null, { gynAgeYears: 2 })).toBeCloseTo(1.6, 10);
    expect(sigma0Scale(null, { gynAgeYears: 3 })).toBeCloseTo(1.0, 10); // not < 3
  });

  it("applies the S19 post-hormonal-contraception multiplier under 4 cycles", () => {
    expect(sigma0Scale(null, { cyclesSinceStoppingHc: 3 })).toBeCloseTo(1.4, 10);
    expect(sigma0Scale(null, { cyclesSinceStoppingHc: 4 })).toBeCloseTo(1.0, 10); // not < 4
  });

  it("applies the UNVERIFIED postpartum multiplier under 4 cycles", () => {
    expect(sigma0Scale(null, { postpartumCycles: 1 })).toBeCloseTo(1.6, 10);
    expect(sigma0Scale(null, { postpartumCycles: 4 })).toBeCloseTo(1.0, 10); // not < 4
  });

  it("multiplies flags together rather than taking the max", () => {
    // A 19-year-old, 2 years post-menarche: 1.45 * 1.6
    expect(sigma0Scale(19, { gynAgeYears: 2 })).toBeCloseTo(1.45 * 1.6, 10);
  });
});

describe("02-symptom-insights.md §E.1 constants — transcribed verbatim", () => {
  it("windows match the source exactly", () => {
    expect(W_PREMENSTRUAL).toEqual(["backward", -7, -1]);
    expect(W_PREMENSTRUAL_ACOG).toEqual(["backward", -5, -1]);
    expect(W_MID_LUTEAL).toEqual(["backward", -11, -8]);
    expect(W_PERIOVULATORY).toEqual(["backward", -17, -12]);
    expect(W_MENSTRUAL).toEqual(["forward", 1, 4]);
    expect(W_FOLLICULAR_REF).toEqual(["forward", 4, 10]);
    expect(PRIMARY_WINDOW).toEqual(W_PREMENSTRUAL);
    expect(REFERENCE_WINDOW).toEqual(W_FOLLICULAR_REF);
  });

  it("cycle qualification constants match the source exactly", () => {
    expect(MIN_CYCLES_TO_SHOW_ANYTHING).toBe(3);
    expect(MIN_QUALIFYING_CYCLES_TO_CLAIM).toBe(5);
    expect(CYCLE_LEN_MIN).toBe(21);
    expect(CYCLE_LEN_MAX).toBe(45);
    expect(CYCLE_LEN_ANOMALY_DELTA).toBe(10);
    expect(MAX_CONSECUTIVE_UNLOGGED_DAYS).toBe(10);
  });

  it("coverage thresholds match the source exactly", () => {
    expect(COVERAGE_MIN_PRIMARY).toBeCloseTo(5 / 7, 12);
    expect(COVERAGE_MIN_REFERENCE).toBeCloseTo(4 / 7, 12);
    expect(COVERAGE_MIN_CYCLE).toBe(0.5);
    expect(COVERAGE_BALANCE_MAX).toBe(0.3);
  });

  it("symptom eligibility and effect-size floors match the source exactly", () => {
    expect(MIN_TOTAL_OCCURRENCES).toBe(3);
    expect(MIN_DISTINCT_CYCLES).toBe(2);
    expect(DEADBAND).toBe(0.2);
    expect(MIN_RATE_RATIO).toBe(2.0);
    expect(MIN_RATE_DIFF).toBe(0.2);
  });

  it("multiplicity constants match the source exactly", () => {
    expect(FDR_Q).toBe(0.1);
    expect(ALPHA_UNCORRECTED).toBe(0.05);
    expect(MAX_INSIGHTS_SHOWN).toBe(3);
  });
});

describe("testBudget — test-budget tiers by qualifying-cycle count", () => {
  it("matches the documented tiers exactly, including the boundaries", () => {
    expect(testBudget(0)).toBe(0);
    expect(testBudget(4)).toBe(0);
    expect(testBudget(5)).toBe(3);
    expect(testBudget(7)).toBe(3);
    expect(testBudget(8)).toBe(8);
    expect(testBudget(11)).toBe(8);
    expect(testBudget(12)).toBe(12);
    expect(testBudget(50)).toBe(12);
  });
});

describe("SYMPTOM_PANEL — default symptom panel (02-symptom-insights.md §E.2)", () => {
  it("matches the source list and order exactly", () => {
    expect(SYMPTOM_PANEL).toEqual([
      "cramps",
      "breast_tenderness",
      "bloating",
      "headache",
      "fatigue",
      "cravings",
      "gi_change",
      "acne",
      "irritability",
      "low_mood",
      "anxiety",
      "emotional_sensitivity",
    ]);
    expect(SYMPTOM_PANEL_TIER_C).toEqual([
      "sleep_change",
      "exercise_change",
      "focus_change",
      "libido_change",
    ]);
  });

  it("has no duplicate symptoms between the default panel and the tier-C opt-in set", () => {
    const overlap = SYMPTOM_PANEL.filter((s) =>
      (SYMPTOM_PANEL_TIER_C as readonly string[]).includes(s),
    );
    expect(overlap).toEqual([]);
  });
});

describe("03-additional-data-and-safety.md §6 — data-coverage guards", () => {
  it("matches the source table exactly", () => {
    expect(COVERAGE_GUARDS.CYC).toEqual({
      minCompleteCycles: 6,
      maxUnexplainedGapDays: 45,
      minExpectedBleedDayCoveragePct: 0.9,
    });
    expect(COVERAGE_GUARDS.CYC_DISAGREEMENT_ZONE).toEqual({
      minCyclesInZone: 4,
      ofCycles: 6,
    });
    expect(COVERAGE_GUARDS.DUR).toEqual({
      minCompleteBleedingEpisodesWithExplicitBoundaries: 3,
    });
    expect(COVERAGE_GUARDS.HMB_01_02_03).toEqual({
      minPerDayProductOrFlowLoggingCoveragePct: 0.8,
    });
    expect(COVERAGE_GUARDS.HMB_04).toEqual({ minQualifyingEpisodes: 3 });
    expect(COVERAGE_GUARDS.HMB_05).toEqual({ minQualifyingEpisodes: 5 });
    expect(COVERAGE_GUARDS.IMB_PCB).toEqual({ requiresExplicitBleedingTypeField: true });
    expect(COVERAGE_GUARDS.AMEN_01).toEqual({
      minPriorPeriodStartsRecorded: 1,
      minAppInstalledDays: 90,
    });
    expect(COVERAGE_GUARDS.PMB_01).toEqual({
      requiresAgeOrMenopauseFlagSet: true,
      minPriorBleedDates: 1,
    });
    expect(COVERAGE_GUARDS.PERI_01).toEqual({ minCycles: 6 });
  });
});

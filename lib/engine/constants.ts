/**
 * Constants transcribed VERBATIM from the research docs (SPEC.md R4: every magic number
 * carries a comment naming its source — S1..S22 from the research docs, or `[choice]`
 * for an engineering choice made by the research author). Do not round, reinterpret, or
 * "improve" a cited value — if a value looks wrong, leave it and flag it in the report.
 *
 * Sources:
 *   - docs/research/01-cycle-prediction.md, "RECOMMENDED ALGORITHM FOR THIS APP" §"Constants"
 *   - docs/research/02-symptom-insights.md §E.1 (Constants) and §E.2 (default symptom panel)
 *   - docs/research/03-additional-data-and-safety.md §6 (Data-coverage guards)
 *
 * This file contains ONLY the constants and the two small pure helper functions
 * (`sigma0Scale`, `testBudget`) that the research pseudocode defines inline alongside
 * them. All other logic belongs to the engine files that consume these constants
 * (lib/engine/{cycles,prediction,fertility,insights,health,stats}.ts).
 */

// ============================================================================
// 01-cycle-prediction.md — "RECOMMENDED ALGORITHM FOR THIS APP" → ### Constants
// ============================================================================

/** Population prior mean cycle length (days) by age band [lo, hi) in years.
 * S6 (Flo, 19M users), cross-checked S1/S5. */
export const MU0_BY_AGE: ReadonlyArray<{ loInclusive: number; hiExclusive: number; mu0: number }> = [
  { loInclusive: 0, hiExclusive: 26, mu0: 28.5 },
  { loInclusive: 26, hiExclusive: 31, mu0: 28.3 },
  { loInclusive: 31, hiExclusive: 36, mu0: 28.0 },
  { loInclusive: 36, hiExclusive: 41, mu0: 27.7 },
  { loInclusive: 41, hiExclusive: 46, mu0: 27.4 },
  { loInclusive: 46, hiExclusive: 51, mu0: 27.2 },
  { loInclusive: 51, hiExclusive: 200, mu0: 28.0 },
];

/** Default population prior mean cycle length (days) when age is unknown.
 * S1 mean 29.3; S2 29.45; S5 28.7; S6 28.5 -> 29.0 */
export const MU0_DEFAULT = 29.0;

/** Between-person SD (days) of an individual's mean cycle length; derived from S5. */
export const TAU0 = 4.5;

/** Prior within-person SD (days). S5: 3.79 @35-39, S6: 3.72-4.14, S1: 2.6 */
export const SIGMA0 = 3.5;

/** Prior pseudo-observations. [choice] */
export const NU0 = 3;

/**
 * Age/life-stage scaling of SIGMA0 (from S5: +46% <20, +45% 45-49, +200% >50).
 * `flags.gynAgeYears < 3` -> S16; `flags.cyclesSinceStoppingHc < 4` -> S19;
 * `flags.postpartumCycles < 4` -> UNVERIFIED (research §7.5: no peer-reviewed number
 * could be retrieved; the multiplier is carried through as-is per the research doc,
 * flagged UNVERIFIED there and here).
 */
export interface Sigma0ScaleFlags {
  gynAgeYears?: number | null;
  cyclesSinceStoppingHc?: number | null;
  postpartumCycles?: number | null;
}

export function sigma0Scale(age: number | null | undefined, flags: Sigma0ScaleFlags): number {
  let s = 1.0;
  if (age !== null && age !== undefined) {
    if (age < 20) s *= 1.45;
    else if (age >= 50) s *= 2.0;
    else if (age >= 45) s *= 1.45;
    else if (age >= 43) s *= 1.25; // S14: variability change point 42.84 y
  }
  if (flags.gynAgeYears !== null && flags.gynAgeYears !== undefined && flags.gynAgeYears < 3) {
    s *= 1.6; // S16
  }
  if (
    flags.cyclesSinceStoppingHc !== null &&
    flags.cyclesSinceStoppingHc !== undefined &&
    flags.cyclesSinceStoppingHc < 4
  ) {
    s *= 1.4; // S19
  }
  if (
    flags.postpartumCycles !== null &&
    flags.postpartumCycles !== undefined &&
    flags.postpartumCycles < 4
  ) {
    s *= 1.6; // UNVERIFIED — see 01-cycle-prediction.md §7.5
  }
  return s;
}

/** Number of cycles in the estimation window; matches FIGO's 12-month window (S7) and S6. */
export const WINDOW = 12;

/** Recency decay, half-life ~6.6 cycles. [choice] — kept gentle because S2 found cycle
 * stats are stationary. */
export const RHO = 0.9;

/** Days; never claim a prediction interval tighter than this. [choice] */
export const SIGMA_FLOOR = 2.0;

/** S5, S6: cycles <10 d excluded. */
export const MIN_CYCLE = 10;

/** S5, S15: cycles >90 d excluded, never split. */
export const MAX_CYCLE = 90;

/** Never split a gap under 45 d (FIGO upper normal 38 d, S7). */
export const NO_SPLIT_BELOW = 45;

/** Implied split cycle must be >=19 d. [choice] */
export const MIN_IMPLIED = 19;

/** ... and <=45 d. [choice] */
export const MAX_IMPLIED = 45;

/** k=1 must fit badly. [choice] */
export const Z1_MIN = 3.0;

/** Some k>=2 must fit well. [choice] */
export const ZK_MAX = 1.5;

/** 80% central interval. [choice, justified in 01-cycle-prediction.md §4.1] */
export const TARGET_COVERAGE = 0.8;

/** S1 (12.4) + S4 (12-13) */
export const LUTEAL_MEAN = 12.5;

/** S1 */
export const LUTEAL_SD = 2.4;

// ============================================================================
// 02-symptom-insights.md §E.1 — Constants
// ============================================================================

/** A cycle-day window: ["backward" | "forward", startOffset, endOffset] (inclusive),
 * mirroring the research pseudocode's tuple literals exactly. Backward windows are
 * anchored on the NEXT period start; forward windows on THIS period start. Rule: if a
 * day is claimable by both a forward and a backward window, the BACKWARD assignment
 * wins (Schmalenberger et al. 2021). */
export type CycleDayWindow = readonly ["backward" | "forward", number, number];

/** DSM-5 / C-PASS / DRSP luteal window. */
export const W_PREMENSTRUAL: CycleDayWindow = ["backward", -7, -1];
/** ACOG 5-day window (secondary). */
export const W_PREMENSTRUAL_ACOG: CycleDayWindow = ["backward", -5, -1];
/** optional */
export const W_MID_LUTEAL: CycleDayWindow = ["backward", -11, -8];
/** optional, OFF by default */
export const W_PERIOVULATORY: CycleDayWindow = ["backward", -17, -12];
export const W_MENSTRUAL: CycleDayWindow = ["forward", 1, 4];
/** C-PASS postmenstrual week; exclude days with logged bleeding. */
export const W_FOLLICULAR_REF: CycleDayWindow = ["forward", 4, 10];

export const PRIMARY_WINDOW: CycleDayWindow = W_PREMENSTRUAL;
export const REFERENCE_WINDOW: CycleDayWindow = W_FOLLICULAR_REF;

/** Cycle qualification. Li et al. 2020/2022 floor: >2 cycles. */
export const MIN_CYCLES_TO_SHOW_ANYTHING = 3;
/** arithmetic: 5/5 is the first p < 0.05 (see lib/stat's binomSf tests). */
export const MIN_QUALIFYING_CYCLES_TO_CLAIM = 5;
export const CYCLE_LEN_MIN = 21;
export const CYCLE_LEN_MAX = 45;
/** Li et al. 2020: > user median + 10 d */
export const CYCLE_LEN_ANOMALY_DELTA = 10;
export const MAX_CONSECUTIVE_UNLOGGED_DAYS = 10;

/** >= 5 of 7 premenstrual days logged */
export const COVERAGE_MIN_PRIMARY = 5 / 7;
/** >= 4 of 7 reference days logged */
export const COVERAGE_MIN_REFERENCE = 4 / 7;
export const COVERAGE_MIN_CYCLE = 0.5;
/** |cov(W) - cov(R)| <= 0.30 */
export const COVERAGE_BALANCE_MAX = 0.3;

/** Symptom eligibility (outcome-INDEPENDENT pre-filter). */
export const MIN_TOTAL_OCCURRENCES = 3;
export const MIN_DISTINCT_CYCLES = 2;

/** Effect size floors (analogue of C-PASS's >= 30% percent change). */
export const DEADBAND = 0.2;
export const MIN_RATE_RATIO = 2.0;
export const MIN_RATE_DIFF = 0.2;

/** Multiplicity. */
export const FDR_Q = 0.1;

/** m = tests run, sized to the amount of data actually available — fixed by cycle
 * count BEFORE any test is evaluated (INV-6). */
export function testBudget(nQualifyingCycles: number): number {
  if (nQualifyingCycles >= 12) return 12;
  if (nQualifyingCycles >= 8) return 8;
  if (nQualifyingCycles >= 5) return 3;
  return 0;
}

export const ALPHA_UNCORRECTED = 0.05;
export const MAX_INSIGHTS_SHOWN = 3;

// ============================================================================
// 02-symptom-insights.md §E.2 — Default symptom panel
// ============================================================================

/**
 * Ordered — the test budget takes the first k. TIER A: default ON, best signal-to-noise,
 * physiologically anchored to the bleed. TIER B: direction discovered, never assumed.
 * TIER C (sleep, exercise, focus, libido, weight, temp, HR) is opt-in
 * (settings.tierCSymptomsEnabled) and excluded from this default panel because weekday
 * rhythm dominates those dimensions (Pierson et al. 2021). TIER D (ovulation pain, any
 * "hormone" framing) is never an insight target.
 */
export const SYMPTOM_PANEL = [
  // TIER A
  "cramps",
  "breast_tenderness",
  "bloating",
  "headache",
  "fatigue",
  "cravings",
  "gi_change",
  "acne",
  // TIER B
  "irritability",
  "low_mood",
  "anxiety",
  "emotional_sensitivity",
] as const;

/** Tier C symptoms: opt-in only, per SYMPTOM_PANEL's comment above. */
export const SYMPTOM_PANEL_TIER_C = [
  "sleep_change",
  "exercise_change",
  "focus_change",
  "libido_change",
] as const;

// ============================================================================
// 03-additional-data-and-safety.md §6 — Data-coverage guards
// ============================================================================

/**
 * "No guideline specifies these; they are engineering requirements that follow from the
 * statistics in §1.1." [choice, 03-additional-data-and-safety.md §6] Minimum data
 * required before a health-awareness rule family may fire at all — a gate on top of
 * (never a substitute for) each rule's own threshold (owned by agent D in
 * lib/engine/health.ts).
 */
export const COVERAGE_GUARDS = {
  /** CYC-01/02/03 (cycle length & regularity) */
  CYC: {
    minCompleteCycles: 6,
    maxUnexplainedGapDays: 45,
    minExpectedBleedDayCoveragePct: 0.9,
  },
  /** CYC-01i/02i (disagreement zone): same minimums as CYC, plus: */
  CYC_DISAGREEMENT_ZONE: {
    minCyclesInZone: 4,
    ofCycles: 6,
  },
  /** DUR-* */
  DUR: {
    minCompleteBleedingEpisodesWithExplicitBoundaries: 3,
  },
  /** HMB-01/02/03 */
  HMB_01_02_03: {
    minPerDayProductOrFlowLoggingCoveragePct: 0.8,
  },
  /** HMB-04 */
  HMB_04: { minQualifyingEpisodes: 3 },
  /** HMB-05 */
  HMB_05: { minQualifyingEpisodes: 5 },
  /** IMB-01 / PCB-01 */
  IMB_PCB: { requiresExplicitBleedingTypeField: true },
  /** AMEN-01 */
  AMEN_01: {
    minPriorPeriodStartsRecorded: 1,
    minAppInstalledDays: 90, // OR user supplied a prior LMP
  },
  /** PMB-01 */
  PMB_01: {
    requiresAgeOrMenopauseFlagSet: true,
    minPriorBleedDates: 1,
  },
  /** PERI-01 */
  PERI_01: {
    minCycles: 6, // OR explicit self-declaration
  },
} as const;

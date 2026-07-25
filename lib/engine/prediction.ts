/**
 * Next-period prediction — the normal–normal conjugate predictive interval from
 * `docs/research/01-cycle-prediction.md` §3, §4 and §7, and pipeline STEPS 3–4.
 *
 * Per SPEC.md R3 this module is pure: no I/O, no `Date.now()`, no randomness, no
 * environment access. "Today" arrives as an explicit `CivilDate` parameter. Per R1 every
 * date is a `CivilDate` string; the only date arithmetic used here is `addDays`/`compare`
 * from `lib/date/civil.ts`.
 *
 * Per SPEC.md R8 nothing here returns a bare date. `PredictionResult` always carries
 * `{ center, low, high, confidence, basis }`, and `confidence` is always one of the four
 * SPEC.md §4.3 values with a `confidenceReason` that names the user's real numbers.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT DO
 * - It does not derive cycles from day logs (agent A, `lib/engine/cycles.ts`). It consumes
 *   `Cycle[]` and uses only cycles whose status is `ok`.
 * - It does not winsorise. §3.2 of the research describes the estimator as
 *   "skip-corrected, mildly recency-weighted, outlier-winsorised", but the implementable
 *   pipeline (STEP 2/STEP 3) achieves outlier control by *excluding* skip-suspected and
 *   out-of-bounds gaps upstream and never winsorises the surviving lengths. The pipeline
 *   is followed literally; see the agent report.
 */

import { addDays, compare, type CivilDate } from "@/lib/date/civil";
import { median, tQuantile } from "@/lib/stat";
import {
  MU0_BY_AGE,
  MU0_DEFAULT,
  TAU0,
  SIGMA0,
  NU0,
  WINDOW,
  RHO,
  SIGMA_FLOOR,
  MIN_CYCLE,
  MAX_CYCLE,
  TARGET_COVERAGE,
  sigma0Scale,
  type Sigma0ScaleFlags,
} from "@/lib/engine/constants";
import { CONFIDENCE_REASONS, PREDICTION_SUPPRESSED_MESSAGES } from "@/lib/copy/general";
import type {
  CalibrationState,
  Cycle,
  PredictionResult,
  Profile,
} from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Local constants
// ---------------------------------------------------------------------------

/**
 * Total (between + within person) SD of cycle length, AWHS (S5, 165,668 cycles). Used
 * ONLY for the N = 0 "population estimate" band of §4.3: `mu0 ± 1.28 x 6.1`. It is not a
 * personal statistic and must never be used once the user has a completed cycle.
 *
 * NOTE FOR AGENT F: this value belongs in `lib/engine/constants.ts` alongside the other
 * S5-sourced numbers. It lives here only because that file is owned by another agent.
 */
export const POPULATION_TOTAL_SD = 6.1;

/**
 * One-sided quantile for the target central interval. `TARGET_COVERAGE = 0.80` gives the
 * 90th percentile. Computed rather than written as a literal so no hard-coded cycle-shaped
 * number (SPEC.md R5) appears in this file; at df = 1e6 the Student-t quantile equals the
 * standard normal quantile to more decimal places than we need (1.2816), which is the
 * "1.28" the research writes in §4.3 and STEP 5.
 */
const UPPER_TAIL_P = 1 - (1 - TARGET_COVERAGE) / 2;
export const NORMAL_UPPER_QUANTILE = tQuantile(UPPER_TAIL_P, 1e6);

/**
 * Median cycle-length-difference at or below which the app is willing to say
 * "More consistent". This is the research's own "very consistent" band (§6.4: median CLD
 * <= 3 days -> "very consistent"; 4-8 -> "typical variation"; >= 9 -> "high variation").
 * [choice] SPEC.md §4.3 offers only two personal confidence values, so the boundary has to
 * fall somewhere inside those three bands; putting it at the top of "very consistent"
 * means "typical variation" users are shown *Limited*, which under-claims rather than
 * over-claims. Deliberate, per the product tone rule.
 */
export const MORE_CONSISTENT_MEDIAN_CLD_MAX = 3;

/** Below this many usable cycles the app shows a range but calls it "still learning"
 * (SPEC.md §4.3: *Not enough information* is N < 3). */
export const MIN_CYCLES_FOR_VARIABILITY_VERDICT = 3;

/** Full display, including a variability-derived confidence verdict (§4.3 "Edge cases by
 * N": the 6-11 row is the first one that enables the regularity band). */
export const MIN_CYCLES_FOR_FULL_DISPLAY = 6;

/** §7.5: "if the user flags postpartum, suppress predictions until 3 completed cycles are
 * logged". */
export const POSTPARTUM_MIN_CYCLES_TO_PREDICT = 3;

/** §5.3 point 5 treats "the first 6 cycles post-partum" as a known-variable context.
 * [choice] the same count is used here to hold the confidence at *Limited*. */
export const POSTPARTUM_CYCLES_LIMITED = 6;

/** §7.4: "do not compute a variability verdict until 6 post-HC cycles exist". */
export const POST_HC_CYCLES_LIMITED = 6;

/**
 * NOTE FOR AGENT F: this reason string belongs in `lib/copy/general.ts` next to
 * `CONFIDENCE_REASONS` (SPEC.md R9). `CONFIDENCE_REASONS.earlyEstimate` covers only the
 * case where the user gave a typical length at setup; §4.3's N = 0 row also requires the
 * no-reported-length case, labelled "based on population averages, not your data". It is
 * defined here so the engine can populate `confidenceReason` unconditionally, and it is
 * written to pass the SPEC.md §4.4 banned-word lint unchanged.
 */
export function populationEstimateReason(assumedLengthDays: number): string {
  return `This range is based on population averages, not your data — you don't have a completed cycle recorded yet. It assumes a typical length of ${assumedLengthDays} days.`;
}

// ---------------------------------------------------------------------------
// The conjugate predictive distribution (§4.2, STEP 3-4)
// ---------------------------------------------------------------------------

export interface PredictiveOptions {
  /** Recency decay. Defaults to `RHO` (0.90). Pass 1 to reproduce §4.2's worked table,
   * which was computed with no decay so that `n_eff = n`. */
  rho?: number;
  /** Location prior mean (days). Defaults to `MU0_DEFAULT`. */
  mu0?: number;
  /** Between-person SD of an individual's mean cycle length. Defaults to `TAU0`. */
  tau0?: number;
  /** Prior within-person SD, already life-stage scaled. Defaults to `SIGMA0`. */
  sigma0?: number;
  /** Prior pseudo-observations. Defaults to `NU0`. */
  nu0?: number;
  /**
   * Floor on the posterior within-person SD. Defaults to `SIGMA_FLOOR` (2.0 days).
   * Pass 0 to reproduce §4.2's worked table exactly: that table demonstrates the raw
   * conjugate formula of §4.2, and the floor is introduced later, in §4.3/STEP 3.
   */
  sigmaFloor?: number;
  /**
   * Per-observation multiplicative weights, aligned with `lengths` (most recent first).
   * Used for the research's `w x 0.5` down-weighting of user-confirmed inferred splits
   * (§5.3 point 4). Defaults to all 1.
   */
  weights?: readonly number[];
}

export interface PredictiveDistribution {
  /** Number of observations used. */
  n: number;
  /** Kish effective sample size `(sum w)^2 / sum w^2`. */
  nEff: number;
  /** Weighted mean cycle length. */
  weightedMeanLength: number;
  /** Weighted sum of squares, rescaled to `nEff`. */
  ss: number;
  /** Posterior within-person SD before `sigmaFloor` is applied. */
  sigmaRaw: number;
  /** Posterior within-person SD after `sigmaFloor`. */
  sigma: number;
  /** The location prior actually used. */
  mu0: number;
  /** Posterior mean cycle length. */
  muPost: number;
  /** Posterior SD of the mean. */
  tauPost: number;
  /** Predictive spread `sqrt(tauPost^2 + sigma^2)`. */
  sPred: number;
  /** Degrees of freedom `nu0 + nEff - 1`. */
  df: number;
  /** `t_{0.90, df}` for an 80% central interval. */
  tCritical: number;
  /** `tCritical * sPred` — the half-width BEFORE the calibration factor is applied. */
  halfWidthRaw: number;
}

/**
 * §4.2 verbatim. `lengths` is most-recent-first; `weights[i] = rho^i * (options.weights[i]
 * ?? 1)`.
 *
 * ```
 * n_eff = (sum w)^2 / sum w^2                       # Kish effective sample size
 * m     = sum w_i L_i / sum w_i                     # weighted mean
 * SS    = sum w_i (L_i - m)^2 / (sum w_i / n_eff)   # weighted SS rescaled to n_eff
 * sigma^2 = (nu0 sigma0^2 + SS) / (nu0 + n_eff - 1)
 * prec  = 1/tau0^2 + n_eff/sigma^2
 * mu_post = (mu0/tau0^2 + n_eff m/sigma^2) / prec
 * tau_post = sqrt(1/prec)
 * s_pred = sqrt(tau_post^2 + sigma^2)
 * df     = nu0 + n_eff - 1
 * half   = t_{0.90, df} * s_pred
 * ```
 */
export function conjugatePredictive(
  lengths: readonly number[],
  options: PredictiveOptions = {},
): PredictiveDistribution {
  if (lengths.length === 0) {
    throw new Error("conjugatePredictive() requires at least one cycle length");
  }
  const rho = options.rho ?? RHO;
  const mu0 = options.mu0 ?? MU0_DEFAULT;
  const tau0 = options.tau0 ?? TAU0;
  const sigma0 = options.sigma0 ?? SIGMA0;
  const nu0 = options.nu0 ?? NU0;
  const sigmaFloor = options.sigmaFloor ?? SIGMA_FLOOR;

  const n = lengths.length;
  const w = lengths.map((_, i) => Math.pow(rho, i) * (options.weights?.[i] ?? 1));

  let w1 = 0;
  let w2 = 0;
  for (const wi of w) {
    w1 += wi;
    w2 += wi * wi;
  }
  if (w1 <= 0 || w2 <= 0) {
    throw new Error("conjugatePredictive() requires a nonzero total weight");
  }
  const nEff = (w1 * w1) / w2;

  let weightedSum = 0;
  for (let i = 0; i < n; i++) weightedSum += w[i] * lengths[i];
  const m = weightedSum / w1;

  let weightedSqDev = 0;
  for (let i = 0; i < n; i++) weightedSqDev += w[i] * (lengths[i] - m) ** 2;
  // sum w_i (L_i - m)^2 / (sum w_i / n_eff)  ==  (weighted mean square) * n_eff
  const ss = (weightedSqDev / w1) * nEff;

  const sigma2 = (nu0 * sigma0 * sigma0 + ss) / (nu0 + nEff - 1);
  const sigmaRaw = Math.sqrt(sigma2);
  const sigma = Math.max(sigmaRaw, sigmaFloor);

  const precision = 1 / (tau0 * tau0) + nEff / (sigma * sigma);
  const muPost = (mu0 / (tau0 * tau0) + (nEff * m) / (sigma * sigma)) / precision;
  const tauPost = Math.sqrt(1 / precision);

  const sPred = Math.sqrt(tauPost * tauPost + sigma * sigma);
  const df = nu0 + nEff - 1;
  const tCritical = tQuantile(UPPER_TAIL_P, df);

  return {
    n,
    nEff,
    weightedMeanLength: m,
    ss,
    sigmaRaw,
    sigma,
    mu0,
    muPost,
    tauPost,
    sPred,
    df,
    tCritical,
    halfWidthRaw: tCritical * sPred,
  };
}

// ---------------------------------------------------------------------------
// Life-stage context (§7)
// ---------------------------------------------------------------------------

export interface LifeStageContext {
  /** Chronological age in whole years, or null when `birthYear` is unset. */
  age: number | null;
  /** Years since menarche, or null when `menarcheYear` is unset. */
  gynAgeYears: number | null;
  /** Usable cycles that started after `stoppedHormonalOn`, or null when not applicable. */
  cyclesSinceStoppingHc: number | null;
  /** Usable cycles that started after `deliveryDate`, or null when not applicable. */
  postpartumCycles: number | null;
  pregnant: boolean;
  /** A hormonal method is currently in use (a suppression key, not a predictor —
   * 03-additional-data-and-safety.md §1.7). */
  onHormonalMethod: boolean;
}

function yearOf(date: CivilDate): number {
  // CivilDate is a fixed-width "YYYY-MM-DD" string (R1) — reading the year is a string
  // slice, never a Date construction.
  return Number(date.slice(0, 4));
}

export function lifeStageContext(
  profile: Profile,
  today: CivilDate,
  usableCycles: readonly Cycle[],
): LifeStageContext {
  const currentYear = yearOf(today);
  const age = profile.birthYear === undefined ? null : currentYear - profile.birthYear;
  const gynAgeYears =
    profile.menarcheYear === undefined ? null : currentYear - profile.menarcheYear;

  const countAfter = (boundary: CivilDate | undefined): number | null =>
    boundary === undefined
      ? null
      : usableCycles.filter((c) => compare(c.startDate, boundary) > 0).length;

  return {
    age,
    gynAgeYears,
    cyclesSinceStoppingHc: countAfter(profile.state.stoppedHormonalOn),
    postpartumCycles: countAfter(profile.state.deliveryDate),
    pregnant: profile.state.pregnant,
    onHormonalMethod: profile.state.hormonalMethod !== undefined,
  };
}

/** §3.2's `mu0` table, with `MU0_DEFAULT` when age is unknown. */
export function mu0ForAge(age: number | null): number {
  if (age === null) return MU0_DEFAULT;
  const band = MU0_BY_AGE.find((b) => age >= b.loInclusive && age < b.hiExclusive);
  return band === undefined ? MU0_DEFAULT : band.mu0;
}

// ---------------------------------------------------------------------------
// The prediction itself
// ---------------------------------------------------------------------------

export interface PredictionInput {
  /** Every derived cycle. Only `status === 'ok'` cycles with a length inside
   * [MIN_CYCLE, MAX_CYCLE] enter the estimator (STEP 2). */
  cycles: readonly Cycle[];
  profile: Profile;
  today: CivilDate;
  calibration: CalibrationState;
  /** The most recent period start. Derived from `cycles` when omitted. */
  lastPeriodStart?: CivilDate | null;
  /** Test seam only. Defaults to the cited constants. */
  options?: PredictiveOptions;
}

function emptyBasis(
  usableCycles: number,
  calibrationFactor: number,
): PredictionResult["basis"] {
  return {
    usableCycles,
    windowCycles: 0,
    effectiveN: 0,
    sigma: 0,
    halfWidthDays: 0,
    calibrationFactor,
  };
}

/** The cycles the estimator is allowed to use, most recent first. */
export function usableCycleLengths(cycles: readonly Cycle[]): Cycle[] {
  return cycles
    .filter(
      (c) =>
        c.status === "ok" &&
        c.lengthDays !== null &&
        c.lengthDays >= MIN_CYCLE &&
        c.lengthDays <= MAX_CYCLE,
    )
    .slice()
    .sort((a, b) => compare(b.startDate, a.startDate));
}

function deriveLastPeriodStart(cycles: readonly Cycle[]): CivilDate | null {
  let latest: CivilDate | null = null;
  for (const c of cycles) {
    if (latest === null || compare(c.startDate, latest) > 0) latest = c.startDate;
  }
  return latest;
}

function clampCalibration(state: CalibrationState): number {
  const f = state.cumulativeAdjustment;
  if (!Number.isFinite(f) || f <= 0) return 1;
  return f;
}

export function predictNextPeriod(input: PredictionInput): PredictionResult {
  const { cycles, profile, today, calibration } = input;
  const calibrationFactor = clampCalibration(calibration);

  const usable = usableCycleLengths(cycles);
  const context = lifeStageContext(profile, today, usable);
  const lastStart =
    input.lastPeriodStart !== undefined
      ? input.lastPeriodStart
      : deriveLastPeriodStart(cycles);

  // --- §7 suppression, in priority order ------------------------------------
  const suppress = (
    reason: NonNullable<PredictionResult["suppressed"]>["reason"],
  ): PredictionResult => ({
    kind: "none",
    center: null,
    low: null,
    high: null,
    predictedLengthDays: null,
    confidence: "not_enough_information",
    confidenceReason: PREDICTION_SUPPRESSED_MESSAGES[reason],
    basis: emptyBasis(usable.length, calibrationFactor),
    suppressed: { reason },
  });

  if (context.pregnant) return suppress("pregnant");
  if (context.onHormonalMethod) return suppress("hormonal_method");
  if (
    context.postpartumCycles !== null &&
    context.postpartumCycles < POSTPARTUM_MIN_CYCLES_TO_PREDICT
  ) {
    return suppress("postpartum");
  }

  // --- N = 0 (§4.3) ---------------------------------------------------------
  if (usable.length === 0) {
    if (lastStart === null) return suppress("insufficient_data");

    // "you may show a purely population-based band: mu0 +- 1.28 x 6.1" — labelled
    // explicitly as not being based on the user's data.
    const reported = profile.reportedTypicalCycleLength;
    const assumedLength = reported ?? mu0ForAge(context.age);
    const half = NORMAL_UPPER_QUANTILE * POPULATION_TOTAL_SD * calibrationFactor;
    const centerOffset = Math.round(assumedLength);
    return {
      kind: "population_estimate",
      center: addDays(lastStart, centerOffset),
      low: addDays(lastStart, Math.round(assumedLength - half)),
      high: addDays(lastStart, Math.round(assumedLength + half)),
      predictedLengthDays: centerOffset,
      confidence: "early_estimate",
      confidenceReason:
        reported === undefined
          ? populationEstimateReason(centerOffset)
          : CONFIDENCE_REASONS.earlyEstimate(reported),
      basis: {
        usableCycles: 0,
        windowCycles: 0,
        effectiveN: 0,
        sigma: POPULATION_TOTAL_SD,
        halfWidthDays: half,
        calibrationFactor,
      },
    };
  }

  // --- N >= 1: the conjugate predictive interval (STEP 3-4) -----------------
  const windowCycles = usable.slice(0, WINDOW);
  const lengths = windowCycles.map((c) => c.lengthDays as number);
  const cycleWeights = windowCycles.map((c) =>
    Number.isFinite(c.weight) && c.weight > 0 ? c.weight : 1,
  );

  const flags: Sigma0ScaleFlags = {
    gynAgeYears: context.gynAgeYears,
    cyclesSinceStoppingHc: context.cyclesSinceStoppingHc,
    postpartumCycles: context.postpartumCycles,
  };
  const sigma0 = SIGMA0 * sigma0Scale(context.age, flags);

  const dist = conjugatePredictive(lengths, {
    mu0: mu0ForAge(context.age),
    sigma0,
    weights: cycleWeights,
    ...input.options,
  });

  const half = dist.halfWidthRaw * calibrationFactor;
  const centerOffset = Math.round(dist.muPost);

  // `lastStart` cannot be null here: a usable cycle implies a recorded start.
  const anchor = lastStart as CivilDate;

  const { confidence, confidenceReason } = describeConfidence(
    lengths,
    windowCycles.length,
    context,
  );

  return {
    kind: "personal",
    center: addDays(anchor, centerOffset),
    low: addDays(anchor, Math.round(dist.muPost - half)),
    high: addDays(anchor, Math.round(dist.muPost + half)),
    predictedLengthDays: centerOffset,
    confidence,
    confidenceReason,
    basis: {
      usableCycles: usable.length,
      windowCycles: windowCycles.length,
      effectiveN: dist.nEff,
      sigma: dist.sigma,
      halfWidthDays: half,
      calibrationFactor,
    },
  };
}

/**
 * SPEC.md §4.3's four-value vocabulary. Never a percentage; the reason always names the
 * user's own numbers.
 *
 * - N < 3            -> *Not enough information* ("still learning"; a range is still shown,
 *                       per §4.3's N = 1 and N = 2 rows).
 * - 3 <= N < 6       -> *Limited*. The variability verdict is suppressed below 6 cycles
 *                       ("Edge cases by N": the regularity band starts at 6), so the app
 *                       does not upgrade to *More consistent* on 3-5 lucky cycles.
 * - N >= 6           -> *More consistent* when median CLD <= 3 (§6.4's "very consistent"
 *                       band), otherwise *Limited*.
 * - Postpartum / post-hormonal-contraception hold the verdict at *Limited* (§7.4, §7.5).
 */
function describeConfidence(
  lengths: readonly number[],
  windowCycles: number,
  context: LifeStageContext,
): { confidence: PredictionResult["confidence"]; confidenceReason: string } {
  if (windowCycles < MIN_CYCLES_FOR_VARIABILITY_VERDICT) {
    return {
      confidence: "not_enough_information",
      confidenceReason: CONFIDENCE_REASONS.notEnoughInformation(windowCycles),
    };
  }

  const shortest = Math.min(...lengths);
  const longest = Math.max(...lengths);
  const medianCld = medianCycleLengthDifference(lengths);

  const inTransition =
    (context.postpartumCycles !== null &&
      context.postpartumCycles < POSTPARTUM_CYCLES_LIMITED) ||
    (context.cyclesSinceStoppingHc !== null &&
      context.cyclesSinceStoppingHc < POST_HC_CYCLES_LIMITED);

  const eligibleForVerdict = windowCycles >= MIN_CYCLES_FOR_FULL_DISPLAY && !inTransition;

  if (
    eligibleForVerdict &&
    medianCld !== null &&
    medianCld <= MORE_CONSISTENT_MEDIAN_CLD_MAX
  ) {
    return {
      confidence: "more_consistent",
      confidenceReason: CONFIDENCE_REASONS.moreConsistent(
        windowCycles,
        Math.round(medianCld),
      ),
    };
  }

  return {
    confidence: "limited",
    confidenceReason: CONFIDENCE_REASONS.limited(windowCycles, shortest, longest),
  };
}

/** Median of `|L_i - L_{i+1}|` over consecutive cycles (S2, S18). Null below 2 cycles. */
export function medianCycleLengthDifference(lengths: readonly number[]): number | null {
  if (lengths.length < 2) return null;
  const diffs: number[] = [];
  for (let i = 0; i + 1 < lengths.length; i++) {
    diffs.push(Math.abs(lengths[i] - lengths[i + 1]));
  }
  return median(diffs);
}

/**
 * The predictive spread `s_pred` behind a `PredictionResult`, including the calibration
 * factor that was applied to its half-width. `lib/engine/fertility.ts` convolves this with
 * `LUTEAL_SD` (STEP 5) — exposed as a function so the fixed `PredictionResult` contract in
 * SPEC.md §3 does not have to grow a field.
 *
 * Returns null when there is no interval to speak of (suppressed / no data).
 */
export function predictiveSpreadDays(result: PredictionResult): number | null {
  if (result.center === null || result.basis.halfWidthDays <= 0) return null;
  if (result.kind === "population_estimate") {
    return result.basis.halfWidthDays / NORMAL_UPPER_QUANTILE;
  }
  const df = NU0 + result.basis.effectiveN - 1;
  return result.basis.halfWidthDays / tQuantile(UPPER_TAIL_P, df);
}

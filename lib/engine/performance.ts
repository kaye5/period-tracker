/**
 * Prediction performance and on-device self-calibration —
 * `docs/research/01-cycle-prediction.md` §8 and §4.4, pipeline STEPS 7-8. Pure per
 * SPEC.md R3; civil dates only per R1.
 *
 * WHAT THIS FILE DELIBERATELY DOES NOT PRODUCE
 * There is no single "accuracy" number anywhere in this module, by design. §8.2: S13 found
 * that across 10 apps ovulation predictions were 2-9 days early in 67% of cases and exactly
 * correct in only 8%, "yet those apps present themselves as accurate". A single headline
 * percentage is the specific thing dishonest apps ship. What is exposed instead is the
 * three-part display §8.2 recommends:
 *
 *   1. `lastSignedErrorDays`            — signed, not absolute: it is the intuitive form and
 *                                         it lets the user see systematic bias (ME, S11).
 *   2. `rollingMedianAbsoluteErrorDays` — robust headline over the last 6-12 resolved
 *                                         predictions (S3, S11). MAE is computed too, but
 *                                         internally: §8.1 notes S3's median-1.5 d /
 *                                         RMSE-6.15 d gap for the *same* users, so a
 *                                         squared metric shown alone would hide outliers
 *                                         and a robust one shown alone would hide blowups.
 *   3. `windowHitRate`                  — empirical coverage, reported as "hits of n", the
 *                                         only number that validates the interval (§4.4).
 *
 * RMSE and PAE3 are tracked in `internal` for the calibration loop and for debugging, and
 * are explicitly not part of the display contract.
 */

import { compare, diffDays, type CivilDate } from "@/lib/date/civil";
import { median, quantile, tQuantile } from "@/lib/stat";
import { TARGET_COVERAGE } from "@/lib/engine/constants";
import type { CalibrationState, StatSummary } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** §8.2: "Rolling typical miss over the last 6-12 predictions". */
export const ROLLING_WINDOW_MIN = 6;
export const ROLLING_WINDOW_MAX = 12;

/** S11's operational threshold — "proportion of absolute errors <= 3 days" (PAE3).
 * Internal only. */
export const PAE_THRESHOLD_DAYS = 3;

/** §4.4: "Over the last K >= 10 resolved predictions". */
export const CALIBRATION_MIN_K = 10;
/** §4.4: "If cover < 0.70 for two consecutive evaluations: multiply `half` by 1.15". */
export const CALIBRATION_LOW_COVERAGE = 0.7;
export const CALIBRATION_WIDEN_FACTOR = 1.15;
/** §4.4: "If cover > 0.92 for two consecutive evaluations: multiply `half` by 0.90". */
export const CALIBRATION_HIGH_COVERAGE = 0.92;
export const CALIBRATION_NARROW_FACTOR = 0.9;
/** §4.4: "(cap at 2.0x cumulative)" / "(floor at 0.7x cumulative)". */
export const CALIBRATION_MAX = 2.0;
export const CALIBRATION_MIN = 0.7;

/** The neutral starting point for the calibration factor. */
export const CALIBRATION_NEUTRAL: CalibrationState = {
  cumulativeAdjustment: 1,
  recentCoverage: [],
};

// ---------------------------------------------------------------------------
// Resolving issued predictions against what actually happened
// ---------------------------------------------------------------------------

/**
 * A prediction as it was displayed to the user, persisted at the time it was issued. The
 * stored window is what coverage is judged against — recomputing the window with today's
 * calibration factor would be marking your own homework.
 */
export interface IssuedPrediction {
  /** The period start this prediction was anchored to. Also its identity: at most one
   * prediction per anchor is resolved (the last one in input order wins). */
  anchorStart: CivilDate;
  predictedStart: CivilDate;
  windowLow: CivilDate;
  windowHigh: CivilDate;
}

export interface ResolvedPrediction extends IssuedPrediction {
  /** The recorded period start that actually followed `anchorStart`. */
  actualStart: CivilDate;
  /** `actual - predicted`. Positive = the period came later than predicted (STEP 8). */
  signedErrorDays: number;
  absoluteErrorDays: number;
  /** Whether `actualStart` fell inside `[windowLow, windowHigh]` inclusive. */
  insideWindow: boolean;
}

/**
 * Pair each issued prediction with the first recorded period start strictly after its
 * anchor. Predictions with no such start are still pending and are dropped. Output is
 * chronological by anchor, which is the order the calibration loop walks.
 */
export function resolvePredictions(
  issued: readonly IssuedPrediction[],
  actualStarts: readonly CivilDate[],
): ResolvedPrediction[] {
  // Last write wins per anchor: a re-issued prediction for the same cycle supersedes the
  // earlier one rather than being scored twice.
  const byAnchor = new Map<CivilDate, IssuedPrediction>();
  for (const p of issued) byAnchor.set(p.anchorStart, p);

  const starts = [...actualStarts].sort(compare);

  const resolved: ResolvedPrediction[] = [];
  for (const p of [...byAnchor.values()].sort((a, b) => compare(a.anchorStart, b.anchorStart))) {
    const actualStart = starts.find((s) => compare(s, p.anchorStart) > 0);
    if (actualStart === undefined) continue;
    const signedErrorDays = diffDays(p.predictedStart, actualStart);
    resolved.push({
      ...p,
      actualStart,
      signedErrorDays,
      absoluteErrorDays: Math.abs(signedErrorDays),
      insideWindow:
        compare(actualStart, p.windowLow) >= 0 && compare(actualStart, p.windowHigh) <= 0,
    });
  }
  return resolved;
}

// ---------------------------------------------------------------------------
// The display summary (STEP 8, §8.2)
// ---------------------------------------------------------------------------

/** `StatSummary` for coverage, plus the raw counts so the UI can render "7 of the last 9"
 * rather than a bare percentage. */
export interface HitRateSummary extends StatSummary {
  hits: number;
}

export interface PerformanceSummary {
  /** Signed error of the most recent resolved prediction (ME, S11). Null when nothing has
   * resolved yet. */
  lastSignedErrorDays: number | null;
  /** Robust headline over the rolling window. Null below `ROLLING_WINDOW_MIN`. */
  rollingMedianAbsoluteErrorDays: number | null;
  /** Empirical coverage over the rolling window. Null below `ROLLING_WINDOW_MIN`. */
  windowHitRate: HitRateSummary | null;
  /** Tracked but not displayed (§8.2). */
  internal: {
    rollingMeanAbsoluteErrorDays: number | null;
    rootMeanSquaredErrorDays: number | null;
    /** PAE3 — proportion of absolute errors <= 3 days (S11). */
    proportionWithinThresholdDays: number | null;
    /** Signed-error quartiles over the rolling window: a visible bias check. */
    signedErrorQuartiles: { q25: number; q50: number; q75: number } | null;
    resolvedCount: number;
    rollingWindowSize: number;
  };
}

export interface PerformanceOptions {
  rollingWindowMin?: number;
  rollingWindowMax?: number;
}

export function computePerformance(
  resolved: readonly ResolvedPrediction[],
  options: PerformanceOptions = {},
): PerformanceSummary {
  const min = options.rollingWindowMin ?? ROLLING_WINDOW_MIN;
  const max = options.rollingWindowMax ?? ROLLING_WINDOW_MAX;

  const last = resolved.length > 0 ? resolved[resolved.length - 1] : null;
  const rolling = resolved.slice(Math.max(0, resolved.length - max));
  const enough = rolling.length >= min;

  if (!enough) {
    return {
      lastSignedErrorDays: last === null ? null : last.signedErrorDays,
      rollingMedianAbsoluteErrorDays: null,
      windowHitRate: null,
      internal: {
        rollingMeanAbsoluteErrorDays: null,
        rootMeanSquaredErrorDays: null,
        proportionWithinThresholdDays: null,
        signedErrorQuartiles: null,
        resolvedCount: resolved.length,
        rollingWindowSize: rolling.length,
      },
    };
  }

  const absolute = rolling.map((r) => r.absoluteErrorDays);
  const signed = rolling.map((r) => r.signedErrorDays);
  const hits = rolling.filter((r) => r.insideWindow).length;

  const meanAbsolute = absolute.reduce((a, b) => a + b, 0) / absolute.length;
  const rmse = Math.sqrt(signed.reduce((a, b) => a + b * b, 0) / signed.length);
  const pae =
    absolute.filter((d) => d <= PAE_THRESHOLD_DAYS).length / absolute.length;

  return {
    lastSignedErrorDays: last === null ? null : last.signedErrorDays,
    rollingMedianAbsoluteErrorDays: median(absolute),
    windowHitRate: {
      ...wilsonInterval(hits, rolling.length),
      hits,
      n: rolling.length,
    },
    internal: {
      rollingMeanAbsoluteErrorDays: meanAbsolute,
      rootMeanSquaredErrorDays: rmse,
      proportionWithinThresholdDays: pae,
      signedErrorQuartiles: {
        q25: quantile(signed, 0.25),
        q50: quantile(signed, 0.5),
        q75: quantile(signed, 0.75),
      },
      resolvedCount: resolved.length,
      rollingWindowSize: rolling.length,
    },
  };
}

/**
 * Wilson score interval for a proportion, at the app's own `TARGET_COVERAGE` level (80%).
 * [choice] SPEC.md §3 types `windowHitRate` as a `StatSummary`, which requires a low and a
 * high; a hit rate of "7 of 9" is itself an estimate and reporting it without its own
 * spread would repeat exactly the mistake agent E's brief forbids ("never emit an average
 * without its variation"). Wilson rather than normal-approximation because n here is 6-12.
 */
export function wilsonInterval(successes: number, n: number): StatSummary {
  if (n <= 0) return { center: 0, low: 0, high: 1, n: 0 };
  const z = tQuantile(1 - (1 - TARGET_COVERAGE) / 2, 1e6);
  const p = successes / n;
  const denominator = 1 + (z * z) / n;
  const midpoint = p + (z * z) / (2 * n);
  const spread = z * Math.sqrt((p * (1 - p)) / n + (z * z) / (4 * n * n));
  return {
    center: p,
    low: Math.max(0, (midpoint - spread) / denominator),
    high: Math.min(1, (midpoint + spread) / denominator),
    n,
  };
}

// ---------------------------------------------------------------------------
// Self-calibration (STEP 7, §4.4)
// ---------------------------------------------------------------------------

export interface CalibrationOptions {
  minK?: number;
}

/**
 * §4.4, recomputed from scratch over the full resolved history rather than mutated in
 * place. That satisfies SPEC.md R2 ("derived data may be cached but must be recomputable
 * from scratch at any time") and makes the loop deterministic and testable: the hit/miss
 * sequence is fixed by the *stored* windows, so replaying it always yields the same factor.
 *
 * ```
 * over the last K >= 10 resolved predictions:
 *   cover = fraction of actual starts inside the displayed window
 *   if cover < 0.70 twice in a row: calibration_factor *= 1.15   (cap 2.0)
 *   if cover > 0.92 twice in a row: calibration_factor *= 0.90   (floor 0.7)
 * ```
 *
 * "Twice in a row" is read as two consecutive *evaluations*, and one evaluation happens
 * each time a prediction resolves — so a coverage failure that persists keeps compounding
 * until the cap, which is what the cap is for.
 */
export function recomputeCalibration(
  resolved: readonly ResolvedPrediction[],
  options: CalibrationOptions = {},
): CalibrationState {
  const k = options.minK ?? CALIBRATION_MIN_K;
  const hits = resolved.map((r) => r.insideWindow);

  let factor = 1;
  let previousBelow = false;
  let previousAbove = false;

  for (let j = k - 1; j < hits.length; j++) {
    const windowHits = hits.slice(j - k + 1, j + 1);
    const cover = windowHits.filter(Boolean).length / k;
    const below = cover < CALIBRATION_LOW_COVERAGE;
    const above = cover > CALIBRATION_HIGH_COVERAGE;

    if (below && previousBelow) {
      factor = Math.min(CALIBRATION_MAX, factor * CALIBRATION_WIDEN_FACTOR);
    }
    if (above && previousAbove) {
      factor = Math.max(CALIBRATION_MIN, factor * CALIBRATION_NARROW_FACTOR);
    }
    previousBelow = below;
    previousAbove = above;
  }

  return {
    cumulativeAdjustment: factor,
    recentCoverage: hits.slice(Math.max(0, hits.length - k)),
  };
}

/**
 * The coverage figure the calibration loop is currently looking at, or null when fewer
 * than K predictions have resolved. Exposed so a "why is my window this wide?" panel can
 * show the same number the loop used, rather than a different one.
 */
export function currentCoverage(
  resolved: readonly ResolvedPrediction[],
  options: CalibrationOptions = {},
): number | null {
  const k = options.minK ?? CALIBRATION_MIN_K;
  if (resolved.length < k) return null;
  const windowHits = resolved.slice(resolved.length - k);
  return windowHits.filter((r) => r.insideWindow).length / k;
}

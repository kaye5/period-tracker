import { describe, expect, it } from "vitest";

import { addDays, parseCivil, type CivilDate } from "@/lib/date/civil";
import {
  CALIBRATION_MAX,
  CALIBRATION_MIN,
  CALIBRATION_MIN_K,
  CALIBRATION_NARROW_FACTOR,
  CALIBRATION_WIDEN_FACTOR,
  PAE_THRESHOLD_DAYS,
  ROLLING_WINDOW_MAX,
  ROLLING_WINDOW_MIN,
  computePerformance,
  currentCoverage,
  recomputeCalibration,
  resolvePredictions,
  wilsonInterval,
  type IssuedPrediction,
  type ResolvedPrediction,
} from "@/lib/engine/performance";

const d = (s: string): CivilDate => parseCivil(s);

/**
 * A synthetic history: `errors[i]` is the signed error (actual - predicted) of the i-th
 * prediction, and `halfWidth` is the half-width of the window that was displayed at the
 * time. Anchors are spaced 29 days apart.
 */
function history(errors: number[], halfWidth = 3): ResolvedPrediction[] {
  const issued: IssuedPrediction[] = [];
  const actualStarts: CivilDate[] = [];
  let anchor = d("2024-01-01");
  for (const error of errors) {
    const predictedStart = addDays(anchor, 29);
    const actualStart = addDays(predictedStart, error);
    issued.push({
      anchorStart: anchor,
      predictedStart,
      windowLow: addDays(predictedStart, -halfWidth),
      windowHigh: addDays(predictedStart, halfWidth),
    });
    actualStarts.push(actualStart);
    anchor = actualStart;
  }
  return resolvePredictions(issued, actualStarts);
}

describe("resolvePredictions", () => {
  it("pairs each prediction with the first recorded start after its anchor", () => {
    const issued: IssuedPrediction[] = [
      {
        anchorStart: d("2026-01-01"),
        predictedStart: d("2026-01-30"),
        windowLow: d("2026-01-27"),
        windowHigh: d("2026-02-02"),
      },
      {
        anchorStart: d("2026-02-01"),
        predictedStart: d("2026-03-02"),
        windowLow: d("2026-02-27"),
        windowHigh: d("2026-03-05"),
      },
    ];
    const resolved = resolvePredictions(issued, [
      d("2026-01-01"),
      d("2026-02-01"),
      d("2026-03-04"),
    ]);
    expect(resolved).toHaveLength(2);
    expect(resolved[0].actualStart).toBe(d("2026-02-01"));
    expect(resolved[0].signedErrorDays).toBe(2); // 2 days later than predicted
    expect(resolved[0].insideWindow).toBe(true);
    expect(resolved[1].actualStart).toBe(d("2026-03-04"));
    expect(resolved[1].signedErrorDays).toBe(2);
  });

  it("drops predictions that have not resolved yet rather than scoring them as misses", () => {
    const issued: IssuedPrediction[] = [
      {
        anchorStart: d("2026-06-01"),
        predictedStart: d("2026-06-30"),
        windowLow: d("2026-06-27"),
        windowHigh: d("2026-07-03"),
      },
    ];
    expect(resolvePredictions(issued, [d("2026-06-01")])).toHaveLength(0);
  });

  it("scores window membership inclusively at both endpoints", () => {
    const base = {
      anchorStart: d("2026-01-01"),
      predictedStart: d("2026-01-30"),
      windowLow: d("2026-01-27"),
      windowHigh: d("2026-02-02"),
    };
    expect(resolvePredictions([base], [d("2026-01-01"), d("2026-01-27")])[0].insideWindow).toBe(
      true,
    );
    expect(resolvePredictions([base], [d("2026-01-01"), d("2026-02-02")])[0].insideWindow).toBe(
      true,
    );
    expect(resolvePredictions([base], [d("2026-01-01"), d("2026-02-03")])[0].insideWindow).toBe(
      false,
    );
  });

  it("supersedes a re-issued prediction for the same anchor instead of double counting", () => {
    const stale: IssuedPrediction = {
      anchorStart: d("2026-01-01"),
      predictedStart: d("2026-01-25"),
      windowLow: d("2026-01-22"),
      windowHigh: d("2026-01-28"),
    };
    const fresh: IssuedPrediction = { ...stale, predictedStart: d("2026-01-30") };
    const resolved = resolvePredictions([stale, fresh], [d("2026-01-01"), d("2026-01-30")]);
    expect(resolved).toHaveLength(1);
    expect(resolved[0].signedErrorDays).toBe(0);
  });
});

describe("computePerformance — the three things §8.2 says to show", () => {
  it("reports the last signed error even before the rolling window fills", () => {
    const summary = computePerformance(history([2]));
    expect(summary.lastSignedErrorDays).toBe(2);
    expect(summary.rollingMedianAbsoluteErrorDays).toBeNull();
    expect(summary.windowHitRate).toBeNull();
    expect(summary.internal.resolvedCount).toBe(1);
  });

  it("keeps the sign, so systematic bias is visible to the user", () => {
    expect(computePerformance(history([-3])).lastSignedErrorDays).toBe(-3);
    expect(computePerformance(history([3])).lastSignedErrorDays).toBe(3);
    const late = computePerformance(history([2, 3, 2, 3, 2, 3]));
    expect(late.internal.signedErrorQuartiles?.q50).toBeGreaterThan(0);
  });

  it("uses the MEDIAN absolute error for the headline, so one blowup cannot dominate", () => {
    const summary = computePerformance(history([1, 1, 1, 1, 1, 40]));
    expect(summary.rollingMedianAbsoluteErrorDays).toBe(1);
    // ...and the mean, kept internally, does move — which is exactly why it is internal.
    expect(summary.internal.rollingMeanAbsoluteErrorDays as number).toBeGreaterThan(7);
    expect(summary.internal.rootMeanSquaredErrorDays as number).toBeGreaterThan(
      summary.internal.rollingMeanAbsoluteErrorDays as number,
    );
  });

  it("reports the hit rate as hits-of-n, with its own interval", () => {
    // halfWidth 3, so |error| <= 3 is a hit: 7 of 9.
    const summary = computePerformance(history([0, 1, -2, 3, 9, 1, -8, 2, 0]));
    expect(summary.windowHitRate?.hits).toBe(7);
    expect(summary.windowHitRate?.n).toBe(9);
    expect(summary.windowHitRate?.center).toBeCloseTo(7 / 9, 10);
    expect(summary.windowHitRate?.low).toBeLessThan(7 / 9);
    expect(summary.windowHitRate?.high).toBeGreaterThan(7 / 9);
  });

  it("computes PAE3 internally against S11's 3-day operational threshold", () => {
    const summary = computePerformance(history([0, 1, 2, 3, 4, 5]));
    expect(PAE_THRESHOLD_DAYS).toBe(3);
    expect(summary.internal.proportionWithinThresholdDays).toBeCloseTo(4 / 6, 10);
  });

  it("rolls over at most the last ROLLING_WINDOW_MAX resolved predictions", () => {
    const errors = [...Array(20).keys()].map(() => 1);
    const summary = computePerformance(history(errors));
    expect(summary.internal.resolvedCount).toBe(20);
    expect(summary.internal.rollingWindowSize).toBe(ROLLING_WINDOW_MAX);
    expect(summary.windowHitRate?.n).toBe(ROLLING_WINDOW_MAX);
  });

  it("stays silent below ROLLING_WINDOW_MIN rather than reporting a one-cycle rate", () => {
    for (let n = 1; n < ROLLING_WINDOW_MIN; n++) {
      const summary = computePerformance(history(Array(n).fill(1)));
      expect(summary.rollingMedianAbsoluteErrorDays).toBeNull();
      expect(summary.windowHitRate).toBeNull();
    }
    const enough = computePerformance(history(Array(ROLLING_WINDOW_MIN).fill(1)));
    expect(enough.rollingMedianAbsoluteErrorDays).toBe(1);
    expect(enough.windowHitRate).not.toBeNull();
  });

  it("handles an empty history without inventing anything", () => {
    const summary = computePerformance([]);
    expect(summary.lastSignedErrorDays).toBeNull();
    expect(summary.rollingMedianAbsoluteErrorDays).toBeNull();
    expect(summary.windowHitRate).toBeNull();
    expect(summary.internal.resolvedCount).toBe(0);
  });

  it("exposes no single accuracy percentage anywhere in its output", () => {
    const summary = computePerformance(history([0, 1, -2, 3, 9, 1, -8, 2, 0]));
    const keys = JSON.stringify(summary).toLowerCase();
    expect(keys).not.toContain("accuracy");
    expect(keys).not.toContain("accurate");
    expect(keys).not.toContain("percent");
    // The hit rate is the only rate, and it always ships with its denominator.
    expect(summary.windowHitRate?.n).toBeGreaterThan(0);
  });
});

describe("wilsonInterval", () => {
  it("brackets the observed proportion and stays inside [0, 1]", () => {
    for (const [k, n] of [
      [0, 6],
      [3, 6],
      [6, 6],
      [7, 9],
      [10, 12],
    ]) {
      const interval = wilsonInterval(k, n);
      expect(interval.center).toBeCloseTo(k / n, 10);
      expect(interval.low).toBeGreaterThanOrEqual(0);
      expect(interval.high).toBeLessThanOrEqual(1);
      expect(interval.low).toBeLessThanOrEqual(interval.center + 1e-9);
      expect(interval.high).toBeGreaterThanOrEqual(interval.center - 1e-9);
    }
  });

  it("narrows as n grows", () => {
    const small = wilsonInterval(4, 6);
    const large = wilsonInterval(40, 60);
    expect(large.high - large.low).toBeLessThan(small.high - small.low);
  });
});

describe("recomputeCalibration — the §4.4 loop", () => {
  const miss = 20; // outside a +-3 day window
  const hit = 1;

  it("does nothing until K predictions have resolved", () => {
    const state = recomputeCalibration(history(Array(CALIBRATION_MIN_K - 1).fill(miss)));
    expect(state.cumulativeAdjustment).toBe(1);
    expect(currentCoverage(history(Array(CALIBRATION_MIN_K - 1).fill(miss)))).toBeNull();
  });

  it("does nothing on a single low-coverage evaluation — it must repeat", () => {
    // Exactly K resolved: one evaluation only, so nothing can be "twice in a row".
    const state = recomputeCalibration(history(Array(CALIBRATION_MIN_K).fill(miss)));
    expect(state.cumulativeAdjustment).toBe(1);
    expect(currentCoverage(history(Array(CALIBRATION_MIN_K).fill(miss)))).toBe(0);
  });

  it("widens by 1.15 after two consecutive evaluations below 0.70 coverage", () => {
    const state = recomputeCalibration(history(Array(CALIBRATION_MIN_K + 1).fill(miss)));
    expect(state.cumulativeAdjustment).toBeCloseTo(CALIBRATION_WIDEN_FACTOR, 10);
  });

  it("compounds while coverage stays low, and caps at 2.0", () => {
    const state = recomputeCalibration(history(Array(40).fill(miss)));
    expect(state.cumulativeAdjustment).toBe(CALIBRATION_MAX);
  });

  it("narrows by 0.90 after two consecutive evaluations above 0.92 coverage, floored at 0.7", () => {
    const two = recomputeCalibration(history(Array(CALIBRATION_MIN_K + 1).fill(hit)));
    expect(two.cumulativeAdjustment).toBeCloseTo(CALIBRATION_NARROW_FACTOR, 10);

    const many = recomputeCalibration(history(Array(40).fill(hit)));
    expect(many.cumulativeAdjustment).toBe(CALIBRATION_MIN);
  });

  it("leaves the factor alone when coverage sits in the acceptable 0.70-0.92 band", () => {
    // 8 hits and 2 misses in every consecutive window of 10 -> coverage 0.8 throughout.
    const pattern = [hit, hit, hit, hit, miss, hit, hit, hit, hit, miss];
    const errors = [...pattern, ...pattern, ...pattern];
    const state = recomputeCalibration(history(errors));
    expect(state.cumulativeAdjustment).toBe(1);
    expect(currentCoverage(history(errors))).toBeCloseTo(0.8, 10);
  });

  it("is a pure function of the resolved history — replaying gives the same factor", () => {
    const errors = [miss, miss, hit, miss, miss, miss, hit, miss, miss, miss, miss, miss];
    const a = recomputeCalibration(history(errors));
    const b = recomputeCalibration(history(errors));
    expect(b).toEqual(a);
    expect(a.cumulativeAdjustment).toBeGreaterThan(1);
  });

  it("stores the last K coverage outcomes, most recent last", () => {
    const errors = [...Array(15).keys()].map((i) => (i === 14 ? miss : hit));
    const state = recomputeCalibration(history(errors));
    expect(state.recentCoverage).toHaveLength(CALIBRATION_MIN_K);
    expect(state.recentCoverage[CALIBRATION_MIN_K - 1]).toBe(false);
    expect(state.recentCoverage[0]).toBe(true);
  });

  it("judges coverage against the window that was actually displayed, not a fresh one", () => {
    // Identical errors, but the wider stored window turns misses into hits.
    const errors = Array(CALIBRATION_MIN_K + 1).fill(5);
    expect(recomputeCalibration(history(errors, 3)).cumulativeAdjustment).toBeCloseTo(
      CALIBRATION_WIDEN_FACTOR,
      10,
    );
    expect(recomputeCalibration(history(errors, 8)).cumulativeAdjustment).toBeCloseTo(
      CALIBRATION_NARROW_FACTOR,
      10,
    );
  });
});

import { describe, expect, it } from "vitest";
import {
  benjaminiHochberg,
  binomPmf,
  binomSf,
  mean,
  median,
  quantile,
  tQuantile,
  weightedMean,
} from "./index";

describe("mean / weightedMean", () => {
  it("computes the arithmetic mean", () => {
    expect(mean([1, 2, 3, 4, 5])).toBe(3);
    expect(mean([10])).toBe(10);
  });

  it("throws on empty input", () => {
    expect(() => mean([])).toThrow();
  });

  it("computes a weighted mean", () => {
    expect(weightedMean([10, 20], [1, 1])).toBe(15);
    expect(weightedMean([10, 20], [3, 1])).toBe((10 * 3 + 20 * 1) / 4);
    // A weight of 0.5 on an "inferred split" cycle (per the research doc's skip-detection
    // spec) should count for exactly half as much as a weight-1 cycle.
    expect(weightedMean([30, 30, 60], [1, 1, 0.5])).toBeCloseTo(
      (30 + 30 + 30) / 2.5,
      10,
    );
  });

  it("throws on mismatched lengths, empty input, or all-zero weights", () => {
    expect(() => weightedMean([1, 2], [1])).toThrow();
    expect(() => weightedMean([], [])).toThrow();
    expect(() => weightedMean([1, 2], [0, 0])).toThrow();
  });
});

describe("quantile / median — type 7 interpolation", () => {
  it("matches the well-known type-7 worked example", () => {
    // R's quantile(c(1,2,3,4), 0.25, type=7) == 1.75
    expect(quantile([1, 2, 3, 4], 0.25)).toBeCloseTo(1.75, 10);
    expect(quantile([1, 2, 3, 4], 0.75)).toBeCloseTo(3.25, 10);
  });

  it("p=0 and p=1 return the extremes", () => {
    expect(quantile([5, 1, 3], 0)).toBe(1);
    expect(quantile([5, 1, 3], 1)).toBe(5);
  });

  it("is order-independent (sorts internally) and doesn't mutate its input", () => {
    const input = [5, 1, 3, 2, 4];
    const copy = [...input];
    expect(quantile(input, 0.5)).toBe(3);
    expect(input).toEqual(copy);
  });

  it("median handles odd and even length arrays", () => {
    expect(median([1, 2, 3, 4, 5])).toBe(3);
    expect(median([1, 2, 3, 4])).toBe(2.5);
    expect(median([7])).toBe(7);
  });

  it("throws on an empty array", () => {
    expect(() => quantile([], 0.5)).toThrow();
  });
});

describe("binomPmf", () => {
  it("matches hand-computable small-n values", () => {
    // Fair coin, n=5: P(X=k) = C(5,k) / 32
    expect(binomPmf(0, 5, 0.5)).toBeCloseTo(1 / 32, 12);
    expect(binomPmf(1, 5, 0.5)).toBeCloseTo(5 / 32, 12);
    expect(binomPmf(5, 5, 0.5)).toBeCloseTo(1 / 32, 12);
  });

  it("sums to 1 over all k for a given n, p", () => {
    for (const p of [0.1, 0.5, 0.9]) {
      let sum = 0;
      for (let k = 0; k <= 12; k++) sum += binomPmf(k, 12, p);
      expect(sum).toBeCloseTo(1, 10);
    }
  });

  it("handles the p=0 and p=1 edge cases", () => {
    expect(binomPmf(0, 5, 0)).toBe(1);
    expect(binomPmf(1, 5, 0)).toBe(0);
    expect(binomPmf(5, 5, 1)).toBe(1);
    expect(binomPmf(4, 5, 1)).toBe(0);
  });

  it("returns 0 outside [0, n]", () => {
    expect(binomPmf(-1, 5, 0.5)).toBe(0);
    expect(binomPmf(6, 5, 0.5)).toBe(0);
  });
});

describe("binomSf — exact one-sided Pr(X >= k), load-bearing for the insight engine", () => {
  // These three are given verbatim in the brief and hand-verifiable:
  //   Pr(X >= 5 | n=5, p=0.5) = 1/32  = 0.03125
  //   Pr(X >= 4 | n=4, p=0.5) = 1/16  = 0.0625
  //   Pr(X >= 3 | n=3, p=0.5) = 1/8   = 0.125
  it("Pr(X >= 5 | n=5, p=0.5) = 1/32", () => {
    expect(binomSf(5, 5, 0.5)).toBeCloseTo(1 / 32, 12);
    expect(binomSf(5, 5, 0.5)).toBeCloseTo(0.03125, 12);
  });

  it("Pr(X >= 4 | n=4, p=0.5) = 1/16", () => {
    expect(binomSf(4, 4, 0.5)).toBeCloseTo(1 / 16, 12);
    expect(binomSf(4, 4, 0.5)).toBeCloseTo(0.0625, 12);
  });

  it("Pr(X >= 3 | n=3, p=0.5) = 1/8", () => {
    expect(binomSf(3, 3, 0.5)).toBeCloseTo(1 / 8, 12);
    expect(binomSf(3, 3, 0.5)).toBeCloseTo(0.125, 12);
  });

  // Cross-check against the exact one-sided p-values tabulated in
  // 02-symptom-insights.md §3.2 for the sign-test-on-cycles insight rule.
  it("matches the exact p-values tabulated in 02-symptom-insights.md §3.2", () => {
    expect(binomSf(3, 3, 0.5)).toBeCloseTo(0.125, 4); // 3/3
    expect(binomSf(4, 4, 0.5)).toBeCloseTo(0.0625, 4); // 4/4
    expect(binomSf(5, 5, 0.5)).toBeCloseTo(0.03125, 5); // 5/5
    expect(binomSf(6, 6, 0.5)).toBeCloseTo(0.01563, 5); // 6/6
    expect(binomSf(6, 7, 0.5)).toBeCloseTo(0.0625, 4); // 6/7
    expect(binomSf(7, 7, 0.5)).toBeCloseTo(0.00781, 5); // 7/7
    expect(binomSf(7, 8, 0.5)).toBeCloseTo(0.03516, 5); // 7/8
    expect(binomSf(8, 9, 0.5)).toBeCloseTo(0.01953, 5); // 8/9
    expect(binomSf(8, 10, 0.5)).toBeCloseTo(0.05469, 5); // 8/10
    expect(binomSf(9, 10, 0.5)).toBeCloseTo(0.01074, 5); // 9/10
    expect(binomSf(9, 12, 0.5)).toBeCloseTo(0.073, 3); // 9/12
    expect(binomSf(10, 12, 0.5)).toBeCloseTo(0.01929, 5); // 10/12
  });

  it("the arithmetic fact that below 5 non-tie cycles nothing can reach p < 0.05", () => {
    // This is the design fact 02-symptom-insights.md §3.2 calls "the single cleanest
    // design fact in this document": with n < 5 non-tie cycles, even unanimous
    // agreement (k = n) cannot reach conventional significance under the sign test.
    for (let n = 1; n < 5; n++) {
      expect(binomSf(n, n, 0.5)).toBeGreaterThan(0.05);
    }
    // At n = 5, unanimous agreement (5/5) is the first case that clears p < 0.05.
    expect(binomSf(5, 5, 0.5)).toBeLessThan(0.05);
  });

  it("boundary behaviour", () => {
    expect(binomSf(0, 5, 0.5)).toBe(1); // Pr(X >= 0) is certain
    expect(binomSf(6, 5, 0.5)).toBe(0); // impossible: k > n
  });
});

describe("tQuantile — verified against published Student's t table values", () => {
  // One-tailed alpha = 0.10 row (i.e. the 90th percentile), a standard published table
  // (e.g. NIST/SEMATECH e-Handbook of Statistical Methods, "Table of the Student's t
  // distribution"). These are the exact values the brief asked to be verified.
  const upperTail10 : Array<[number, number]> = [
    [1, 3.078],
    [2, 1.886],
    [3, 1.638],
    [4, 1.533],
    [5, 1.476],
    [6, 1.44],
    [7, 1.415],
    [8, 1.397],
    [9, 1.383],
    [10, 1.372],
    [15, 1.341],
    [20, 1.325],
    [25, 1.316],
    [30, 1.31],
    [40, 1.303],
    [50, 1.299],
  ];

  it.each(upperTail10)("t(p=0.90, df=%i) ≈ %f", (df, expected) => {
    expect(tQuantile(0.9, df)).toBeCloseTo(expected, 3);
  });

  // Two-tailed alpha = 0.05 row (97.5th percentile) — the classic "95% CI multiplier"
  // table, included as an independent cross-check of the same implementation at a
  // different p.
  const upperTail025: Array<[number, number]> = [
    [1, 12.706],
    [5, 2.571],
    [10, 2.228],
    [30, 2.042],
    [50, 2.009],
  ];

  it.each(upperTail025)("t(p=0.975, df=%i) ≈ %f", (df, expected) => {
    expect(tQuantile(0.975, df)).toBeCloseTo(expected, 3);
  });

  it("is antisymmetric: t(p, df) = -t(1-p, df)", () => {
    for (const df of [1, 5, 10, 30]) {
      expect(tQuantile(0.9, df)).toBeCloseTo(-tQuantile(0.1, df), 8);
    }
  });

  it("returns 0 at p=0.5", () => {
    for (const df of [1, 5, 30]) {
      expect(tQuantile(0.5, df)).toBe(0);
    }
  });

  it("rejects out-of-range inputs", () => {
    expect(() => tQuantile(0, 5)).toThrow();
    expect(() => tQuantile(1, 5)).toThrow();
    expect(() => tQuantile(0.5, 0)).toThrow();
  });
});

describe("benjaminiHochberg", () => {
  it("marks all p-values as discoveries when every one clears the line", () => {
    const result = benjaminiHochberg([0.001, 0.002, 0.003], 0.1);
    expect(result).toEqual([true, true, true]);
  });

  it("marks none as discoveries when none clear the line", () => {
    const result = benjaminiHochberg([0.5, 0.6, 0.7], 0.1);
    expect(result).toEqual([false, false, false]);
  });

  it("matches a hand-worked step-up example", () => {
    // p = [0.01, 0.04, 0.03, 0.20], m=4, q=0.10.
    // Sorted: 0.01 (i=1, thresh 0.025 -> pass), 0.03 (i=2, thresh 0.05 -> pass),
    //         0.04 (i=3, thresh 0.075 -> pass), 0.20 (i=4, thresh 0.10 -> fail).
    // Step-up: largest passing rank is 3, so ranks 1-3 are discoveries.
    const pValues = [0.01, 0.04, 0.03, 0.2];
    const result = benjaminiHochberg(pValues, 0.1);
    expect(result).toEqual([true, true, true, false]);
  });

  it("honours an explicit m larger than the number of p-values supplied", () => {
    // Same p-values, but told there were 12 tests run in total (only these 2 survived
    // an earlier, outcome-independent pre-filter) — the correction should be stricter.
    const lenient = benjaminiHochberg([0.01, 0.02], 0.1, 2);
    const strict = benjaminiHochberg([0.01, 0.02], 0.1, 12);
    expect(lenient).toEqual([true, true]);
    // With m=12: rank1 thresh = (1/12)*0.1=0.00833 (0.01 fails), rank2 thresh =
    // (2/12)*0.1=0.01667 (0.02 fails). Neither survives.
    expect(strict).toEqual([false, false]);
  });

  it("preserves input order in its output", () => {
    const result = benjaminiHochberg([0.9, 0.001, 0.5], 0.1);
    expect(result[1]).toBe(true); // the smallest p-value, regardless of position
  });

  it("rejects m smaller than the number of p-values", () => {
    expect(() => benjaminiHochberg([0.1, 0.2], 0.1, 1)).toThrow();
  });
});

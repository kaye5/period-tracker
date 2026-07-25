/**
 * Small, dependency-free statistics primitives used throughout lib/engine/.
 * Per SPEC.md R3, everything here is a pure function: no I/O, no randomness, no clock.
 */

// ---------------------------------------------------------------------------
// Location / spread
// ---------------------------------------------------------------------------

/** Arithmetic mean. Throws on an empty array (there is no sensible mean of nothing). */
export function mean(values: number[]): number {
  if (values.length === 0) throw new Error("mean() requires at least one value");
  let sum = 0;
  for (const v of values) sum += v;
  return sum / values.length;
}

/** Weighted mean: sum(v_i * w_i) / sum(w_i). Throws if the arrays' lengths differ,
 * the input is empty, or all weights are zero. */
export function weightedMean(values: number[], weights: number[]): number {
  if (values.length !== weights.length) {
    throw new Error("weightedMean() requires values and weights of equal length");
  }
  if (values.length === 0) throw new Error("weightedMean() requires at least one value");
  let num = 0;
  let den = 0;
  for (let i = 0; i < values.length; i++) {
    num += values[i] * weights[i];
    den += weights[i];
  }
  if (den === 0) throw new Error("weightedMean() requires a nonzero total weight");
  return num / den;
}

/**
 * Sample quantile using "type 7" interpolation (R's and NumPy's default; linear
 * interpolation of the empirical CDF). `p` in [0, 1]. Throws on an empty array.
 */
export function quantile(values: number[], p: number): number {
  if (values.length === 0) throw new Error("quantile() requires at least one value");
  if (p < 0 || p > 1) throw new Error("quantile() requires 0 <= p <= 1");
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const h = (n - 1) * p;
  const lo = Math.floor(h);
  const hi = Math.min(lo + 1, n - 1);
  const frac = h - lo;
  return sorted[lo] + frac * (sorted[hi] - sorted[lo]);
}

/** The median (50th percentile), via `quantile`. */
export function median(values: number[]): number {
  return quantile(values, 0.5);
}

// ---------------------------------------------------------------------------
// Exact binomial distribution
// ---------------------------------------------------------------------------

/** log(n!) via the Lanczos approximation to log(Gamma(n+1)). Exact for our purposes
 * (relative error ~1e-10), used to keep binomial coefficients numerically stable for
 * n well beyond the ~50-cycle range this app will ever see. */
function logFactorial(n: number): number {
  return logGamma(n + 1);
}

const LANCZOS_G = 7;
const LANCZOS_COEFFICIENTS = [
  0.99999999999980993, 676.5203681218851, -1259.1392167224028,
  771.32342877765313, -176.61502916214059, 12.507343278686905,
  -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7,
];

/** log(Gamma(x)) via the Lanczos approximation. Valid for x > 0. */
function logGamma(x: number): number {
  if (x < 0.5) {
    // Reflection formula, kept for completeness even though every call site here
    // uses x >= 1.
    return Math.log(Math.PI / Math.sin(Math.PI * x)) - logGamma(1 - x);
  }
  x -= 1;
  let a = LANCZOS_COEFFICIENTS[0];
  const t = x + LANCZOS_G + 0.5;
  for (let i = 1; i < LANCZOS_G + 2; i++) {
    a += LANCZOS_COEFFICIENTS[i] / (x + i);
  }
  return 0.5 * Math.log(2 * Math.PI) + (x + 0.5) * Math.log(t) - t + Math.log(a);
}

function logBinomialCoefficient(n: number, k: number): number {
  return logFactorial(n) - logFactorial(k) - logFactorial(n - k);
}

/** Exact P(X = k) for X ~ Binomial(n, p). */
export function binomPmf(k: number, n: number, p: number): number {
  if (!Number.isInteger(n) || n < 0) throw new Error("binomPmf() requires n >= 0 integer");
  if (!Number.isInteger(k)) throw new Error("binomPmf() requires integer k");
  if (p < 0 || p > 1) throw new Error("binomPmf() requires 0 <= p <= 1");
  if (k < 0 || k > n) return 0;
  if (p === 0) return k === 0 ? 1 : 0;
  if (p === 1) return k === n ? 1 : 0;
  const logP = logBinomialCoefficient(n, k) + k * Math.log(p) + (n - k) * Math.log(1 - p);
  return Math.exp(logP);
}

/**
 * Exact, one-sided P(X >= k) for X ~ Binomial(n, p) — a direct sum of `binomPmf`, not a
 * normal approximation. This exactness is load-bearing for the insight engine's
 * minimum-cycle threshold (SPEC.md R10 / 02-symptom-insights.md §3.2), where n is as
 * small as 3-12 and a normal approximation would be badly wrong.
 */
export function binomSf(k: number, n: number, p: number): number {
  if (k <= 0) return 1;
  if (k > n) return 0;
  let sum = 0;
  for (let i = k; i <= n; i++) sum += binomPmf(i, n, p);
  // Guard against floating-point drift pushing a probability fractionally outside [0,1].
  return Math.min(1, Math.max(0, sum));
}

// ---------------------------------------------------------------------------
// Student's t quantile function (inverse CDF)
// ---------------------------------------------------------------------------

/**
 * Regularized incomplete beta function I_x(a, b), via the standard continued-fraction
 * evaluation (Numerical Recipes' `betacf`/`betai`). Used to invert Student's t CDF.
 */
function betaContinuedFraction(x: number, a: number, b: number): number {
  const MAX_ITERATIONS = 200;
  const EPSILON = 3e-14;
  const FP_MIN = 1e-300;

  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < FP_MIN) d = FP_MIN;
  d = 1 / d;
  let h = d;

  for (let m = 1; m <= MAX_ITERATIONS; m++) {
    const m2 = 2 * m;
    let aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FP_MIN) d = FP_MIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FP_MIN) c = FP_MIN;
    d = 1 / d;
    h *= d * c;

    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < FP_MIN) d = FP_MIN;
    c = 1 + aa / c;
    if (Math.abs(c) < FP_MIN) c = FP_MIN;
    d = 1 / d;
    const del = d * c;
    h *= del;

    if (Math.abs(del - 1) < EPSILON) break;
  }
  return h;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logBeta =
    logGamma(a + b) - logGamma(a) - logGamma(b) + a * Math.log(x) + b * Math.log(1 - x);
  const front = Math.exp(logBeta);
  if (x < (a + 1) / (a + b + 2)) {
    return (front * betaContinuedFraction(x, a, b)) / a;
  }
  return 1 - (front * betaContinuedFraction(1 - x, b, a)) / b;
}

/** CDF of Student's t distribution with `df` degrees of freedom, P(T <= t). */
function tCdf(t: number, df: number): number {
  if (t === 0) return 0.5;
  const x = df / (df + t * t);
  const ib = regularizedIncompleteBeta(x, df / 2, 0.5);
  return t > 0 ? 1 - 0.5 * ib : 0.5 * ib;
}

/**
 * Inverse CDF of Student's t distribution: returns `t` such that P(T <= t) = p, for
 * `df` degrees of freedom. Solved by bisection against `tCdf` (built on the regularized
 * incomplete beta function above), which is accurate to well beyond 3 decimal places for
 * df in [1, 50] — see stat.test.ts for verification against published t-table values.
 */
export function tQuantile(p: number, df: number): number {
  if (p <= 0 || p >= 1) throw new Error("tQuantile() requires 0 < p < 1");
  if (df < 1) throw new Error("tQuantile() requires df >= 1");
  if (p === 0.5) return 0;

  const sign = p > 0.5 ? 1 : -1;
  const targetCdf = p > 0.5 ? p : 1 - p; // solve for the positive branch, then flip sign

  let lo = 0;
  let hi = 1;
  // Expand hi until tCdf(hi) exceeds the target, bounding the root.
  while (tCdf(hi, df) < targetCdf) {
    lo = hi;
    hi *= 2;
    if (hi > 1e8) break; // pathological p extremely close to 1; bail out of the loop
  }
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (tCdf(mid, df) < targetCdf) {
      lo = mid;
    } else {
      hi = mid;
    }
    if (hi - lo < 1e-12) break;
  }
  return sign * (lo + hi) / 2;
}

// ---------------------------------------------------------------------------
// Multiple-comparisons correction
// ---------------------------------------------------------------------------

/**
 * Benjamini-Hochberg step-up FDR procedure. Returns, for each p-value in `pValues` (in
 * its original order), whether it is a discovery at FDR level `q`.
 *
 * `m` is the number of tests to treat as the family for the correction — pass it
 * explicitly when `pValues` contains only the tests that survived some earlier,
 * outcome-independent pre-filter but the false-discovery-rate bookkeeping must still be
 * against the full number of tests actually run (see 02-symptom-insights.md §3.4,
 * INV-6: "m ... equals the number of tests RUN"). Defaults to `pValues.length`.
 */
export function benjaminiHochberg(
  pValues: number[],
  q: number,
  m: number = pValues.length,
): boolean[] {
  if (m < pValues.length) {
    throw new Error("benjaminiHochberg() requires m >= pValues.length");
  }
  const indexed = pValues.map((p, index) => ({ p, index }));
  const ranked = [...indexed].sort((a, b) => a.p - b.p);

  let cutoffRank = 0; // largest rank i (1-indexed) with p_(i) <= (i/m)*q
  for (let i = 0; i < ranked.length; i++) {
    const rank = i + 1;
    if (ranked[i].p <= (rank / m) * q) {
      cutoffRank = rank;
    }
  }

  const discoveries = new Array<boolean>(pValues.length).fill(false);
  for (let i = 0; i < cutoffRank; i++) {
    discoveries[ranked[i].index] = true;
  }
  return discoveries;
}

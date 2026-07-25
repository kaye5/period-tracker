/**
 * Symptom-pattern insight engine.
 *
 * Specification: docs/research/02-symptom-insights.md §E (§E.1 constants, §E.2 panel,
 * §E.3 core algorithm, §E.4 display strings, §E.5 invariants). §E.3 is complete,
 * runnable pseudocode and this file follows it literally; where a detail was left to the
 * implementation it is called out in a comment beginning "[choice]".
 *
 * The four load-bearing design decisions, none of which may be relaxed:
 *
 *  1. **Backward anchoring.** Anything premenstrual is measured backward from the NEXT
 *     period start, never forward from this one. The follicular phase varies far more
 *     than the luteal phase (§1.2: follicular 16.9 d [10–30] vs luteal 12.4 d [7–17]),
 *     so forward day 20 is 6 days before menses in a 26-day cycle and 14 days before it
 *     in a 34-day cycle. Forward-counting smears the premenstrual window across days
 *     that are not premenstrual. When a day is claimable by both a forward and a backward
 *     window, the BACKWARD assignment wins (Schmalenberger et al. 2021, §1.1).
 *
 *  2. **The unit of replication is the CYCLE, not the day** (§3.1). Days inside a cycle
 *     are strongly autocorrelated; 7 premenstrual days × 6 cycles is not 42 observations,
 *     it is 6. Each cycle collapses to a single rate difference and a single class.
 *
 *  3. **Direction is discovered, never assumed** (§5.1, INV-7). Only ~61% of people show
 *     the textbook premenstrual rise; 13–16% show the inverted mid-cycle pattern and 26%
 *     show none at all (Kiesner et al. 2022). The test is two-sided in spirit — it reports
 *     whichever direction leads — and "no pattern" is a first-class, shippable answer.
 *
 *  4. **The robustness gate is mandatory** (§4.4, INV-5). Every candidate is evaluated
 *     under BOTH missing-data treatments (unlogged = unknown, and unlogged = absent). It
 *     must clear the effect floor with the same direction under both, and the more
 *     conservative (larger) p-value is the one that goes forward. This is what kills the
 *     engagement artifact where a user logs more on the days they feel worse.
 *
 * SPEC.md R3: everything here is pure. No I/O, no clock, no randomness, no React. The
 * only "time" input is the cycle list, which already carries its own civil dates.
 * SPEC.md R1: every date is a CivilDate string; no `Date` is constructed anywhere here.
 */
import type { CivilDate } from "@/lib/date/civil";
import { addDays, compare, diffDays, rangeInclusive } from "@/lib/date/civil";
import type { Cycle, DayLog, Insight, SymptomId } from "@/lib/domain/types";
import { benjaminiHochberg, binomSf, median } from "@/lib/stat";
import {
  ALPHA_UNCORRECTED,
  COVERAGE_BALANCE_MAX,
  COVERAGE_MIN_CYCLE,
  COVERAGE_MIN_PRIMARY,
  COVERAGE_MIN_REFERENCE,
  CYCLE_LEN_ANOMALY_DELTA,
  CYCLE_LEN_MAX,
  CYCLE_LEN_MIN,
  DEADBAND,
  FDR_Q,
  MAX_CONSECUTIVE_UNLOGGED_DAYS,
  MAX_INSIGHTS_SHOWN,
  MIN_CYCLES_TO_SHOW_ANYTHING,
  MIN_DISTINCT_CYCLES,
  MIN_QUALIFYING_CYCLES_TO_CLAIM,
  MIN_RATE_DIFF,
  MIN_RATE_RATIO,
  MIN_TOTAL_OCCURRENCES,
  PRIMARY_WINDOW,
  REFERENCE_WINDOW,
  SYMPTOM_PANEL,
  testBudget,
  type CycleDayWindow,
} from "@/lib/engine/constants";
import {
  DID_NOT_REPLICATE,
  LOGGING_CAVEAT,
  NOT_ENOUGH_DATA_HEADLINE,
  NO_PATTERN_HEADLINE,
  descriptiveOnly,
  descriptiveOnlyHeadline,
  detailExpander,
  noPattern,
  notEnoughData,
  primaryPostmenstrualBody,
  primaryPostmenstrualHeadline,
  primaryPremenstrualBody,
  primaryPremenstrualHeadline,
} from "@/lib/copy/insights";

// ---------------------------------------------------------------------------
// Public shapes
// ---------------------------------------------------------------------------

export type InsightDirection = "premenstrual" | "postmenstrual";

/** How an unlogged day is treated in a denominator (§4.1). */
export type MissingDataTreatment = "unknown" | "absent";

export interface BuildInsightsInput {
  /** All cycles, in any order. Only completed ones (a known next period start) are used —
   * INV-4: a backward-anchored window is never computed on the in-progress cycle. */
  cycles: Cycle[];
  dayLogs: DayLog[];
  /** Ordered symptom panel; the test budget takes the first k eligible entries.
   * Defaults to the §E.2 default panel (Tier A + Tier B, 12 items). */
  panel?: readonly SymptomId[];
}

/** One arm of the robustness gate: the sign test evaluated under a single missing-data
 * treatment. */
export interface SignTestResult {
  symptom: SymptomId;
  missing: MissingDataTreatment;
  direction: InsightDirection;
  /** Cycles leaning premenstrual / leaning reference / neither. */
  kW: number;
  kR: number;
  ties: number;
  /** Cycles leaning in the reported direction. */
  k: number;
  /** Non-tie cycles — the effective sample size of the test. */
  n: number;
  /** Exact one-sided Pr(X >= k) for X ~ Binomial(n, 0.5). */
  p: number;
  /** Pooled day counts: a of A in the premenstrual window, b of B in the reference one. */
  a: number;
  A: number;
  b: number;
  B: number;
  rateRatio: number;
  rateDiff: number;
  replicatedLastCycle: boolean;
  passesEffectFloor: boolean;
}

/** What happened to one tested symptom, both arms and the gate verdict. */
export interface SymptomTestRecord {
  symptom: SymptomId;
  unknown: SignTestResult;
  absent: SignTestResult;
  survivedRobustnessGate: boolean;
  /** The conservative result carried forward (p = max of the two arms). Null when the
   * gate rejected it. */
  combined: SignTestResult | null;
  /** Set once Benjamini–Hochberg has run over the tests actually performed. */
  survivedFdr: boolean;
}

/** Observability for tests and for the "why am I seeing this" affordance. Nothing here
 * is user-facing copy. */
export interface InsightDiagnostics {
  completedCycles: number;
  qualifyingCycles: number;
  /** Fixed by the qualifying-cycle count BEFORE any test is evaluated (INV-6). */
  testBudget: number;
  /** The symptoms actually tested — panel order, eligibility pre-filtered, truncated to
   * the budget. */
  testedSymptoms: SymptomId[];
  /** m in the Benjamini–Hochberg correction: the number of tests RUN (INV-6). */
  m: number;
  records: SymptomTestRecord[];
}

export interface BuildInsightsOutput {
  insights: Insight[];
  diagnostics: InsightDiagnostics;
}

// ---------------------------------------------------------------------------
// Windows
// ---------------------------------------------------------------------------

/** Nominal length of a window in days — the denominator the §4.4 coverage thresholds are
 * written against ("≥ 5 of 7", "≥ 4 of 7"). Independent of how many days survive the
 * backward-wins and bleeding-day filters. */
function windowLength(w: CycleDayWindow): number {
  return Math.abs(w[2] - w[1]) + 1;
}

/**
 * The civil dates a window covers in a completed cycle, clipped to the cycle's own span
 * [start, nextStart − 1].
 *
 * Forward day +1 is the period start itself, so forward offset f maps to start + (f − 1).
 * Backward day −1 is the day before the next period starts, so backward offset b maps to
 * nextStart + b. This is the §1.4 table's convention exactly.
 */
function windowDates(start: CivilDate, nextStart: CivilDate, w: CycleDayWindow): CivilDate[] {
  const [direction, from, to] = w;
  const first =
    direction === "forward" ? addDays(start, from - 1) : addDays(nextStart, from);
  const last = direction === "forward" ? addDays(start, to - 1) : addDays(nextStart, to);
  const lastDayOfCycle = addDays(nextStart, -1);
  return rangeInclusive(first, last).filter(
    (d) => compare(d, start) >= 0 && compare(d, lastDayOfCycle) <= 0,
  );
}

/** A completed cycle with its two windows resolved. */
export interface WindowedCycle {
  cycle: Cycle;
  start: CivilDate;
  nextStart: CivilDate;
  lengthDays: number;
  /** Every civil date in [start, nextStart − 1]. */
  cycleDays: CivilDate[];
  /** Backward −7…−1, anchored on the NEXT period start. */
  primary: CivilDate[];
  /** Forward +4…+10, minus days the backward window already claimed (backward wins),
   * minus days with logged bleeding (§E.1: "exclude days with logged bleeding"). */
  reference: CivilDate[];
}

function hasLoggedBleeding(log: DayLog | undefined): boolean {
  return log !== undefined && log.bleeding !== "none";
}

function windowCycle(cycle: Cycle, logs: ReadonlyMap<string, DayLog>): WindowedCycle | null {
  const { startDate: start, nextStartDate: nextStart } = cycle;
  if (nextStart === null) return null;
  const lengthDays = diffDays(start, nextStart);
  if (lengthDays <= 0) return null;

  const primary = windowDates(start, nextStart, PRIMARY_WINDOW);
  const claimedByBackward = new Set<string>(primary);
  const reference = windowDates(start, nextStart, REFERENCE_WINDOW).filter(
    (d) => !claimedByBackward.has(d) && !hasLoggedBleeding(logs.get(d)),
  );

  return {
    cycle,
    start,
    nextStart,
    lengthDays,
    cycleDays: rangeInclusive(start, addDays(nextStart, -1)),
    primary,
    reference,
  };
}

/** Index day logs by their civil date. Exported because every other exported function
 * here takes the indexed form. */
export function indexDayLogs(dayLogs: readonly DayLog[]): ReadonlyMap<string, DayLog> {
  const m = new Map<string, DayLog>();
  for (const log of dayLogs) m.set(log.date, log);
  return m;
}

/**
 * Resolve one cycle's windows. Returns `null` for a cycle that is still in progress —
 * INV-4: a backward-anchored window needs a known next period start, so the current cycle
 * can never contribute to a premenstrual insight.
 */
export function resolveCycleWindows(
  cycle: Cycle,
  dayLogs: readonly DayLog[],
): WindowedCycle | null {
  return windowCycle(cycle, indexDayLogs(dayLogs));
}

// ---------------------------------------------------------------------------
// Coverage
// ---------------------------------------------------------------------------

function countLogged(dates: readonly CivilDate[], logs: ReadonlyMap<string, DayLog>): number {
  let n = 0;
  for (const d of dates) if (logs.has(d)) n += 1;
  return n;
}

/**
 * Fraction of a window that carries an explicit log entry, measured against the window's
 * NOMINAL length (7 for both windows here).
 *
 * [choice] §4.4 states the thresholds as "≥ 5 of 7" and "≥ 4 of 7". Dividing by the
 * nominal 7 rather than by the number of days left after the bleeding-day filter is the
 * conservative reading: a cycle whose period ran long enough to eat most of the reference
 * week cannot pass by having its two surviving days both logged.
 */
function windowCoverage(
  dates: readonly CivilDate[],
  logs: ReadonlyMap<string, DayLog>,
  w: CycleDayWindow,
): number {
  return countLogged(dates, logs) / windowLength(w);
}

/** Longest run of consecutive dates in the cycle with no log entry at all. */
function maxGapUnlogged(wc: WindowedCycle, logs: ReadonlyMap<string, DayLog>): number {
  let longest = 0;
  let run = 0;
  for (const d of wc.cycleDays) {
    if (logs.has(d)) {
      run = 0;
    } else {
      run += 1;
      if (run > longest) longest = run;
    }
  }
  return longest;
}

/** §E.3 `cycle_qualifies`. Every clause is a GATE_C / §4.4 threshold. */
export function cycleQualifies(
  wc: WindowedCycle,
  logs: ReadonlyMap<string, DayLog>,
  medianLengthDays: number,
): boolean {
  if (wc.lengthDays < CYCLE_LEN_MIN || wc.lengthDays > CYCLE_LEN_MAX) return false;
  if (wc.lengthDays > medianLengthDays + CYCLE_LEN_ANOMALY_DELTA) return false;
  if (maxGapUnlogged(wc, logs) > MAX_CONSECUTIVE_UNLOGGED_DAYS) return false;
  if (countLogged(wc.cycleDays, logs) / wc.lengthDays < COVERAGE_MIN_CYCLE) return false;
  const cw = windowCoverage(wc.primary, logs, PRIMARY_WINDOW);
  const cr = windowCoverage(wc.reference, logs, REFERENCE_WINDOW);
  if (cw < COVERAGE_MIN_PRIMARY) return false;
  if (cr < COVERAGE_MIN_REFERENCE) return false;
  if (Math.abs(cw - cr) > COVERAGE_BALANCE_MAX) return false;
  return true;
}

// ---------------------------------------------------------------------------
// Symptom eligibility (outcome-INDEPENDENT pre-filter, §3.4 item 1)
// ---------------------------------------------------------------------------

function symptomPresent(log: DayLog | undefined, s: SymptomId): boolean {
  return log !== undefined && log.symptoms.includes(s);
}

/**
 * §E.3 `symptom_eligible` / GATE_D. Counts every logged occurrence anywhere inside a
 * qualifying cycle, not just inside a window — the filter must not depend on where the
 * symptom fell, or it would stop being outcome-independent and would bias the FDR.
 */
export function symptomEligible(
  s: SymptomId,
  cycles: readonly WindowedCycle[],
  logs: ReadonlyMap<string, DayLog>,
): boolean {
  let occurrences = 0;
  let cyclesWith = 0;
  for (const wc of cycles) {
    let inThisCycle = 0;
    for (const d of wc.cycleDays) {
      if (symptomPresent(logs.get(d), s)) inThisCycle += 1;
    }
    occurrences += inThisCycle;
    if (inThisCycle > 0) cyclesWith += 1;
  }
  return occurrences >= MIN_TOTAL_OCCURRENCES && cyclesWith >= MIN_DISTINCT_CYCLES;
}

// ---------------------------------------------------------------------------
// The test
// ---------------------------------------------------------------------------

/**
 * Days with symptom `s` over days counted, under one missing-data treatment.
 *
 * "unknown": an unlogged day is dropped from the denominator entirely (§4.1 — unbiased
 * under MAR, which is why it is the primary treatment).
 * "absent": an unlogged day counts in the denominator as a negative. Deflates every rate,
 * and deflates it most where logging is sparsest — which is exactly why it is run as the
 * adversarial second arm of the robustness gate rather than on its own.
 */
function daysWith(
  s: SymptomId,
  dates: readonly CivilDate[],
  logs: ReadonlyMap<string, DayLog>,
  missing: MissingDataTreatment,
): { d: number; n: number } {
  let d = 0;
  let n = 0;
  for (const date of dates) {
    const log = logs.get(date);
    if (log === undefined) {
      if (missing === "absent") n += 1;
      continue;
    }
    n += 1;
    if (log.symptoms.includes(s)) d += 1;
  }
  return { d, n };
}

type CycleClass = "W" | "R" | "tie";

/**
 * §E.3 `evaluate` — paired, direction-agnostic exact sign test with the CYCLE as the unit.
 *
 * `cycles` must be ordered oldest-first: `replicatedLastCycle` reads the final element,
 * which is the user's most recent qualifying cycle (§3.4 item 5, the hold-out check).
 */
export function evaluateSymptom(
  s: SymptomId,
  cycles: readonly WindowedCycle[],
  logs: ReadonlyMap<string, DayLog>,
  missing: MissingDataTreatment,
): SignTestResult {
  const classes: CycleClass[] = [];
  let a = 0;
  let A = 0;
  let b = 0;
  let B = 0;

  for (const wc of cycles) {
    const w = daysWith(s, wc.primary, logs, missing);
    const r = daysWith(s, wc.reference, logs, missing);
    if (w.n === 0 || r.n === 0) continue;
    a += w.d;
    A += w.n;
    b += r.d;
    B += r.n;
    const d = w.d / w.n - r.d / r.n;
    classes.push(d >= DEADBAND ? "W" : d <= -DEADBAND ? "R" : "tie");
  }

  const kW = classes.filter((c) => c === "W").length;
  const kR = classes.filter((c) => c === "R").length;
  const ties = classes.length - kW - kR;
  const n = kW + kR;

  const empty: SignTestResult = {
    symptom: s,
    missing,
    direction: "premenstrual",
    kW,
    kR,
    ties,
    k: 0,
    n: 0,
    p: 1,
    a,
    A,
    b,
    B,
    rateRatio: 0,
    rateDiff: 0,
    replicatedLastCycle: false,
    passesEffectFloor: false,
  };
  if (n === 0) return empty;

  const direction: InsightDirection = kW >= kR ? "premenstrual" : "postmenstrual";
  const k = kW >= kR ? kW : kR;
  // Exact, one-sided Pr(X >= k) under the null "S has no systematic timing relative to
  // the period", where W-leaning and R-leaning are equally likely (§3.2). The null p=0.5
  // is not estimated from the data, which is what makes the test assumption-free.
  const p = binomSf(k, n, 0.5);

  const rateW = A > 0 ? a / A : 0;
  const rateR = B > 0 ? b / B : 0;
  const hi = direction === "premenstrual" ? rateW : rateR;
  const lo = direction === "premenstrual" ? rateR : rateW;
  const rateRatio = lo > 0 ? hi / lo : Number.POSITIVE_INFINITY;
  const rateDiff = hi - lo;

  const leadingClass: CycleClass = direction === "premenstrual" ? "W" : "R";
  const replicatedLastCycle =
    classes.length > 0 && classes[classes.length - 1] === leadingClass;

  return {
    ...empty,
    direction,
    k,
    n,
    p,
    rateRatio,
    rateDiff,
    replicatedLastCycle,
    // Both gates, together: unlikely by chance AND big enough to matter (§3.4 item 4).
    passesEffectFloor:
      p <= ALPHA_UNCORRECTED && rateRatio >= MIN_RATE_RATIO && rateDiff >= MIN_RATE_DIFF,
  };
}

// ---------------------------------------------------------------------------
// Supporting records ("view the records behind this")
// ---------------------------------------------------------------------------

function sortDates(dates: Iterable<CivilDate>): CivilDate[] {
  return [...new Set(dates)].sort(compare);
}

/**
 * The dates a card is built from. SPEC.md §4 and PRD §7 require every personalised
 * insight to be able to show the records behind it.
 *
 * [choice] For a claim card this is every *logged* day in either window across the
 * contributing cycles — the positives and the negatives. Returning only the days the
 * symptom appeared would show the numerator without the denominator, which is the exact
 * failure §8.4 rule 1 exists to prevent.
 */
function supportingDatesForClaim(
  cycles: readonly WindowedCycle[],
  logs: ReadonlyMap<string, DayLog>,
): CivilDate[] {
  const out: CivilDate[] = [];
  for (const wc of cycles) {
    for (const d of wc.primary) if (logs.has(d)) out.push(d);
    for (const d of wc.reference) if (logs.has(d)) out.push(d);
  }
  return sortDates(out);
}

// ---------------------------------------------------------------------------
// Card rendering
// ---------------------------------------------------------------------------

function renderClaim(
  r: SignTestResult,
  nq: number,
  cycles: readonly WindowedCycle[],
  logs: ReadonlyMap<string, DayLog>,
): Insight {
  const kOther = r.direction === "premenstrual" ? r.kR : r.kW;
  const counts = { symptom: r.symptom, k: r.k, n: r.n, kOther, nq };
  const headline =
    r.direction === "premenstrual"
      ? primaryPremenstrualHeadline(r.symptom)
      : primaryPostmenstrualHeadline(r.symptom);
  const claimBody =
    r.direction === "premenstrual"
      ? primaryPremenstrualBody(counts)
      : primaryPostmenstrualBody(counts);
  // Disconfirmation sits in the body at the same weight as the claim (§8.4 rule 2).
  const body = r.replicatedLastCycle ? claimBody : `${claimBody}\n\n${DID_NOT_REPLICATE}`;

  return {
    id: `symptom:${r.symptom}:${r.direction}`,
    headline,
    body,
    detail: `${detailExpander({ symptom: r.symptom, a: r.a, A: r.A, b: r.b, B: r.B })}\n\n${LOGGING_CAVEAT}`,
    supportingCycles: nq,
    supportingDates: supportingDatesForClaim(cycles, logs),
    replicatedLastCycle: r.replicatedLastCycle,
    kind: "symptom",
  };
}

function renderNoPattern(
  m: number,
  nq: number,
  cycles: readonly WindowedCycle[],
): Insight {
  return {
    id: "symptom:no_pattern",
    headline: NO_PATTERN_HEADLINE,
    body: noPattern(m, nq),
    detail: LOGGING_CAVEAT,
    supportingCycles: nq,
    supportingDates: sortDates(cycles.map((c) => c.start)),
    replicatedLastCycle: false,
    kind: "symptom",
  };
}

function renderNotEnoughData(n: number, cycles: readonly WindowedCycle[]): Insight {
  return {
    id: "symptom:not_enough_data",
    headline: NOT_ENOUGH_DATA_HEADLINE,
    body: notEnoughData(n),
    detail: LOGGING_CAVEAT,
    supportingCycles: n,
    supportingDates: sortDates(cycles.map((c) => c.start)),
    replicatedLastCycle: false,
    kind: "symptom",
  };
}

function renderDescriptive(
  s: SymptomId,
  k: number,
  nq: number,
  cycles: readonly WindowedCycle[],
  logs: ReadonlyMap<string, DayLog>,
): Insight {
  const dates: CivilDate[] = [];
  for (const wc of cycles) {
    for (const d of wc.primary) if (symptomPresent(logs.get(d), s)) dates.push(d);
  }
  return {
    id: `symptom:descriptive:${s}`,
    headline: descriptiveOnlyHeadline(s),
    body: descriptiveOnly(s, k, nq),
    detail: LOGGING_CAVEAT,
    supportingCycles: nq,
    supportingDates: sortDates(dates),
    replicatedLastCycle: false,
    kind: "symptom",
  };
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/**
 * Completed cycles, oldest first.
 *
 * INV-4: a cycle with no known next period start is in progress and can never carry a
 * backward-anchored window, so it is excluded here rather than guarded against later.
 * The visible UX consequence is deliberate: insights update at period onset, not
 * continuously (§1.4).
 *
 * `excluded_by_user` cycles are dropped too — [choice], but it follows from SPEC.md R7:
 * a user's explicit exclusion is a decision the engine must honour, not re-litigate. Every
 * other status (`skip_suspected`, `gap_unknown`) is left to the length and coverage gates,
 * which is where §2.3's anomaly handling belongs.
 */
function completedCycles(cycles: readonly Cycle[]): Cycle[] {
  return cycles
    .filter(
      (c) =>
        c.nextStartDate !== null &&
        c.status !== "in_progress" &&
        c.status !== "excluded_by_user",
    )
    .sort((a, b) => compare(a.startDate, b.startDate));
}

/** §E.3 `build_insights`, with the diagnostics the tests and the "why am I seeing this"
 * affordance need. */
export function buildInsightsWithDiagnostics(input: BuildInsightsInput): BuildInsightsOutput {
  const panel = input.panel ?? (SYMPTOM_PANEL as readonly SymptomId[]);
  const logs = indexDayLogs(input.dayLogs);

  const completed = completedCycles(input.cycles)
    .map((c) => windowCycle(c, logs))
    .filter((wc): wc is WindowedCycle => wc !== null);

  const emptyDiagnostics = (qualifying: number): InsightDiagnostics => ({
    completedCycles: completed.length,
    qualifyingCycles: qualifying,
    testBudget: 0,
    testedSymptoms: [],
    m: 0,
    records: [],
  });

  if (completed.length < MIN_CYCLES_TO_SHOW_ANYTHING) {
    return {
      insights: [renderNotEnoughData(completed.length, completed)],
      diagnostics: emptyDiagnostics(0),
    };
  }

  const medianLengthDays = median(completed.map((c) => c.lengthDays));
  const qualifying = completed.filter((wc) => cycleQualifies(wc, logs, medianLengthDays));
  const nq = qualifying.length;

  if (nq < MIN_QUALIFYING_CYCLES_TO_CLAIM) {
    // §2.4, the 3–4 qualifying-cycle tier: descriptive counts only, explicitly labelled
    // as too few. Never the word "pattern".
    return {
      insights: renderDescriptiveTier(qualifying, panel, logs, nq),
      diagnostics: emptyDiagnostics(nq),
    };
  }

  // INV-6: the budget is a function of the cycle count alone and is fixed here, before a
  // single test is evaluated. The default panel size IS the multiplicity control (§3.4).
  const budget = testBudget(nq);
  const tested = panel.filter((s) => symptomEligible(s, qualifying, logs)).slice(0, budget);
  const m = tested.length;

  if (m === 0) {
    return {
      insights: [renderNoPattern(0, nq, qualifying)],
      diagnostics: { ...emptyDiagnostics(nq), testBudget: budget },
    };
  }

  const records: SymptomTestRecord[] = tested.map((s) => {
    const unknown = evaluateSymptom(s, qualifying, logs, "unknown");
    const absent = evaluateSymptom(s, qualifying, logs, "absent");
    // ROBUSTNESS GATE (§4.4, INV-5): same direction and effect floor under both
    // treatments, and the more conservative p-value is the one that goes forward.
    const survived =
      unknown.passesEffectFloor &&
      absent.passesEffectFloor &&
      unknown.direction === absent.direction;
    return {
      symptom: s,
      unknown,
      absent,
      survivedRobustnessGate: survived,
      combined: survived ? { ...unknown, p: Math.max(unknown.p, absent.p) } : null,
      survivedFdr: false,
    };
  });

  const candidates: Array<{ record: SymptomTestRecord; combined: SignTestResult }> = [];
  for (const record of records) {
    if (record.combined !== null) candidates.push({ record, combined: record.combined });
  }
  // Benjamini–Hochberg at q = 0.10 over the tests ACTUALLY RUN — m is the number of
  // tests performed, not the number that survived the effect floor (INV-6).
  const discoveries = benjaminiHochberg(
    candidates.map((c) => c.combined.p),
    FDR_Q,
    m,
  );
  candidates.forEach((c, i) => {
    c.record.survivedFdr = discoveries[i];
  });

  const diagnostics: InsightDiagnostics = {
    completedCycles: completed.length,
    qualifyingCycles: nq,
    testBudget: budget,
    testedSymptoms: [...tested],
    m,
    records,
  };

  const survivors = candidates
    .filter((c) => c.record.survivedFdr)
    .map((c) => c.combined)
    .sort((x, y) => x.p - y.p)
    .slice(0, MAX_INSIGHTS_SHOWN);

  if (survivors.length === 0) {
    // INV-8: "we looked and found nothing" is a correct answer this app must be willing
    // to give. An app that only ever surfaces positives *is* the multiple-comparisons
    // problem made visible (§3.5).
    return { insights: [renderNoPattern(m, nq, qualifying)], diagnostics };
  }

  return {
    insights: survivors.map((r) => renderClaim(r, nq, qualifying, logs)),
    diagnostics,
  };
}

/**
 * The 3–4 qualifying-cycle tier. Counts, never claims. Ranked by how many cycles carried
 * the symptom premenstrually — [choice]: ranking is outcome-dependent, which would be
 * illegitimate for a *claim*, but these cards assert nothing beyond the counts they show,
 * and the alternative (panel order) would bury the only cards worth reading.
 */
function renderDescriptiveTier(
  qualifying: readonly WindowedCycle[],
  panel: readonly SymptomId[],
  logs: ReadonlyMap<string, DayLog>,
  nq: number,
): Insight[] {
  const scored = panel
    .filter((s) => symptomEligible(s, qualifying, logs))
    .map((s) => {
      let k = 0;
      for (const wc of qualifying) {
        if (wc.primary.some((d) => symptomPresent(logs.get(d), s))) k += 1;
      }
      return { symptom: s, k };
    })
    .filter((x) => x.k > 0)
    .sort((x, y) => y.k - x.k);

  if (scored.length === 0) {
    return [renderNotEnoughData(nq, qualifying)];
  }
  return scored
    .slice(0, MAX_INSIGHTS_SHOWN)
    .map((x) => renderDescriptive(x.symptom, x.k, nq, qualifying, logs));
}

/** §E.3 `build_insights`. Returns the cards only; use `buildInsightsWithDiagnostics` when
 * the bookkeeping is needed too. */
export function buildInsights(input: BuildInsightsInput): Insight[] {
  return buildInsightsWithDiagnostics(input).insights;
}

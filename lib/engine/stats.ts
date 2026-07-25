/**
 * History and statistics — `docs/research/01-cycle-prediction.md` §6 and pipeline STEP 6,
 * plus the descriptive (non-prediction) history requirements. Pure per SPEC.md R3: no I/O,
 * no clock, no randomness. Everything here is derived from `cycles` + `episodes` +
 * `dayLogs` only.
 *
 * THE RULE THAT SHAPES THIS FILE'S API (SPEC.md, agent E's brief): never emit an average
 * without its variation. Every summary statistic returns `StatSummary`
 * (`{ center, low, high, n }`, from `lib/domain/types.ts`) — never a bare number. A caller
 * that wants just a mean cannot get one from this module.
 *
 * SCOPE NOTE, so the boundary with agent B's `lib/engine/prediction.ts` is explicit: this
 * file computes *descriptive* statistics straight from the user's own recorded cycles (no
 * population prior, no age-based shrinkage). It deliberately does not reimplement the
 * Bayesian conjugate-predictive estimator (mu_post/sigma from STEP 3-4) — that machinery,
 * and the resulting `PredictionResult.predictedLengthDays`, is agent B's exclusive
 * responsibility. `typicalCycleLength` here is a plain median/range of the user's recent
 * cycle lengths, not `round(mu_post)`; see the final report for the full rationale.
 * Likewise, `predictedVsActualSeries` below reshapes an *already-resolved* prediction
 * history (agent B's `ResolvedPrediction`, `lib/engine/performance.ts`) for the accuracy
 * chart — it does not re-derive predictions itself, since a prediction's identity is what
 * was actually shown to the user, not something safe to recompute after the fact.
 *
 * WINDOW DEFINITIONS: "symptoms by cycle day" reuses the exact backward/forward window
 * tuples exported by `lib/engine/constants.ts` (`W_PREMENSTRUAL`, `W_MID_LUTEAL`,
 * `W_MENSTRUAL`, `W_FOLLICULAR_REF`), including the "backward wins on a tie" rule
 * (Schmalenberger et al. 2021, 02-symptom-insights.md §1.1) and the "never compute a
 * backward window on the in-progress cycle" rule (02-symptom-insights.md §1.4 / INV-4).
 * This module does not invent new windows or a new tie-break rule.
 */

import {
  addDays,
  compare,
  diffDays,
  rangeInclusive,
  type CivilDate,
} from "@/lib/date/civil";
import { median } from "@/lib/stat";
import {
  COVERAGE_MIN_CYCLE,
  MAX_CYCLE,
  MIN_CYCLE,
  SYMPTOM_PANEL,
  SYMPTOM_PANEL_TIER_C,
  W_FOLLICULAR_REF,
  W_MENSTRUAL,
  W_MID_LUTEAL,
  W_PREMENSTRUAL,
  WINDOW,
  type CycleDayWindow,
} from "@/lib/engine/constants";
import type {
  BleedingEpisode,
  Cycle,
  DayLog,
  FlowLevel,
  StatSummary,
  SymptomId,
} from "@/lib/domain/types";

// ============================================================================
// Regularity band — 01-cycle-prediction.md §6.4
// ============================================================================

export type RegularityBand = "very_consistent" | "typical_variation" | "high_variation";

/** S2/S18: median CLD <= 3 d -> "very consistent". */
export const REGULARITY_VERY_CONSISTENT_MAX_DAYS = 3;
/** S2/S18: median CLD 4-8 d -> "typical variation"; >= 9 d ("high variation") is the
 * S2/S18 threshold flagging 7.68% of ages 21-33 (S2) / ~23% of a broad adult cohort (S18). */
export const REGULARITY_TYPICAL_VARIATION_MAX_DAYS = 8;

/**
 * §6.4's three regularity bands, computed from the median consecutive cycle-length
 * difference (median CLD). Deliberately NOT an "irregular" badge — see the module
 * docstring in `lib/engine/insights.ts`-adjacent research: 42-46% of healthy women exceed
 * the FIGO 7-day range threshold (S8, S10), so a naive irregularity flag would fire for
 * roughly four users in ten. That clinical flag belongs to agent D (`lib/engine/health.ts`),
 * gated on FIGO frequency limits, not to this descriptive band.
 */
export function regularityBandFromMedianCld(medianCld: number): RegularityBand {
  if (medianCld <= REGULARITY_VERY_CONSISTENT_MAX_DAYS) return "very_consistent";
  if (medianCld <= REGULARITY_TYPICAL_VARIATION_MAX_DAYS) return "typical_variation";
  return "high_variation";
}

/**
 * "Edge cases by N" table (01-cycle-prediction.md, "RECOMMENDED ALGORITHM"): the FIGO
 * range and the regularity band are both display-gated at N >= 6 ("6-11: Full display ...
 * regularity band. Clinical note enabled"; "3-5: show range but not the regularity band").
 * Below 6, a single unlogged period can roughly double the shortest-to-longest span
 * (§6.3), so neither number is shown at all.
 */
export const MIN_USABLE_CYCLES_FOR_FIGO_RANGE = 6;
export const MIN_USABLE_CYCLES_FOR_REGULARITY_BAND = 6;

// ============================================================================
// "Usable" cycle/episode selection — mirrors STEP 2's post-skip-correction "usable" set
// ============================================================================

/**
 * The cycles this module is allowed to summarize: `status === 'ok'` (post-skip-correction
 * — excludes `skip_suspected`, `gap_unknown`, `excluded_by_user`, and the in-progress
 * cycle, which has no `lengthDays`), with a known length inside the validity bounds, most
 * recent `WINDOW` (12) of them — matching STEP 2's "usable = gaps with status == OK, most
 * recent WINDOW of them" and FIGO's 12-cycle window (S7).
 */
export function usableCyclesForStats(cycles: readonly Cycle[]): Cycle[] {
  return cycles
    .filter(
      (c): c is Cycle & { lengthDays: number } =>
        c.status === "ok" &&
        c.lengthDays !== null &&
        c.lengthDays >= MIN_CYCLE &&
        c.lengthDays <= MAX_CYCLE,
    )
    .slice()
    .sort((a, b) => compare(b.startDate, a.startDate))
    .slice(0, WINDOW);
}

function summarizeLengths(lengths: readonly number[]): StatSummary | null {
  if (lengths.length === 0) return null;
  return {
    center: median([...lengths]),
    low: Math.min(...lengths),
    high: Math.max(...lengths),
    n: lengths.length,
  };
}

/** Median of `|L_i - L_{i+1}|` over consecutive usable cycles, most-recent-first (S2, S18).
 * Returns null below 2 usable cycles (a difference needs at least two lengths). */
export function medianCycleLengthDifference(
  cycles: readonly Cycle[],
): { value: number; n: number } | null {
  const usable = usableCyclesForStats(cycles);
  if (usable.length < 2) return null;
  const lengths = usable.map((c) => c.lengthDays as number);
  const diffs: number[] = [];
  for (let i = 0; i + 1 < lengths.length; i++) {
    diffs.push(Math.abs(lengths[i] - lengths[i + 1]));
  }
  return { value: median(diffs), n: usable.length };
}

/**
 * "Over your last {n} cycles, your cycle length ranged from {low} to {high} days." — a
 * fact, not a verdict (§6.4). Null when `figoRange` itself is null (N < 6), so the caller
 * never has to remember the gate separately from the number.
 */
export function buildVariabilityHeadline(figoRange: StatSummary | null): string | null {
  if (figoRange === null) return null;
  return `Over your last ${figoRange.n} cycles, your cycle length ranged from ${figoRange.low} to ${figoRange.high} days.`;
}

// ============================================================================
// Period duration
// ============================================================================

function usableEpisodeDurations(episodes: readonly BleedingEpisode[]): BleedingEpisode[] {
  return episodes
    .filter((e): e is BleedingEpisode & { durationDays: number } => e.durationDays !== null)
    .slice()
    .sort((a, b) => compare(b.startDate, a.startDate))
    .slice(0, WINDOW);
}

function computePeriodDuration(episodes: readonly BleedingEpisode[]): StatSummary | null {
  const usable = usableEpisodeDurations(episodes);
  if (usable.length === 0) return null;
  return summarizeLengths(usable.map((e) => e.durationDays as number));
}

// ============================================================================
// Flow pattern by period day, and heavy-flow day identification
// ============================================================================

export interface FlowPatternDay {
  /** 1-indexed day within the bleeding episode (1 = the episode's first logged day). */
  periodDay: number;
  flowCounts: Record<FlowLevel, number>;
  /** Days at this offset with an explicit flow level logged (the denominator). */
  loggedDayCount: number;
  /** flow === 'heavy' | 'very_heavy' at this offset. */
  heavyOrHigherCount: number;
}

function emptyFlowCounts(): Record<FlowLevel, number> {
  return { spotting: 0, light: 0, medium: 0, heavy: 0, very_heavy: 0 };
}

function computeFlowPattern(
  episodes: readonly BleedingEpisode[],
  dayLogsByDate: ReadonlyMap<CivilDate, DayLog>,
): FlowPatternDay[] {
  const byOffset = new Map<number, FlowPatternDay>();
  for (const ep of episodes) {
    const days = [...ep.menstrualDays, ...ep.spottingDays].sort(compare);
    for (const date of days) {
      const offset = diffDays(ep.startDate, date) + 1;
      const log = dayLogsByDate.get(date);
      let entry = byOffset.get(offset);
      if (!entry) {
        entry = {
          periodDay: offset,
          flowCounts: emptyFlowCounts(),
          loggedDayCount: 0,
          heavyOrHigherCount: 0,
        };
        byOffset.set(offset, entry);
      }
      const flow = log?.flow;
      if (flow !== undefined) {
        entry.flowCounts[flow] += 1;
        entry.loggedDayCount += 1;
        if (flow === "heavy" || flow === "very_heavy") entry.heavyOrHigherCount += 1;
      }
    }
  }
  return [...byOffset.values()].sort((a, b) => a.periodDay - b.periodDay);
}

/** Dates on which flow was logged as `heavy` or `very_heavy`, chronological. This is a
 * count of recorded flow levels, not a clinical judgment — INV-10-style caution (never
 * assert "heavy" as a fact beyond what was logged) belongs to how the UI phrases it. */
function computeHeavyFlowDays(dayLogs: readonly DayLog[]): CivilDate[] {
  return dayLogs
    .filter((l) => l.flow === "heavy" || l.flow === "very_heavy")
    .map((l) => l.date)
    .sort(compare);
}

// ============================================================================
// Cycle-index assignment — used by symptom frequency's "distinct cycles" denominator
// ============================================================================

/** Which cycle (by `Cycle.index`) a date falls in, or null if it precedes every recorded
 * cycle. Cycles are assumed to partition the timeline: `[startDate, nextStartDate)`, or
 * `[startDate, +inf)` for the in-progress cycle (`nextStartDate === null`). */
function assignCycleIndex(date: CivilDate, cyclesAscending: readonly Cycle[]): number | null {
  for (const c of cyclesAscending) {
    const afterStart = compare(date, c.startDate) >= 0;
    const beforeNext = c.nextStartDate === null || compare(date, c.nextStartDate) < 0;
    if (afterStart && beforeNext) return c.index;
  }
  return null;
}

// ============================================================================
// Symptom frequency (purely descriptive counts — no significance testing; that is agent
// C's job in lib/engine/insights.ts)
// ============================================================================

export interface SymptomFrequency {
  symptom: SymptomId;
  /** Total days this symptom was logged as present. */
  occurrences: number;
  /** Distinct cycles (by index) with at least one logged occurrence. */
  cyclesWithOccurrence: number;
  /** Days where this symptom's presence/absence is actually known: either it was
   * logged present, or the day was marked `nothingToReport` (a confirmed negative). A
   * day with an empty `symptoms` array and no `nothingToReport` flag is *unknown* for
   * this symptom, per `DayLog.symptoms`'s own doc comment, and is excluded here. */
  knownDays: number;
  /** Distinct cycles (by index) contributing at least one known day. */
  cyclesConsidered: number;
}

const ALL_SYMPTOMS: readonly SymptomId[] = [...SYMPTOM_PANEL, ...SYMPTOM_PANEL_TIER_C];

function computeSymptomFrequency(
  cycles: readonly Cycle[],
  dayLogs: readonly DayLog[],
): SymptomFrequency[] {
  const cyclesAscending = [...cycles].sort((a, b) => compare(a.startDate, b.startDate));

  const occurrences = new Map<SymptomId, number>();
  const knownDays = new Map<SymptomId, number>();
  const occurrenceCycles = new Map<SymptomId, Set<number>>();
  const consideredCycles = new Map<SymptomId, Set<number>>();
  for (const s of ALL_SYMPTOMS) {
    occurrences.set(s, 0);
    knownDays.set(s, 0);
    occurrenceCycles.set(s, new Set());
    consideredCycles.set(s, new Set());
  }

  for (const log of dayLogs) {
    const cycleIndex = assignCycleIndex(log.date, cyclesAscending);
    const isKnownNegativeDay = log.nothingToReport === true;
    for (const s of ALL_SYMPTOMS) {
      const present = log.symptoms.includes(s);
      const known = present || isKnownNegativeDay;
      if (!known) continue;
      knownDays.set(s, (knownDays.get(s) ?? 0) + 1);
      if (cycleIndex !== null) consideredCycles.get(s)!.add(cycleIndex);
      if (present) {
        occurrences.set(s, (occurrences.get(s) ?? 0) + 1);
        if (cycleIndex !== null) occurrenceCycles.get(s)!.add(cycleIndex);
      }
    }
  }

  return ALL_SYMPTOMS.map((s) => ({
    symptom: s,
    occurrences: occurrences.get(s) ?? 0,
    cyclesWithOccurrence: occurrenceCycles.get(s)?.size ?? 0,
    knownDays: knownDays.get(s) ?? 0,
    cyclesConsidered: consideredCycles.get(s)?.size ?? 0,
  }));
}

// ============================================================================
// Symptoms by cycle day — backward-anchored where constants.ts says so
// ============================================================================

export type CycleDayWindowLabel = "premenstrual" | "mid_luteal" | "menstrual" | "follicular_reference";

interface LabeledWindow {
  label: CycleDayWindowLabel;
  window: CycleDayWindow;
}

/** Backward windows (anchored on the NEXT period start) checked first — "backward wins on
 * a tie" (Schmalenberger et al. 2021). `W_PREMENSTRUAL_ACOG` and `W_PERIOVULATORY` are
 * deliberately excluded: the ACOG window is a narrow subset of `W_PREMENSTRUAL` (secondary,
 * per constants.ts), and the periovulatory window is "OFF by default" per
 * 02-symptom-insights.md §1.4 (lowest confidence, inherits luteal-length error). */
const BACKWARD_WINDOWS: readonly LabeledWindow[] = [
  { label: "premenstrual", window: W_PREMENSTRUAL },
  { label: "mid_luteal", window: W_MID_LUTEAL },
];

/** Forward windows (anchored on THIS period start), checked only when no backward window
 * claims the day. */
const FORWARD_WINDOWS: readonly LabeledWindow[] = [
  { label: "menstrual", window: W_MENSTRUAL },
  { label: "follicular_reference", window: W_FOLLICULAR_REF },
];

/**
 * Classify a single day within a completed cycle into one of the windows above, or null
 * if it falls in none of them (e.g. the ovulatory "gap" between the follicular reference
 * window and the premenstrual window — legitimately unclassified in this descriptive
 * view, matching the research's low confidence there).
 *
 * Returns null unconditionally for the in-progress cycle (`nextStartDate === null`):
 * "Every window is defined on a completed cycle" (02-symptom-insights.md §1.4), and a
 * backward window computed against a not-yet-known next start would be meaningless.
 */
function classifyCycleDay(
  cycle: Cycle,
  date: CivilDate,
  isBleedingDay: boolean,
): { label: CycleDayWindowLabel; offset: number } | null {
  if (cycle.nextStartDate === null) return null;

  const backwardOffset = diffDays(cycle.nextStartDate, date); // negative before next start
  for (const { label, window } of BACKWARD_WINDOWS) {
    const [, lo, hi] = window;
    if (backwardOffset >= lo && backwardOffset <= hi) return { label, offset: backwardOffset };
  }

  const forwardOffset = diffDays(cycle.startDate, date) + 1;
  for (const { label, window } of FORWARD_WINDOWS) {
    const [, lo, hi] = window;
    if (forwardOffset < lo || forwardOffset > hi) continue;
    if (label === "follicular_reference" && isBleedingDay) return null; // "excluding days with logged bleeding"
    return { label, offset: forwardOffset };
  }

  return null;
}

export interface SymptomCycleDayPoint {
  symptom: SymptomId;
  window: CycleDayWindowLabel;
  /** Signed cycle-day offset: negative for backward windows, positive for forward. */
  offset: number;
  occurrences: number;
  /** Days at this exact offset where presence/absence of `symptom` is known (see
   * `SymptomFrequency.knownDays` for the same rule). */
  knownDays: number;
}

function computeSymptomsByCycleDay(
  cycles: readonly Cycle[],
  dayLogs: readonly DayLog[],
): SymptomCycleDayPoint[] {
  const byDate = new Map<CivilDate, DayLog>();
  for (const log of dayLogs) byDate.set(log.date, log);

  type Key = string;
  const key = (s: SymptomId, label: CycleDayWindowLabel, offset: number): Key =>
    `${s}|${label}|${offset}`;
  const occurrences = new Map<Key, number>();
  const knownDays = new Map<Key, number>();

  for (const cycle of cycles) {
    if (cycle.nextStartDate === null) continue;
    const lastDay = addDays(cycle.nextStartDate, -1);
    if (compare(lastDay, cycle.startDate) < 0) continue; // zero-length guard
    for (const date of rangeInclusive(cycle.startDate, lastDay)) {
      const log = byDate.get(date);
      const isBleedingDay = log !== undefined && log.bleeding !== "none";
      const classification = classifyCycleDay(cycle, date, isBleedingDay);
      if (classification === null || log === undefined) continue;

      const isKnownNegativeDay = log.nothingToReport === true;
      for (const s of ALL_SYMPTOMS) {
        const present = log.symptoms.includes(s);
        const known = present || isKnownNegativeDay;
        if (!known) continue;
        const k = key(s, classification.label, classification.offset);
        knownDays.set(k, (knownDays.get(k) ?? 0) + 1);
        if (present) occurrences.set(k, (occurrences.get(k) ?? 0) + 1);
      }
    }
  }

  const points: SymptomCycleDayPoint[] = [];
  for (const s of ALL_SYMPTOMS) {
    for (const { label, window } of [...BACKWARD_WINDOWS, ...FORWARD_WINDOWS]) {
      const [, lo, hi] = window;
      for (let offset = lo; offset <= hi; offset++) {
        const k = key(s, label, offset);
        const known = knownDays.get(k) ?? 0;
        if (known === 0) continue; // omit rather than show a fake zero for unobserved offsets
        points.push({ symptom: s, window: label, offset, occurrences: occurrences.get(k) ?? 0, knownDays: known });
      }
    }
  }
  return points;
}

// ============================================================================
// Missing-data indicators
// ============================================================================

export interface MissingDataIndicator {
  cycleIndex: number;
  startDate: CivilDate;
  totalDays: number;
  loggedDays: number;
  /** loggedDays / totalDays. */
  coverage: number;
  /** `coverage >= COVERAGE_MIN_CYCLE` (02-symptom-insights.md §2.4's generic "at least half
   * the cycle logged" floor, reused here as the honest-partial-data threshold for the
   * history view — not a re-derivation of agent C's cycle-qualification gates, which also
   * check window-specific coverage balance for hypothesis testing). */
  sufficientData: boolean;
}

function computeMissingDataIndicators(
  cycles: readonly Cycle[],
  dayLogs: readonly DayLog[],
): MissingDataIndicator[] {
  const loggedDates = new Set(dayLogs.map((l) => l.date));
  const out: MissingDataIndicator[] = [];
  for (const cycle of cycles) {
    if (cycle.nextStartDate === null || cycle.lengthDays === null) continue;
    const lastDay = addDays(cycle.nextStartDate, -1);
    if (compare(lastDay, cycle.startDate) < 0) continue;
    const days = rangeInclusive(cycle.startDate, lastDay);
    const loggedDays = days.filter((d) => loggedDates.has(d)).length;
    const totalDays = days.length;
    const coverage = totalDays === 0 ? 0 : loggedDays / totalDays;
    out.push({
      cycleIndex: cycle.index,
      startDate: cycle.startDate,
      totalDays,
      loggedDays,
      coverage,
      sufficientData: coverage >= COVERAGE_MIN_CYCLE,
    });
  }
  return out.sort((a, b) => compare(b.startDate, a.startDate));
}

// ============================================================================
// Predicted vs actual series — reshapes agent B's resolved-prediction history for the
// accuracy chart. See the module docstring for why this does not re-derive predictions.
// ============================================================================

/** The subset of `lib/engine/performance.ts`'s `ResolvedPrediction` this module needs.
 * Structural (not imported), so this file has no compile-time dependency on agent B's
 * file — any object with these fields (including a real `ResolvedPrediction`) satisfies
 * this shape. */
export interface ResolvedPredictionLike {
  anchorStart: CivilDate;
  predictedStart: CivilDate;
  actualStart: CivilDate;
  signedErrorDays: number;
  insideWindow: boolean;
}

export interface PredictedVsActualPoint extends ResolvedPredictionLike {
  /** 0 = oldest resolved prediction, increasing with time — the chart's x-axis order. */
  cycleIndex: number;
}

/** Chart-ready predicted-vs-actual series, chronological with a stable index. Pure
 * reshaping: no prediction logic lives here. */
export function predictedVsActualSeries(
  resolved: readonly ResolvedPredictionLike[],
): PredictedVsActualPoint[] {
  return [...resolved]
    .sort((a, b) => compare(a.anchorStart, b.anchorStart))
    .map((r, cycleIndex) => ({ ...r, cycleIndex }));
}

// ============================================================================
// Top-level aggregator
// ============================================================================

export interface StatsInput {
  cycles: readonly Cycle[];
  episodes: readonly BleedingEpisode[];
  dayLogs: readonly DayLog[];
}

export interface CycleStatistics {
  completedCycleCount: number;
  /** Descriptive median/range of the user's own recent usable cycle lengths. Available
   * from N = 1 usable cycle (at N = 1, low = high = center: a single data point has no
   * spread yet, which the UI should read as "no variability display" per the N=1 row of
   * the "Edge cases by N" table — not as a claim of perfect consistency). */
  typicalCycleLength: StatSummary | null;
  /** The FIGO shortest-to-longest measure (S7), same underlying usable-cycle set as
   * `typicalCycleLength`, gated to N >= 6 per §6.3/§6.4 (a single unlogged period roughly
   * doubles this number below that). */
  figoRange: StatSummary | null;
  /** "Over your last {n} cycles, your cycle length ranged from {low} to {high} days." —
   * null exactly when `figoRange` is null. */
  variabilityHeadline: string | null;
  medianCycleLengthDifference: number | null;
  /** Gated to N >= 6 usable cycles, same as `figoRange` — never an "irregular" badge. */
  regularityBand: RegularityBand | null;
  periodDuration: StatSummary | null;
  flowPattern: FlowPatternDay[];
  heavyFlowDays: CivilDate[];
  heavyFlowDayCount: number;
  symptomFrequency: SymptomFrequency[];
  symptomsByCycleDay: SymptomCycleDayPoint[];
  missingDataIndicators: MissingDataIndicator[];
}

export function computeCycleStatistics(input: StatsInput): CycleStatistics {
  const { cycles, episodes, dayLogs } = input;

  const completedCycleCount = cycles.filter((c) => c.lengthDays !== null).length;

  const usable = usableCyclesForStats(cycles);
  const typicalCycleLength = summarizeLengths(usable.map((c) => c.lengthDays as number));
  const figoRange =
    usable.length >= MIN_USABLE_CYCLES_FOR_FIGO_RANGE ? typicalCycleLength : null;
  const variabilityHeadline = buildVariabilityHeadline(figoRange);

  const cld = medianCycleLengthDifference(cycles);
  const regularityBand =
    cld !== null && cld.n >= MIN_USABLE_CYCLES_FOR_REGULARITY_BAND
      ? regularityBandFromMedianCld(cld.value)
      : null;

  const periodDuration = computePeriodDuration(episodes);

  const dayLogsByDate = new Map<CivilDate, DayLog>();
  for (const log of dayLogs) dayLogsByDate.set(log.date, log);
  const flowPattern = computeFlowPattern(episodes, dayLogsByDate);
  const heavyFlowDays = computeHeavyFlowDays(dayLogs);

  const symptomFrequency = computeSymptomFrequency(cycles, dayLogs);
  const symptomsByCycleDay = computeSymptomsByCycleDay(cycles, dayLogs);
  const missingDataIndicators = computeMissingDataIndicators(cycles, dayLogs);

  return {
    completedCycleCount,
    typicalCycleLength,
    figoRange,
    variabilityHeadline,
    medianCycleLengthDifference: cld?.value ?? null,
    regularityBand,
    periodDuration,
    flowPattern,
    heavyFlowDays,
    heavyFlowDayCount: heavyFlowDays.length,
    symptomFrequency,
    symptomsByCycleDay,
    missingDataIndicators,
  };
}

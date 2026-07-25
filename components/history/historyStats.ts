/**
 * Pure view-model builders for the History screen's statistics section (agent U4;
 * SPEC.md's U4 brief: "render the statistics, every one WITH its variation — the
 * engine's stats return {center, low, high, n} — show all of it ... never a lone
 * center"). Every function here takes `lib/engine/stats.ts`'s `CycleStatistics` shape
 * (reached through `EngineResult.stats`) and reshapes it into display-ready strings and
 * rows — no rendering, no I/O, so it is unit-testable without a DOM.
 *
 * None of the strings built here claim anything about the user's body beyond restating
 * the numbers the engine already computed (SPEC.md R9 governs *claims*, not restated
 * counts) — same posture as `lib/engine/stats.ts`'s own `buildVariabilityHeadline`.
 */
import type { CivilDate } from "@/lib/date/civil";
import type { StatSummary, SymptomId } from "@/lib/domain/types";
import type {
  CycleStatistics,
  FlowPatternDay,
  MissingDataIndicator,
  RegularityBand,
  SymptomCycleDayPoint,
  SymptomFrequency,
} from "@/lib/engine/stats";
import { symptomLabel } from "@/lib/copy/insights";
import { formatCivilDate, formatDayRange, formatPercent, pluralize } from "@/components/charts/format";

// ============================================================================
// Cycle length / period duration — "typical X days, recent range Y-Z"
// ============================================================================

export interface StatDisplay {
  /** "Typical cycle length: 30 days" — the center, always paired with the range. */
  headline: string;
  /** "Recent range: 27–34 days (last 8 cycles)" — null center never shown alone. */
  rangeText: string;
  n: number;
}

/** Builds `{headline, rangeText}` from a `StatSummary`, or null when the engine hasn't
 * emitted one yet (not enough usable cycles — the caller renders the honest empty
 * state instead, per the "Edge cases by N" table). */
export function summarizeStat(
  stat: StatSummary | null,
  label: string,
  unit = "days",
): StatDisplay | null {
  if (stat === null) return null;
  const centerRounded = Math.round(stat.center);
  const headline = `${label}: ${centerRounded} ${pluralize(centerRounded, unit.replace(/s$/, ""))}`;
  const rangeText =
    stat.low === stat.high
      ? `Only ${stat.n} ${pluralize(stat.n, "cycle")} recorded so far — a range will show once you have more.`
      : `Recent range: ${formatDayRange(stat.low, stat.high)} (last ${stat.n} ${pluralize(stat.n, "cycle")})`;
  return { headline, rangeText, n: stat.n };
}

export function cycleLengthDisplay(stat: StatSummary | null): StatDisplay | null {
  return summarizeStat(stat, "Typical cycle length");
}

export function periodDurationDisplay(stat: StatSummary | null): StatDisplay | null {
  return summarizeStat(stat, "Typical period length");
}

// ============================================================================
// Compact stat-tile display — for the History screen's `StatsStrip` (a label already
// sits above the tile, so unlike `summarizeStat` above, neither string repeats it).
// Same "never a lone center" posture: the range and n are always in `sub`.
// ============================================================================

export interface StatTileDisplay {
  /** "30 days" — no label prefix, the tile's own label sits above it. */
  value: string;
  /** "27–34 · 8 cycles" — center's range and n, always together. */
  sub: string;
}

export function statTileDisplay(
  stat: StatSummary | null,
  unit = "days",
  /** What `n` counts — "cycle" for cycle stats, "period" for episode stats (a period
   * duration's n is a count of periods, not cycles). */
  noun = "cycle",
): StatTileDisplay | null {
  if (stat === null) return null;
  const centerRounded = Math.round(stat.center);
  const value = `${centerRounded} ${pluralize(centerRounded, unit.replace(/s$/, ""))}`;
  const sub =
    stat.low === stat.high
      ? `Only ${stat.n} ${pluralize(stat.n, noun)} recorded so far`
      : `${stat.low}–${stat.high} · ${stat.n} ${pluralize(stat.n, noun)}`;
  return { value, sub };
}

// ============================================================================
// FIGO range + regularity band (both N>=6 gated by the engine already — a null here
// means "not shown", never "zero")
// ============================================================================

export const REGULARITY_BAND_LABEL: Record<RegularityBand, string> = {
  very_consistent: "Very consistent",
  typical_variation: "Typical variation",
  high_variation: "High variation",
};

export interface VariabilityDisplay {
  headline: string; // the engine's own variabilityHeadline, restated verbatim
  bandLabel: string | null;
}

export function variabilityDisplay(
  figoRange: StatSummary | null,
  variabilityHeadline: string | null,
  regularityBand: RegularityBand | null,
): VariabilityDisplay | null {
  if (figoRange === null || variabilityHeadline === null) return null;
  return {
    headline: variabilityHeadline,
    bandLabel: regularityBand === null ? null : REGULARITY_BAND_LABEL[regularityBand],
  };
}

// ============================================================================
// Flow pattern + heavy-flow days
// ============================================================================

export interface FlowPatternSummary {
  daysWithLoggedFlow: number;
  heavyFlowDayCount: number;
  heavyFlowDates: CivilDate[];
  heavyFlowDatesText: string;
}

export function flowPatternSummary(
  flowPattern: readonly FlowPatternDay[],
  heavyFlowDays: readonly CivilDate[],
): FlowPatternSummary {
  const daysWithLoggedFlow = flowPattern.reduce((sum, d) => sum + d.loggedDayCount, 0);
  return {
    daysWithLoggedFlow,
    heavyFlowDayCount: heavyFlowDays.length,
    heavyFlowDates: [...heavyFlowDays],
    heavyFlowDatesText:
      heavyFlowDays.length === 0
        ? "No heavy-flow days recorded yet."
        : heavyFlowDays.map(formatCivilDate).join(", "),
  };
}

// ============================================================================
// Symptom frequency table
// ============================================================================

export interface SymptomFrequencyRow {
  symptom: SymptomId;
  label: string;
  occurrences: number;
  knownDays: number;
  cyclesWithOccurrence: number;
  cyclesConsidered: number;
  /** occurrences / knownDays, null when knownDays is 0 (never observed at all — the row
   * is omitted by `symptomFrequencyRows` below rather than shown as a fake 0%). */
  rateText: string;
}

/** Rows for symptoms that were actually observed at least once (present or explicitly
 * "nothing to report"), most-frequent-first. A symptom never logged at all is omitted
 * rather than shown as a misleading "0 of 0" row. */
export function symptomFrequencyRows(
  frequencies: readonly SymptomFrequency[],
): SymptomFrequencyRow[] {
  return frequencies
    .filter((f) => f.knownDays > 0)
    .map((f) => ({
      symptom: f.symptom,
      label: symptomLabel(f.symptom),
      occurrences: f.occurrences,
      knownDays: f.knownDays,
      cyclesWithOccurrence: f.cyclesWithOccurrence,
      cyclesConsidered: f.cyclesConsidered,
      rateText: `${f.occurrences} of ${f.knownDays} known days (${formatPercent(f.occurrences / f.knownDays)}), across ${f.cyclesWithOccurrence} of ${f.cyclesConsidered} ${pluralize(f.cyclesConsidered, "cycle")}`,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.label.localeCompare(b.label));
}

// ============================================================================
// Symptoms by cycle day
// ============================================================================

const WINDOW_LABEL: Record<SymptomCycleDayPoint["window"], string> = {
  premenstrual: "Premenstrual (days -7 to -1 before your next period)",
  mid_luteal: "Mid-luteal (days -11 to -8 before your next period)",
  menstrual: "Menstrual (days 1-4 of your period)",
  follicular_reference: "Follicular reference (days 4-10, excluding bleeding days)",
};

export interface SymptomByCycleDayRow {
  symptom: SymptomId;
  label: string;
  window: SymptomCycleDayPoint["window"];
  windowLabel: string;
  occurrences: number;
  knownDays: number;
  rateText: string;
}

/** Collapses the engine's per-offset points into one row per (symptom, window) pair —
 * the offset-level detail is more precision than a history table needs; the insight
 * engine (`lib/engine/insights.ts`) is where offset-level significance testing lives. */
export function symptomsByCycleDayRows(
  points: readonly SymptomCycleDayPoint[],
): SymptomByCycleDayRow[] {
  const byKey = new Map<string, { symptom: SymptomId; window: SymptomCycleDayPoint["window"]; occurrences: number; knownDays: number }>();
  for (const p of points) {
    const key = `${p.symptom}|${p.window}`;
    const existing = byKey.get(key);
    if (existing) {
      existing.occurrences += p.occurrences;
      existing.knownDays += p.knownDays;
    } else {
      byKey.set(key, { symptom: p.symptom, window: p.window, occurrences: p.occurrences, knownDays: p.knownDays });
    }
  }
  return [...byKey.values()]
    .filter((row) => row.knownDays > 0)
    .map((row) => ({
      symptom: row.symptom,
      label: symptomLabel(row.symptom),
      window: row.window,
      windowLabel: WINDOW_LABEL[row.window],
      occurrences: row.occurrences,
      knownDays: row.knownDays,
      rateText: `${row.occurrences} of ${row.knownDays} known days (${formatPercent(row.occurrences / row.knownDays)})`,
    }))
    .sort((a, b) => b.occurrences - a.occurrences || a.label.localeCompare(b.label));
}

// ============================================================================
// Missing-data indicators
// ============================================================================

export interface MissingDataRow {
  cycleIndex: number;
  startDate: CivilDate;
  startDateText: string;
  coverageText: string;
  sufficientData: boolean;
}

/** Only the cycles the engine flagged as under-logged (SPEC.md's U4 brief: "missing-data
 * indicators" — a cycle with full coverage has nothing to flag here). */
export function missingDataRows(indicators: readonly MissingDataIndicator[]): MissingDataRow[] {
  return indicators
    .filter((i) => !i.sufficientData)
    .map((i) => ({
      cycleIndex: i.cycleIndex,
      startDate: i.startDate,
      startDateText: formatCivilDate(i.startDate),
      coverageText: `${i.loggedDays} of ${i.totalDays} days logged (${formatPercent(i.coverage)})`,
      sufficientData: i.sufficientData,
    }));
}

// ============================================================================
// Top-level aggregator — everything the History stats panel needs, precomputed once
// ============================================================================

export interface HistoryStatsViewModel {
  completedCycleCountText: string;
  cycleLength: StatDisplay | null;
  periodDuration: StatDisplay | null;
  variability: VariabilityDisplay | null;
  flow: FlowPatternSummary;
  symptomFrequency: SymptomFrequencyRow[];
  symptomsByCycleDay: SymptomByCycleDayRow[];
  missingData: MissingDataRow[];
}

export function buildHistoryStatsViewModel(stats: CycleStatistics): HistoryStatsViewModel {
  return {
    completedCycleCountText: `${stats.completedCycleCount} completed ${pluralize(stats.completedCycleCount, "cycle")} recorded`,
    cycleLength: cycleLengthDisplay(stats.typicalCycleLength),
    periodDuration: periodDurationDisplay(stats.periodDuration),
    variability: variabilityDisplay(stats.figoRange, stats.variabilityHeadline, stats.regularityBand),
    flow: flowPatternSummary(stats.flowPattern, stats.heavyFlowDays),
    symptomFrequency: symptomFrequencyRows(stats.symptomFrequency),
    symptomsByCycleDay: symptomsByCycleDayRows(stats.symptomsByCycleDay),
    missingData: missingDataRows(stats.missingDataIndicators),
  };
}

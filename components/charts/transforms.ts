/**
 * Pure chart-data shaping (agent U4). Every function here takes the engine's own output
 * shapes (`Cycle`, `BleedingEpisode`, `DayLog`, `FlowPatternDay`, `PredictedVsActualPoint`
 * — SPEC.md §3 / `lib/engine/stats.ts`) and reshapes them for one of the five required
 * charts (SPEC.md's U4 brief: "cycle length by month, period duration by month, symptom
 * timeline, flow by period day, predicted vs actual"). No rendering, no I/O, no `Date`
 * construction (dates are sliced as civil-date strings, never parsed into `Date` objects
 * — R1 reserves that to `lib/date/civil.ts`) — so this module is unit-testable without a
 * DOM and without a chart library.
 */
import { compare, diffDays, type CivilDate } from "@/lib/date/civil";
import type {
  BleedingEpisode,
  Cycle,
  CycleStatus,
  DayLog,
  FlowLevel,
  SymptomId,
} from "@/lib/domain/types";
import type { FlowPatternDay } from "@/lib/engine/stats";
import { monthKey, monthKeyLabel } from "@/components/charts/format";

// ============================================================================
// Cycle length by month
// ============================================================================

export interface CycleLengthPoint {
  startDate: CivilDate;
  lengthDays: number;
  status: CycleStatus;
}

export interface MonthlyBucket<Point> {
  monthKey: string;
  label: string;
  points: Point[];
}

/** One point per cycle with a known length, grouped by the calendar month its start
 * date falls in, months chronological. Every status is included (not just `ok`) so the
 * chart's shape/marker distinction (R7: excluded/anomalous cycles stay visible) has data
 * to draw from — filtering to "usable only" is a caller/UI decision, not this function's. */
export function bucketCycleLengthsByMonth(cycles: readonly Cycle[]): MonthlyBucket<CycleLengthPoint>[] {
  const withLength = cycles.filter(
    (c): c is Cycle & { lengthDays: number } => c.lengthDays !== null,
  );
  return groupByMonth(
    withLength.map((c) => ({ startDate: c.startDate, lengthDays: c.lengthDays, status: c.status })),
    (p) => p.startDate,
  );
}

// ============================================================================
// Period duration by month
// ============================================================================

export interface PeriodDurationPoint {
  startDate: CivilDate;
  durationDays: number;
  endInferred: boolean;
}

export function bucketPeriodDurationsByMonth(
  episodes: readonly BleedingEpisode[],
): MonthlyBucket<PeriodDurationPoint>[] {
  const withDuration = episodes.filter(
    (e): e is BleedingEpisode & { durationDays: number } => e.durationDays !== null,
  );
  return groupByMonth(
    withDuration.map((e) => ({
      startDate: e.startDate,
      durationDays: e.durationDays,
      endInferred: e.endInferred,
    })),
    (p) => p.startDate,
  );
}

function groupByMonth<P>(points: readonly P[], dateOf: (p: P) => CivilDate): MonthlyBucket<P>[] {
  const byMonth = new Map<string, P[]>();
  for (const p of points) {
    const key = monthKey(dateOf(p));
    const bucket = byMonth.get(key);
    if (bucket) bucket.push(p);
    else byMonth.set(key, [p]);
  }
  return [...byMonth.entries()]
    .sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0))
    .map(([key, pts]) => ({
      monthKey: key,
      label: monthKeyLabel(key),
      points: [...pts].sort((a, b) => compare(dateOf(a), dateOf(b))),
    }));
}

// ============================================================================
// Flow by period day
// ============================================================================

export const FLOW_LEVELS: readonly FlowLevel[] = ["spotting", "light", "medium", "heavy", "very_heavy"];

export interface FlowByDayPoint {
  periodDay: number;
  loggedDayCount: number;
  counts: Record<FlowLevel, number>;
  /** Fraction of `loggedDayCount` at each level; 0 when `loggedDayCount` is 0. */
  fractions: Record<FlowLevel, number>;
  heavyOrHigherFraction: number;
}

/** Reshapes `lib/engine/stats.ts`'s `FlowPatternDay[]` into display fractions. Purely a
 * reshape — the underlying counts are agent E's; this only computes the ratios the bar
 * chart needs. */
export function buildFlowByDayPoints(flowPattern: readonly FlowPatternDay[]): FlowByDayPoint[] {
  return [...flowPattern]
    .sort((a, b) => a.periodDay - b.periodDay)
    .map((day) => {
      const fractions = {} as Record<FlowLevel, number>;
      for (const level of FLOW_LEVELS) {
        fractions[level] = day.loggedDayCount > 0 ? day.flowCounts[level] / day.loggedDayCount : 0;
      }
      return {
        periodDay: day.periodDay,
        loggedDayCount: day.loggedDayCount,
        counts: day.flowCounts,
        fractions,
        heavyOrHigherFraction:
          day.loggedDayCount > 0 ? day.heavyOrHigherCount / day.loggedDayCount : 0,
      };
    });
}

// ============================================================================
// Symptom timeline
// ============================================================================

export interface PeriodBand {
  start: CivilDate;
  end: CivilDate;
}

export interface SymptomTimelineSeries {
  symptom: SymptomId;
  dates: CivilDate[];
}

export interface SymptomTimelineData {
  domainStart: CivilDate | null;
  domainEnd: CivilDate | null;
  /** Contiguous recorded-bleeding spans, for the timeline's background shading — context
   * only, not a re-derivation of `BleedingEpisode` (a day with `bleeding !== 'none'` and
   * no adjoining day is its own one-day band; consecutive bleeding days merge). */
  periodBands: PeriodBand[];
  series: SymptomTimelineSeries[];
}

/** Merges consecutive (day-adjacent) bleeding dates into bands for background shading. */
function mergeBands(sortedDates: readonly CivilDate[]): PeriodBand[] {
  const bands: PeriodBand[] = [];
  for (const date of sortedDates) {
    const last = bands[bands.length - 1];
    if (last && diffDays(last.end, date) <= 1) {
      last.end = date;
    } else {
      bands.push({ start: date, end: date });
    }
  }
  return bands;
}

/**
 * Calendar-time (not cycle-day) view of when each symptom in `symptoms` was logged, plus
 * bleeding-day bands for visual context. `symptoms` order is preserved as the row order
 * (caller decides, typically most-frequent-first).
 */
export function buildSymptomTimelineData(
  dayLogs: readonly DayLog[],
  symptoms: readonly SymptomId[],
): SymptomTimelineData {
  const sorted = [...dayLogs].sort((a, b) => compare(a.date, b.date));
  const domainStart = sorted.length > 0 ? sorted[0].date : null;
  const domainEnd = sorted.length > 0 ? sorted[sorted.length - 1].date : null;

  const bleedingDates = sorted.filter((l) => l.bleeding !== "none").map((l) => l.date);
  const periodBands = mergeBands(bleedingDates);

  const series: SymptomTimelineSeries[] = symptoms.map((symptom) => ({
    symptom,
    dates: sorted.filter((l) => l.symptoms.includes(symptom)).map((l) => l.date),
  }));

  return { domainStart, domainEnd, periodBands, series };
}

// ============================================================================
// Predicted vs actual
// ============================================================================

export interface PredictedVsActualLike {
  cycleIndex: number;
  anchorStart: CivilDate;
  signedErrorDays: number;
  insideWindow: boolean;
}

/** Symmetric error-axis domain (in days) that comfortably contains every point, with a
 * floor so a single near-zero-error point doesn't collapse the axis to nothing. */
export function predictedVsActualErrorDomain(
  points: readonly PredictedVsActualLike[],
): [number, number] {
  const maxAbs = points.reduce((m, p) => Math.max(m, Math.abs(p.signedErrorDays)), 0);
  const bound = Math.max(maxAbs, 3);
  return [-bound, bound];
}

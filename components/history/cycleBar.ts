/**
 * Geometry for the Insights cycle list's per-cycle bars (Daylight brief, "Insights":
 * per-cycle horizontal bars with an average marker). Pure: every number here is a day
 * count read off the engine's `Cycle`, turned into a percentage of one shared scale so
 * bars are comparable down the list. Nothing is re-derived — the in-progress cycle's
 * elapsed days come from `today`, and its "estimate" remainder is only the gap up to
 * the typical length the engine already reports.
 */
import { diffDays, type CivilDate } from "@/lib/date/civil";
import type { Cycle } from "@/lib/domain/types";

export interface CycleBarDays {
  /** Recorded days: the cycle length, or days elapsed so far for the in-progress cycle. */
  days: number;
  /** Leading period days, clamped to `days`. */
  periodDays: number;
  /** In-progress only: days left until the typical length (drawn as an estimate). */
  estimateDays: number;
}

export function cycleBarDays(cycle: Cycle, today: CivilDate, typicalDays: number | null): CycleBarDays {
  const inProgress = cycle.lengthDays === null;
  const days = Math.max(1, cycle.lengthDays ?? diffDays(cycle.startDate, today) + 1);
  const { episode } = cycle;
  const lastMenstrual = episode.menstrualDays.reduce<CivilDate | null>((max, d) => (max === null || d > max ? d : max), null);
  const period =
    episode.durationDays ?? (lastMenstrual !== null ? diffDays(episode.startDate, lastMenstrual) + 1 : 0);
  const estimateDays = inProgress && typicalDays !== null ? Math.max(0, Math.round(typicalDays) - days) : 0;
  return { days, periodDays: Math.min(Math.max(period, 0), days), estimateDays };
}

/** Days spanned by the full width of the track: the longest bar (or the average, if longer). */
export function cycleBarScale(bars: readonly CycleBarDays[], typicalDays: number | null): number {
  return Math.max(1, typicalDays ?? 0, ...bars.map((b) => b.days + b.estimateDays));
}

export const toPct = (days: number, scale: number) => (days / scale) * 100;

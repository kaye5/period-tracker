/**
 * Pure view-model builders for the dashboard's header status card and its three primary
 * insight cards (next period / current status / personal pattern). Kept separate from
 * the React components so the numbers and the wording they produce can be unit-tested
 * without rendering anything (SPEC.md R10).
 *
 * Nothing here invents a number: every figure comes straight out of the `EngineResult`
 * this agent's `app/(dashboard)/page.tsx` computes. This module's job is only selecting
 * which fields to show and phrasing them via `./copy.ts`.
 */
import { compare, diffDays, type CivilDate } from "@/lib/date/civil";
import type { Cycle, PredictionResult, StatSummary } from "@/lib/domain/types";
import { CONFIDENCE_LABELS } from "@/lib/copy/general";
import {
  civilDateParts,
  formatDateRange,
  formatDayCount,
  formatLongDate,
} from "./format";
import {
  completedCyclesUsed,
  currentStatusBody,
  CURRENT_STATUS_HEADLINE,
  cycleDayHeadline,
  lastPeriodStarted,
  NEXT_PERIOD_HEADLINE_FALLBACK,
  NO_PERIOD_LOGGED_YET,
  periodExpectedHeadline,
  typicalCycleRange,
} from "./copy";

// ============================================================================
// Header status card
// ============================================================================

export interface HeaderStatusViewModel {
  headline: string;
  /** Whether `headline` is a range claim ("Period expected between...") vs. a fallback
   * explanation (suppressed / no data). Drives whether the header renders in its normal
   * vs. muted visual treatment. */
  hasRange: boolean;
  cycleDayText: string | null;
  lastPeriodStartText: string | null;
  typicalRangeText: string | null;
  confidenceLabel: string;
  confidenceReason: string;
  completedCyclesUsedText: string | null;
}

function mostRecentCycle(cycles: readonly Cycle[]): Cycle | null {
  let latest: Cycle | null = null;
  for (const c of cycles) {
    if (latest === null || compare(c.startDate, latest.startDate) > 0) latest = c;
  }
  return latest;
}

function inProgressCycle(cycles: readonly Cycle[]): Cycle | null {
  return cycles.find((c) => c.status === "in_progress") ?? null;
}

export function buildHeaderStatus(input: {
  prediction: PredictionResult;
  cycles: readonly Cycle[];
  typicalCycleLength: StatSummary | null;
  today: CivilDate;
}): HeaderStatusViewModel {
  const { prediction, cycles, typicalCycleLength, today } = input;

  const rangeText =
    prediction.low !== null && prediction.high !== null
      ? formatDateRange(prediction.low, prediction.high)
      : null;

  const headline =
    rangeText !== null
      ? periodExpectedHeadline(rangeText)
      : (prediction.confidenceReason || NO_PERIOD_LOGGED_YET);

  const current = inProgressCycle(cycles);
  const cycleDayText =
    current !== null ? cycleDayHeadline(diffDays(current.startDate, today) + 1) : null;

  const latest = mostRecentCycle(cycles);
  const referenceYear = civilDateParts(today).year;
  const lastPeriodStartText =
    latest !== null ? lastPeriodStarted(formatLongDate(latest.startDate, referenceYear)) : null;

  // §6.4 (via lib/engine/stats.ts): at N=1 usable cycle, low === high === center — a
  // single data point has no spread yet, and showing "27 to 27 days" would read as a
  // (false) claim of perfect consistency rather than "no variability display" (the
  // stats module's own doc comment for that field). Gate on n >= 2 here for the same
  // reason, without re-deriving anything the engine didn't already compute.
  const typicalRangeText =
    typicalCycleLength !== null && typicalCycleLength.n >= 2
      ? typicalCycleRange(typicalCycleLength.low, typicalCycleLength.high)
      : null;

  const completedCyclesUsedText =
    prediction.basis.usableCycles > 0 ? completedCyclesUsed(prediction.basis.usableCycles) : null;

  return {
    headline,
    hasRange: rangeText !== null,
    cycleDayText,
    lastPeriodStartText,
    typicalRangeText,
    confidenceLabel: CONFIDENCE_LABELS[prediction.confidence],
    confidenceReason: prediction.confidenceReason,
    completedCyclesUsedText,
  };
}

// ============================================================================
// Primary card: "current status"
// ============================================================================

export interface PrimaryCardViewModel {
  headline: string;
  body: string;
  supportingDates: CivilDate[];
}

/** Null when there is no in-progress cycle to describe (the 'empty' data tier — nothing
 * has ever been logged). */
export function buildCurrentStatusCard(input: {
  cycles: readonly Cycle[];
  today: CivilDate;
}): PrimaryCardViewModel | null {
  const current = inProgressCycle(input.cycles);
  if (current === null) return null;

  const dayCount = diffDays(current.startDate, input.today) + 1;
  const referenceYear = civilDateParts(input.today).year;
  const lastStartText = lastPeriodStarted(formatLongDate(current.startDate, referenceYear));

  const supportingDates = [...current.episode.menstrualDays, ...current.episode.spottingDays].sort(
    compare,
  );

  return {
    headline: CURRENT_STATUS_HEADLINE,
    body: currentStatusBody(formatDayCount(dayCount), lastStartText),
    supportingDates,
  };
}

// ============================================================================
// Primary card: "next period"
// ============================================================================

/** The recorded starts of the cycles the prediction actually drew on — capped at
 * `basis.windowCycles`, matching what `lib/engine/prediction.ts`'s estimator used. This
 * is the "view the records behind this" evidence for the next-period card: the period
 * starts that fed the range. */
function windowCycleStartDates(
  cycles: readonly Cycle[],
  windowCycles: number,
): CivilDate[] {
  return cycles
    .filter((c) => c.status === "ok" && c.lengthDays !== null)
    .slice()
    .sort((a, b) => compare(b.startDate, a.startDate))
    .slice(0, windowCycles)
    .map((c) => c.startDate)
    .sort(compare);
}

export function buildNextPeriodCard(input: {
  prediction: PredictionResult;
  cycles: readonly Cycle[];
}): PrimaryCardViewModel {
  const { prediction, cycles } = input;
  const rangeText =
    prediction.low !== null && prediction.high !== null
      ? formatDateRange(prediction.low, prediction.high)
      : null;

  const headline =
    rangeText !== null ? periodExpectedHeadline(rangeText) : NEXT_PERIOD_HEADLINE_FALLBACK;

  const parts = [prediction.confidenceReason];
  if (prediction.basis.usableCycles > 0) {
    parts.push(completedCyclesUsed(prediction.basis.usableCycles));
  }

  return {
    headline,
    body: parts.join(" "),
    supportingDates: windowCycleStartDates(cycles, prediction.basis.windowCycles),
  };
}

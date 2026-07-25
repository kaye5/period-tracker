/**
 * Pure classification of a single calendar day into the indicator set SPEC.md §4.2
 * requires the calendar to render — recorded period, recorded spotting, predicted
 * period range, estimated fertile window, estimated ovulation range, today, and
 * "has symptoms or notes". Kept as a plain function (no React) so it is unit-testable
 * without rendering anything, and so <DayCell> stays a thin presentational layer over
 * it.
 *
 * Recorded data always wins visual precedence over a prediction: SPEC.md R2 treats
 * dayLogs as the sole source of recorded truth, and §4.2 requires recorded-vs-predicted
 * to be unambiguous, so a day the user actually logged never also shows a "predicted"
 * marker for the same bleeding fact.
 */
import { compare, type CivilDate } from "@/lib/date/civil";
import type { DayLog, FertilityEstimate, PredictionResult } from "@/lib/domain/types";

export interface DayIndicators {
  date: CivilDate;
  isToday: boolean;
  /** What was actually recorded for bleeding on this day, if anything. */
  recordedBleeding: "none" | "spotting" | "menstrual";
  /** This menstrual day begins a period run — either the user explicitly marked it the
   * first day (`periodBoundary: 'start'`), or the day before it was not menstrual. */
  isPeriodStart: boolean;
  /** This menstrual day ends a period run — either the user explicitly marked it the last
   * day (`periodBoundary: 'end'`), or the day after it was not menstrual. */
  isPeriodEnd: boolean;
  /** A DayLog document exists for this date at all (including a "nothing to report"
   * true-negative entry) — used to distinguish "known empty" from "unknown". */
  hasLog: boolean;
  loggedNothingToReport: boolean;
  /** Symptoms, mood, pain, or notes were recorded (independent of bleeding). */
  hasSymptomsOrNotes: boolean;
  /** This day falls within the predicted period range, and nothing was recorded here
   * that would make a prediction marker redundant or misleading. */
  isPredictedPeriod: boolean;
  isFertileWindow: boolean;
  isOvulationWindow: boolean;
}

function withinInclusive(date: CivilDate, low: CivilDate | null, high: CivilDate | null): boolean {
  if (!low || !high) return false;
  return compare(date, low) >= 0 && compare(date, high) <= 0;
}

export interface ComputeDayIndicatorsInput {
  date: CivilDate;
  today: CivilDate;
  dayLog: DayLog | null | undefined;
  prediction: PredictionResult | null | undefined;
  fertility: FertilityEstimate | null | undefined;
  fertilityEnabled: boolean;
  /** Bleeding recorded on the calendar day before this one (default "none"). Used to
   * detect the start of a period run when no explicit `periodBoundary` was logged. */
  previousBleeding?: "none" | "spotting" | "menstrual";
  /** Bleeding recorded on the calendar day after this one (default "none"). Used to
   * detect the end of a period run. */
  nextBleeding?: "none" | "spotting" | "menstrual";
}

export function computeDayIndicators(input: ComputeDayIndicatorsInput): DayIndicators {
  const {
    date,
    today,
    dayLog,
    prediction,
    fertility,
    fertilityEnabled,
    previousBleeding = "none",
    nextBleeding = "none",
  } = input;

  const recordedBleeding = dayLog?.bleeding ?? "none";
  const hasLog = dayLog != null;
  const loggedNothingToReport = dayLog?.nothingToReport === true;

  const isMenstrual = recordedBleeding === "menstrual";
  const isPeriodStart =
    isMenstrual && (dayLog?.periodBoundary === "start" || previousBleeding !== "menstrual");
  const isPeriodEnd =
    isMenstrual && (dayLog?.periodBoundary === "end" || nextBleeding !== "menstrual");

  const hasSymptomsOrNotes =
    hasLog &&
    !!dayLog &&
    (dayLog.symptoms.length > 0 ||
      (dayLog.mood?.length ?? 0) > 0 ||
      dayLog.pain.severity !== "none" ||
      !!dayLog.notes?.trim());

  // A predicted-period marker would be redundant (and would blur the recorded/predicted
  // distinction §4.2 exists to protect) on a day that already has a recorded bleeding
  // fact, so it only ever applies to days recorded as "none".
  const isPredictedPeriod =
    recordedBleeding === "none" &&
    !!prediction &&
    withinInclusive(date, prediction.low, prediction.high);

  const isFertileWindow =
    fertilityEnabled && !!fertility && withinInclusive(date, fertility.fertileLow, fertility.fertileHigh);

  const isOvulationWindow =
    fertilityEnabled &&
    !!fertility &&
    withinInclusive(date, fertility.ovulationLow, fertility.ovulationHigh);

  return {
    date,
    isToday: date === today,
    recordedBleeding,
    isPeriodStart,
    isPeriodEnd,
    hasLog,
    loggedNothingToReport,
    hasSymptomsOrNotes,
    isPredictedPeriod,
    isFertileWindow,
    isOvulationWindow,
  };
}

/**
 * The non-colour, human-readable fragments that describe a day's indicators — feeds
 * both the day cell's accessible name (SPEC.md §4.2: "a text label in the accessible
 * name") and, doubled as visually-hidden text, sighted screen-magnifier users. Order is
 * significant: recorded facts first (they are the most load-bearing), status markers
 * last.
 */
export function describeDayIndicators(indicators: DayIndicators): string[] {
  const fragments: string[] = [];
  if (indicators.isToday) fragments.push("today");
  if (indicators.recordedBleeding === "menstrual") {
    if (indicators.isPeriodStart && indicators.isPeriodEnd) fragments.push("period recorded, single day");
    else if (indicators.isPeriodStart) fragments.push("period recorded, first day");
    else if (indicators.isPeriodEnd) fragments.push("period recorded, last day");
    else fragments.push("period recorded");
  }
  if (indicators.recordedBleeding === "spotting") fragments.push("spotting recorded");
  if (indicators.loggedNothingToReport) fragments.push("nothing to report logged");
  if (indicators.hasSymptomsOrNotes) fragments.push("symptoms or notes logged");
  if (indicators.isPredictedPeriod) fragments.push("predicted period range");
  if (indicators.isFertileWindow) fragments.push("estimated fertile window");
  if (indicators.isOvulationWindow) fragments.push("estimated ovulation range");
  if (fragments.length === 0) fragments.push("no records");
  return fragments;
}

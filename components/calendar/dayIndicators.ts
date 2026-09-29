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
import { addDays, compare, type CivilDate } from "@/lib/date/civil";
import { PERIOD_DURATION_BOUNDS } from "@/components/onboarding/onboardingAnswers";
import type {
  BleedingEpisode,
  Cycle,
  DayLog,
  FertilityEstimate,
  PredictionResult,
} from "@/lib/domain/types";
import { ovarianPhase, type OvarianPhase } from "@/lib/engine";

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
  /** This day falls within the predicted BLEEDING SPAN of the next period (see
   * `predictedPeriodRange`), and nothing was recorded here that would make a prediction
   * marker redundant or misleading. */
  isPredictedPeriod: boolean;
  isFertileWindow: boolean;
  isOvulationWindow: boolean;
  /** Estimated OVARIAN phase for this day (SPEC.md §4.2 calendar phase display), or null
   * when fertility is disabled or the date is not inside the CURRENT cycle. Past cycles
   * get no phase: `fertility` is a single estimate derived backwards from the next
   * predicted period, so it says nothing about where ovulation fell in an earlier cycle.
   *
   * Deliberately `ovarianPhase`, not `cyclePhase`: the menstrual phase is a subset of the
   * follicular phase, so a recorded period day still has an ovarian phase and must keep
   * its phase underline. `cyclePhase`'s bleeding short-circuit made the underline vanish
   * on every logged period day. The bleeding fact is already carried by the cell's fill
   * and droplet glyph, so it does not need to consume the phase slot too. */
  phase: OvarianPhase | null;
  /** An unlogged day on which the ongoing period is still expected to be bleeding, based
   * on the user's own typical period length. Shown instead of prematurely closing the
   * period; never set on a day that has any log. */
  isExpectedPeriodDay: boolean;
}

/**
 * The period length both range helpers below are allowed to paint with, clamped to the
 * bounds the app itself already enforces on a reported period length
 * (`PERIOD_DURATION_BOUNDS`, 1..14 — reused rather than inventing a second number, so no
 * new cycle-shaped constant appears here under SPEC R5). The upper bound matters: both
 * `stats.periodDuration` (derived from whatever the user actually logged) and
 * `Profile.reportedTypicalPeriodDays` (a settings number input whose `max` attribute is
 * not enforced on a typed value) can arrive far larger, and an unbounded length
 * reproduces the original "the whole month is marked" bug through these paths. Recorded
 * days are unaffected — they are always drawn from the day log, never from this.
 */
function clampPeriodDays(typicalPeriodDays: number): number {
  const days = Math.round(typicalPeriodDays);
  if (days < PERIOD_DURATION_BOUNDS.min) return PERIOD_DURATION_BOUNDS.min;
  return Math.min(days, PERIOD_DURATION_BOUNDS.max);
}

function withinInclusive(date: CivilDate, low: CivilDate | null, high: CivilDate | null): boolean {
  if (!low || !high) return false;
  return compare(date, low) >= 0 && compare(date, high) <= 0;
}

/** The start date of whichever `cycles` entry `date` falls in — a cycle's range is
 * `[startDate, nextStartDate)`, or unbounded above for the in-progress cycle
 * (`nextStartDate === null`). Null when no cycle contains the date at all. */

/**
 * The ongoing period's expected REMAINING bleeding days: the span after the last day
 * actually logged as menstrual, up to the user's own typical period length. Null when
 * there is no open episode, when no typical length is known yet, or when the period has
 * already run at least its typical length (in which case we expect nothing further and
 * say nothing rather than guessing).
 *
 * `typicalPeriodDays` is resolved by the caller, own-history first: `stats.periodDuration`
 * when there is at least one COMPLETED episode, otherwise the user's own onboarding
 * answer (`Profile.reportedTypicalPeriodDays`). Without the fallback the feature is
 * invisible to exactly the person who needs it — a first period has no completed episode,
 * so `stats.periodDuration` is null. No population constant is used: nothing here would
 * carry an S-number under SPEC R4.
 *
 * Bounded by `today` at both ends. An expectation about a day that has already passed
 * unlogged is not an expectation, and an episode left open months ago (the engine only
 * closes one on positive evidence) otherwise kept painting "expected to continue" over a
 * historical month forever.
 */
export function expectedPeriodRange(
  cycles: readonly Cycle[],
  typicalPeriodDays: number | null | undefined,
  today: CivilDate,
): { from: CivilDate; through: CivilDate } | null {
  if (typicalPeriodDays == null) return null;
  const ongoing = cycles.find((c) => c.episode.endDate === null);
  if (!ongoing) return null;
  const days = ongoing.episode.menstrualDays;
  if (days.length === 0) return null;
  const lastLogged = days[days.length - 1];
  if (Math.round(typicalPeriodDays) < PERIOD_DURATION_BOUNDS.min) return null;
  const typicalDays = clampPeriodDays(typicalPeriodDays);
  const through = addDays(ongoing.episode.startDate, typicalDays - 1);
  if (compare(through, lastLogged) <= 0) return null;
  if (compare(through, today) < 0) return null;
  return { from: addDays(lastLogged, 1), through };
}

/**
 * The next period's predicted BLEEDING SPAN: `prediction.center` through
 * `center + typicalPeriodDays - 1`. Null when the prediction carries no centre
 * (suppressed, or nothing recorded to anchor to), in which case the grid shows no
 * predicted days at all.
 *
 * DO NOT "RESTORE" `prediction.low..high` HERE. That interval is the 80% uncertainty band
 * for the START DATE (prediction.ts: `muPost ± tCritical * sPred`), which at low cycle
 * counts is routinely ±8-15 days. Painting it on the grid dashed ~20-30 consecutive days
 * — i.e. the whole month read as "predicted period", which is exactly the reported bug.
 * The start-date range is still stated, in words, on the dashboard's next-period card,
 * which is the honest place for it.
 *
 * `typicalPeriodDays` is the user's own length, resolved by the caller (see
 * `expectedPeriodRange`). Absent, the span collapses to the single predicted start day —
 * no population constant is invented to fill the gap (SPEC.md R4).
 *
 * Suppressed entirely once the whole span is in the past: when a period is overdue the
 * centre stops moving, so the grid otherwise dashed five days in a month the user has
 * already scrolled past and showed nothing at all in the current one. An overdue
 * prediction is still stated, in words, on the dashboard's next-period card — the
 * division of labour this function already documents above.
 */
export function predictedPeriodRange(
  prediction: PredictionResult | null | undefined,
  typicalPeriodDays: number | null | undefined,
  today: CivilDate,
): { from: CivilDate; through: CivilDate } | null {
  const from = prediction?.center;
  if (!from) return null;
  const days = typicalPeriodDays == null ? 1 : clampPeriodDays(typicalPeriodDays);
  const through = addDays(from, days - 1);
  if (compare(through, today) < 0) return null;
  return { from, through };
}

function cycleStartFor(date: CivilDate, cycles: readonly Cycle[]): CivilDate | null {
  for (const cycle of cycles) {
    if (compare(date, cycle.startDate) < 0) continue;
    if (cycle.nextStartDate === null || compare(date, cycle.nextStartDate) < 0) {
      return cycle.startDate;
    }
  }
  return null;
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
  /** Bleeding recorded on the calendar day after this one, or `undefined` when that day
   * has NO log at all. The distinction is load-bearing: "logged as not bleeding" is
   * evidence the period ended, "not logged yet" is not. Passing "none" for an unlogged
   * day is what made every last-logged period day render as a period end. */
  nextBleeding?: "none" | "spotting" | "menstrual";
  /** The ongoing period's expected remaining bleeding days, from `expectedPeriodRange`. */
  expectedPeriod?: { from: CivilDate; through: CivilDate } | null;
  /** The next period's predicted bleeding span, from `predictedPeriodRange`. Computed once
   * by the caller rather than per-day, mirroring `expectedPeriod`. */
  predictedPeriod?: { from: CivilDate; through: CivilDate } | null;
  /** `EngineOutput.episodes` — the authority on where a period starts and ends. The
   * calendar renders these rather than re-deriving boundaries from neighbouring days:
   * the engine needs two consecutive non-bleeding days before it closes an episode and
   * leaves `endDate: null` until then, so an ongoing period correctly has no end. */
  episodes?: readonly BleedingEpisode[];
  /** Engine cycles (most-recent-first), used only to find which cycle's `startDate`
   * this day falls in, for `cyclePhase`. Defaults to none. */
  cycles?: readonly Cycle[];
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
    nextBleeding,
    expectedPeriod = null,
    predictedPeriod = null,
    episodes = [],
    cycles = [],
  } = input;

  const recordedBleeding = dayLog?.bleeding ?? "none";
  const hasLog = dayLog != null;
  const loggedNothingToReport = dayLog?.nothingToReport === true;

  const isMenstrual = recordedBleeding === "menstrual";
  // Boundaries come from the engine's episodes, not from peeking at the neighbouring
  // days. Re-deriving them here produced a calendar that disagreed with the engine: a
  // single logged non-bleeding day was enough to close a period visually, so a period
  // logged today or yesterday rendered with both a start and an end badge. An explicit
  // user-logged boundary still wins over both.
  const startsAnEpisode = episodes.some((e) => e.startDate === date);
  const endsAnEpisode = episodes.some((e) => e.endDate !== null && e.endDate === date);
  const isPeriodStart =
    isMenstrual &&
    (dayLog?.periodBoundary === "start" ||
      startsAnEpisode ||
      (episodes.length === 0 && previousBleeding !== "menstrual"));
  // An end can only be INFERRED from POSITIVE evidence that bleeding stopped: the next
  // day must actually be logged, and logged as non-menstrual. An unlogged next day means
  // "we don't know yet", not "it ended" — treating the two alike marked the most recent
  // logged period day as the last day, so a period logged today (or yesterday) rendered
  // as a finished one-day period. The engine is stricter still (`buildEpisodes` needs
  // noneStreak >= 2 before closing an episode, and leaves `endDate: null` otherwise).
  // An explicit user-logged boundary always wins.
  const isPeriodEnd =
    isMenstrual &&
    (dayLog?.periodBoundary === "end" ||
      endsAnEpisode ||
      (episodes.length === 0 &&
        nextBleeding !== undefined &&
        nextBleeding !== "menstrual"));

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
  // Only ever on a day with NO log: a logged day is a recorded fact and must not be
  // overwritten by an expectation (§4.2 recorded-vs-predicted separation).
  const isExpectedPeriodDay =
    !hasLog &&
    expectedPeriod !== null &&
    withinInclusive(date, expectedPeriod.from, expectedPeriod.through);

  // The period you are having NOW always wins over the one predicted next: they are two
  // different expectations with two different outlines (DayCell), and a day carrying both
  // would apply `border-dashed` and `border-dotted` to the same element and stack two
  // glyphs. Only reachable when a predicted cycle is shorter than a period, but the
  // precedence has to be decided somewhere and here is the only place that sees both.
  const isPredictedPeriod =
    recordedBleeding === "none" &&
    !isExpectedPeriodDay &&
    predictedPeriod !== null &&
    withinInclusive(date, predictedPeriod.from, predictedPeriod.through);

  const isFertileWindow =
    fertilityEnabled && !!fertility && withinInclusive(date, fertility.fertileLow, fertility.fertileHigh);

  const isOvulationWindow =
    fertilityEnabled &&
    !!fertility &&
    withinInclusive(date, fertility.ovulationLow, fertility.ovulationHigh);

  // Phase only applies to the CURRENT cycle. `fertility` is one estimate, derived
  // backwards from the next predicted period, so it carries no information about where
  // ovulation fell in an earlier cycle. Classifying historical days against it made every
  // past non-bleeding day "follicular" — including the days immediately before a past
  // period, which are the opposite phase.
  const cycleStart = cycleStartFor(date, cycles);
  const currentCycleStart = cycleStartFor(today, cycles);
  const inCurrentCycle = cycleStart !== null && cycleStart === currentCycleStart;
  const phase =
    fertilityEnabled && inCurrentCycle && cycleStart !== null
      ? ovarianPhase({
          date,
          cycleStart,
          predictedHigh: prediction?.high ?? null,
          fertility: fertility ?? null,
        })
      : null;

  return {
    date,
    isToday: date === today,
    recordedBleeding,
    isPeriodStart,
    isPeriodEnd,
    isExpectedPeriodDay,
    hasLog,
    loggedNothingToReport,
    hasSymptomsOrNotes,
    isPredictedPeriod,
    isFertileWindow,
    isOvulationWindow,
    phase,
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
  if (indicators.isExpectedPeriodDay) fragments.push("period expected to continue");
  if (indicators.isFertileWindow) fragments.push("estimated fertile window");
  if (indicators.isOvulationWindow) fragments.push("estimated ovulation range");
  // Only follicular and luteal get their own words. The ovulatory phase is already
  // spoken by the fertile/ovulation-window fragments above, so naming it again would just
  // double up. A recorded period day now reaches here with its real ovarian phase, so it
  // reads "period recorded, estimated follicular phase" — the bleeding fact and the phase
  // are two separate facts and each says itself once.
  if (indicators.phase === "follicular") fragments.push("estimated follicular phase");
  if (indicators.phase === "luteal") fragments.push("estimated luteal phase");
  if (fragments.length === 0) fragments.push("no records");
  return fragments;
}

/**
 * Fertile-window estimation — `docs/research/01-cycle-prediction.md` §2 and pipeline
 * STEP 5. Pure per SPEC.md R3; civil dates only per R1.
 *
 * THE ONE STRUCTURAL RULE IN THIS FILE
 * `FertilityEstimate.disclaimer` is populated inside the returned object, not left to the
 * caller. There is no code path that produces an estimate without it, so no screen can
 * render the window and forget the caveat (SPEC.md §3: "rendered adjacent, never behind a
 * link"). A test asserts this on every branch.
 *
 * WHAT THIS FILE MUST NEVER SAY
 * The words "safe", "guaranteed", "confirmed" and the phrase "you are ovulating" are
 * forbidden in every string produced here, and a test greps the outputs for them. A
 * calendar-only app cannot locate ovulation (03-additional-data-and-safety.md §1.5-§1.6:
 * calendar-only fertile-window claims have typical-use failure rates of 2-34%, and MDR
 * Rule 15 makes a contraception claim a class IIb device claim). The estimate is a band
 * with an honest width, never a verdict.
 *
 * DIRECTION OF INFERENCE
 * Ovulation is estimated BACKWARD from the predicted next period, never forward from the
 * last period start, and never at a fixed 14-day luteal phase. §2.2: the luteal phase is
 * the lower-variance component (SD 2.4 d vs follicular 5.3 d, S1). §2.3 / S4: only ~24% of
 * ovulations fall on cycle day 14-15 and 20-26% of cycles have luteal phases under 10 days;
 * S13 found apps assuming day-14 ovulation were 2-9 days early in 67% of cases.
 */

import { addDays, compare } from "@/lib/date/civil";
import { LUTEAL_MEAN, LUTEAL_SD } from "@/lib/engine/constants";
import { FERTILITY_DISCLAIMER } from "@/lib/copy/general";
import { NORMAL_UPPER_QUANTILE, predictiveSpreadDays } from "@/lib/engine/prediction";
import type { CivilDate, FertilityEstimate, PredictionResult } from "@/lib/domain/types";

// ---------------------------------------------------------------------------
// Constants local to the fertile-window geometry
// ---------------------------------------------------------------------------

/**
 * Days before ovulation that are counted as fertile — sperm survival in the female
 * reproductive tract is conventionally taken as ~5 days, which is why the classic fertile
 * window is a 6-day interval ending on the day of ovulation
 * (03-additional-data-and-safety.md §1.5 quotes an algorithm evaluation of exactly this
 * "6-day fertile window"). [choice: the 6-day window is standard; the split into -5/+1 is
 * the conventional one and is what the agent brief specifies.]
 */
export const FERTILE_DAYS_BEFORE_OVULATION = 5;

/**
 * Days after ovulation that are counted as fertile. [choice] Wilcox 1995 (NEJM 333:1517)
 * found ZERO conceptions from intercourse after ovulation day, and ASRM defines the
 * fertile window as the 6-day interval ENDING ON ovulation day (D-5..D0) — so this is not
 * a cited biological span. The +1 is a buffer for ovulation-*estimation* uncertainty (the
 * estimate is a band, not a measured event), not an extra day of oocyte viability.
 */
export const FERTILE_DAYS_AFTER_OVULATION = 1;

/**
 * Extra days added to EACH side of the ovulation band when the prediction it is derived
 * from is itself weakly grounded. [choice] The ovulation band already convolves the
 * prediction's own spread (STEP 5), but at *Not enough information* / *Early estimate* the
 * prediction's spread is a prior, not a measurement, so the band is widened rather than
 * presented as if the prior were evidence. Widening only ever makes the claim weaker.
 */
export const CONFIDENCE_EXTRA_DAYS: Record<PredictionResult["confidence"], number> = {
  not_enough_information: 2,
  early_estimate: 2,
  limited: 1,
  more_consistent: 0,
};

// ---------------------------------------------------------------------------

export interface FertilityInput {
  /** The result from `lib/engine/prediction.ts`. */
  prediction: PredictionResult;
  /** `profile.settings.fertilityEnabled`. When false, nothing is computed at all
   * (SPEC.md §0: "When off: no fertility UI, no fertility cards, ... no fertility columns
   * in exports"). */
  fertilityEnabled: boolean;
}

/** The intermediate quantities, exposed for tests and for a "how was this worked out"
 * panel. Never rendered as a claim on its own. */
export interface FertilityBasis {
  /** `s_pred` of the underlying prediction, including its calibration factor. */
  predictionSpreadDays: number;
  /** `sqrt(s_pred^2 + LUTEAL_SD^2)` (STEP 5). */
  ovulationSdDays: number;
  /** Half-width of the 80% ovulation band, before the low-confidence widening. */
  ovulationHalfWidthDays: number;
  /** Extra days applied to each side because of low prediction confidence. */
  extraDaysPerSide: number;
  /** Total width of the reported fertile window, in days (inclusive). */
  fertileWindowDays: number;
}

export interface FertilityEstimateWithBasis extends FertilityEstimate {
  basis: FertilityBasis;
}

/**
 * STEP 5, verbatim:
 * ```
 * ovulation_est = predicted_start - LUTEAL_MEAN
 * ovulation_sd  = sqrt(s_pred^2 + LUTEAL_SD^2)
 * # present as a range, width = 2 * 1.28 * ovulation_sd for an 80% band
 * ```
 * then the fertile window is `ovulation - 5 .. ovulation + 1`, applied to the *band*
 * rather than to a point, so it inherits the ovulation uncertainty.
 *
 * Returns null when fertility is off, or when the prediction carries no interval
 * (suppressed, or no recorded start to anchor to).
 */
export function estimateFertility(input: FertilityInput): FertilityEstimateWithBasis | null {
  const { prediction, fertilityEnabled } = input;
  if (!fertilityEnabled) return null;
  if (prediction.suppressed !== undefined) return null;

  const predictedStart = prediction.center;
  if (predictedStart === null) return null;

  const spread = predictiveSpreadDays(prediction);
  if (spread === null) return null;

  const ovulationSd = Math.sqrt(spread * spread + LUTEAL_SD * LUTEAL_SD);
  const ovulationHalf = NORMAL_UPPER_QUANTILE * ovulationSd;
  const extra = CONFIDENCE_EXTRA_DAYS[prediction.confidence];

  // Rounded OUTWARD on both sides: a fertile-window estimate may be wider than the
  // arithmetic, never narrower.
  const earliestOffset = Math.ceil(LUTEAL_MEAN + ovulationHalf) + extra;
  // Clamped at 0: when the band is wide enough that its late edge reaches the predicted
  // period start, it is truncated there. Ovulation cannot honestly be reported as
  // happening after the period it precedes, and this only ever bites on a band that is
  // already ~20 days wide and therefore already self-evidently non-actionable. [choice]
  const latestOffset = Math.max(0, Math.floor(LUTEAL_MEAN - ovulationHalf) - extra);

  const ovulationLow = addDays(predictedStart, -earliestOffset);
  const ovulationHigh = addDays(predictedStart, -latestOffset);

  const fertileLow = addDays(ovulationLow, -FERTILE_DAYS_BEFORE_OVULATION);
  const fertileHigh = addDays(ovulationHigh, FERTILE_DAYS_AFTER_OVULATION);

  const fertileWindowDays =
    earliestOffset -
    latestOffset +
    1 +
    FERTILE_DAYS_BEFORE_OVULATION +
    FERTILE_DAYS_AFTER_OVULATION;

  return {
    ovulationLow,
    ovulationHigh,
    fertileLow,
    fertileHigh,
    confidenceNote: fertilityConfidenceNote(fertileWindowDays, prediction),
    disclaimer: FERTILITY_DISCLAIMER,
    basis: {
      predictionSpreadDays: spread,
      ovulationSdDays: ovulationSd,
      ovulationHalfWidthDays: ovulationHalf,
      extraDaysPerSide: extra,
      fertileWindowDays,
    },
  };
}

/**
 * NOTE FOR AGENT F: like `populationEstimateReason` in prediction.ts, this sentence
 * belongs in `lib/copy/general.ts` under SPEC.md R9. It is written here so that no code
 * path can build a `FertilityEstimate` with an empty note, and it is deliberately free of
 * every word on the SPEC.md §4.4 banned list plus "safe", "guaranteed", "confirmed" and
 * "you are ovulating".
 *
 * It reports the width of the window and defers to the prediction's own reason string,
 * which already names the user's real numbers.
 */
export function fertilityConfidenceNote(
  fertileWindowDays: number,
  prediction: PredictionResult,
): string {
  const basedOn =
    prediction.kind === "population_estimate"
      ? "population averages rather than your own recorded cycles"
      : "your recorded period dates";
  return `This ${fertileWindowDays}-day window is worked out backwards from your predicted next period, using ${basedOn}. It is only as certain as that prediction, and the timing of ovulation varies from cycle to cycle even when a cycle is very regular. ${prediction.confidenceReason}`;
}

/**
 * Biologically, the menstrual phase is a SUBSET of the follicular phase (the follicular
 * phase begins on cycle day 1; bleeding days are follicular days), and ovulation is a
 * boundary EVENT, not a phase. `CyclePhase` is therefore a mutually-exclusive DISPLAY
 * partition derived from an ovarian state {follicular|luteal} split at the ovulation
 * estimate, with bleeding as an overlay that wins the display. The "ovulatory" band is the
 * estimate's uncertainty interval rendered as a phase, not a physiological phase. Cite:
 * docs/research/01-cycle-prediction.md §2.
 */
export type CyclePhase = "menstrual" | "follicular" | "ovulatory" | "luteal";

/** The ovarian state on its own, without the bleeding overlay — what `ovarianPhase`
 * returns. */
export type OvarianPhase = Exclude<CyclePhase, "menstrual">;

export interface CyclePhaseInput {
  date: CivilDate;
  /** Start of the cycle `date` belongs to. */
  cycleStart: CivilDate;
  /** `prediction.high`; null when there is no prediction. */
  predictedHigh: CivilDate | null;
  fertility: FertilityEstimate | null;
  /** Recorded menstrual bleeding on `date`. */
  isBleeding: boolean;
}

/**
 * Classifies a single date into its display phase.
 *
 * IMPORTANT — `fertility` is a single estimate for ONE cycle, derived backwards from the
 * next predicted period. It carries no information about where ovulation fell in an
 * earlier cycle, so callers must only pass dates from the CURRENT cycle. `ovarianPhase`'s
 * cycleStart/predictedHigh guards bound the date against the cycle it was given, but they
 * cannot detect a date from a *different* cycle: a caller that resolves `cycleStart` per-day (rather than pinning it
 * to the current cycle) will satisfy both guards for every historical day and render the
 * whole calendar as "follicular". `computeDayIndicators` pins it; see the `inCurrentCycle`
 * check there.
 */
export function cyclePhase(input: CyclePhaseInput): CyclePhase | null {
  const ovarian = ovarianPhase(input);
  if (ovarian === null) return null;
  return input.isBleeding ? "menstrual" : ovarian;
}

/**
 * The OVARIAN state alone, with no bleeding overlay — the same guards and the same
 * ovulation split as `cyclePhase`, minus the `isBleeding` short-circuit.
 *
 * WHY THIS EXISTS SEPARATELY. Biologically the menstrual phase is a SUBSET of the
 * follicular phase (see this section's type comment), so a recorded period day still HAS
 * an ovarian state. `cyclePhase` deliberately hides it, because "Today: menstrual phase"
 * is the right thing for a dashboard card to say. On the calendar grid that same
 * short-circuit meant a day marked as a period carried no follicular/luteal information
 * at all and lost its phase underline — the phase simply disappeared on exactly the days
 * the user looks at most. The calendar therefore asks for the ovarian state and draws the
 * bleeding fact separately (fill + droplet), which is also what §4.2 wants: one visual
 * per fact, not one visual for two facts.
 */
export function ovarianPhase(input: Omit<CyclePhaseInput, "isBleeding">): OvarianPhase | null {
  const { date, cycleStart, predictedHigh, fertility } = input;

  if (fertility === null) return null;
  if (compare(date, cycleStart) < 0) return null;
  if (predictedHigh !== null && compare(date, predictedHigh) > 0) return null;
  if (compare(date, fertility.ovulationLow) < 0) return "follicular";
  if (compare(date, fertility.ovulationHigh) <= 0) return "ovulatory";
  return "luteal";
}

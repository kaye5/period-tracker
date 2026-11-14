/**
 * Data for Today's cycle strip: one segment per day of the current cycle, from its start
 * to the day before the predicted next start. Recorded period days come from the day log
 * (via the engine's episode); every other day's phase is the engine's estimate
 * (`ovarianPhase`), and only when fertility features are on — with them off there is no
 * phase to show, and the strip says only "period" vs "rest of cycle". Pure, no I/O.
 */
import { addDays, compare, diffDays, type CivilDate } from "@/lib/date/civil";
import type { Cycle, FertilityEstimate, PredictionResult } from "@/lib/domain/types";
import { ovarianPhase } from "@/lib/engine";

export type StripDayKind = "menstrual" | "follicular" | "ovulatory" | "luteal" | "unknown";

export interface CycleStripData {
  days: { date: CivilDate; kind: StripDayKind; future: boolean }[];
  /** 0-based index of today within `days`. */
  todayIndex: number;
}

export function buildCycleStrip(input: {
  cycles: readonly Cycle[];
  prediction: PredictionResult;
  fertility: FertilityEstimate | null;
  today: CivilDate;
}): CycleStripData | null {
  const { cycles, prediction, fertility, today } = input;
  const current = cycles.find((c) => c.status === "in_progress");
  if (!current || prediction.center === null) return null;

  const todayIndex = diffDays(current.startDate, today);
  if (todayIndex < 0) return null;
  // An overdue period stretches the strip to today rather than cutting it off.
  const total = Math.max(diffDays(current.startDate, prediction.center), todayIndex + 1);
  const menstrual = new Set(current.episode.menstrualDays);

  const days = Array.from({ length: total }, (_, i) => {
    const date = addDays(current.startDate, i);
    const kind: StripDayKind = menstrual.has(date)
      ? "menstrual"
      : (ovarianPhase({ date, cycleStart: current.startDate, predictedHigh: prediction.high, fertility }) ??
        "unknown");
    return { date, kind, future: compare(date, today) > 0 };
  });

  return { days, todayIndex };
}

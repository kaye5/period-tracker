import { Check, Diamond } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DayIndicators } from "./dayIndicators";

/**
 * One day's visual state (Daylight). Every state is a SHAPE first and a colour second,
 * so nothing relies on colour alone (SPEC.md §4.2) — including for colour-blind users:
 *
 *   recorded period      solid ink fill
 *   spotting             solid ring + small dot under the number
 *   predicted period     dashed ring        (an estimate)
 *   expected to continue dotted ring        (an estimate)
 *   today                ring offset outside the circle + bold number
 *   symptoms / notes     dot at the top-right
 *   nothing to report    check at the top-left
 *   fertile window       bar under the circle (estimate)
 *   ovulation window     diamond under the circle (estimate)
 *
 * Purely presentational; the accessible description lives on the interactive parent.
 */
export function DayMark({
  indicators,
  dayNumber,
  muted = false,
}: {
  indicators: DayIndicators;
  dayNumber: number;
  /** Outside the displayed month. */
  muted?: boolean;
}) {
  const {
    recordedBleeding,
    isPredictedPeriod,
    isExpectedPeriodDay,
    isFertileWindow,
    isOvulationWindow,
    isToday,
    hasSymptomsOrNotes,
    loggedNothingToReport,
  } = indicators;
  const period = recordedBleeding === "menstrual";
  const spotting = recordedBleeding === "spotting";

  return (
    <span aria-hidden className="flex flex-col items-center gap-1">
      <span
        className={cn(
          "relative flex size-10 items-center justify-center rounded-full border-2 border-transparent text-label tabular-nums",
          muted ? "text-muted-foreground" : "text-foreground",
          period && "border-phase-menstrual bg-phase-menstrual font-semibold text-phase-menstrual-foreground",
          spotting && "border-phase-menstrual",
          isPredictedPeriod && "border-dashed border-phase-menstrual",
          isExpectedPeriodDay && "border-dotted border-phase-menstrual",
          isToday && "font-bold ring-2 ring-today ring-offset-2 ring-offset-card",
        )}
      >
        {dayNumber}
        {spotting ? (
          <span className="absolute bottom-1 size-1 rounded-full bg-phase-menstrual" />
        ) : null}
        {hasSymptomsOrNotes ? (
          <span className="absolute -top-0.5 -right-0.5 size-2 rounded-full border-2 border-card bg-muted-foreground" />
        ) : null}
        {loggedNothingToReport ? (
          <Check className="absolute -top-1 -left-1 size-3 text-muted-foreground" strokeWidth={3} />
        ) : null}
      </span>
      <span className="flex h-2 items-center justify-center">
        {isOvulationWindow ? (
          <Diamond className="size-2.5 fill-phase-fertile text-phase-fertile" />
        ) : isFertileWindow ? (
          <span className="h-1 w-5 rounded-full bg-phase-fertile" />
        ) : null}
      </span>
    </span>
  );
}

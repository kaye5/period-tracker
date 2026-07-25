"use client";

import type { CivilDate } from "@/lib/date/civil";
import type { DayIndicators } from "./dayIndicators";
import {
  IconCheck,
  IconDropletOutlineDashed,
  IconDropletSolid,
  IconNoteMark,
  IconPeriodEnd,
  IconPeriodStart,
  IconSpottingMark,
  IconStar,
} from "./icons";

export interface DayCellProps {
  date: CivilDate;
  dayNumber: number;
  inCurrentMonth: boolean;
  indicators: DayIndicators;
  /** Precomputed by <Calendar> from civilDateDisplay + describeDayIndicators — the
   * non-colour text label SPEC.md §4.2 requires ("a text label in the accessible
   * name"). */
  accessibleLabel: string;
  /** Roving-tabindex target (SPEC.md §4.5: arrow keys move focus). */
  isFocusTarget: boolean;
  /** Part of an in-progress or pending-confirmation drag range. */
  isPendingSelection: boolean;
  onActivate: (date: CivilDate) => void;
  onFocused: (date: CivilDate) => void;
  onKeyNavigate: (date: CivilDate, key: string) => void;
  onPointerDownCell: (date: CivilDate) => void;
  registerRef: (date: CivilDate, el: HTMLButtonElement | null) => void;
}

const NAV_KEYS = new Set([
  "ArrowUp",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "Home",
  "End",
  "Enter",
  " ",
]);

/**
 * A single day in the calendar grid. Every visual state here is built from at least two
 * of {shape, fill, border style, icon, text} so no state is colour-only (SPEC.md §4.2):
 * recorded days are a solid-filled circle with a droplet/spotting glyph; predicted days
 * are unfilled with a dashed border and a dashed-outline glyph; fertile/ovulation/today/
 * notes are added as distinctly-shaped badges layered on top, never a colour swap alone.
 * The full description of what's true about the day always also reaches assistive tech
 * through `accessibleLabel`.
 */
export function DayCell({
  date,
  dayNumber,
  inCurrentMonth,
  indicators,
  accessibleLabel,
  isFocusTarget,
  isPendingSelection,
  onActivate,
  onFocused,
  onKeyNavigate,
  onPointerDownCell,
  registerRef,
}: DayCellProps) {
  const {
    recordedBleeding,
    isPeriodStart,
    isPeriodEnd,
    isPredictedPeriod,
    isFertileWindow,
    isOvulationWindow,
    isToday,
    hasSymptomsOrNotes,
    loggedNothingToReport,
  } = indicators;

  const isRecordedMenstrual = recordedBleeding === "menstrual";
  const isRecordedSpotting = recordedBleeding === "spotting";

  return (
    <button
      type="button"
      role="gridcell"
      ref={(el) => registerRef(date, el)}
      data-civil-date={date}
      aria-label={accessibleLabel}
      aria-current={isToday ? "date" : undefined}
      aria-selected={isPendingSelection ? true : undefined}
      tabIndex={isFocusTarget ? 0 : -1}
      onClick={() => onActivate(date)}
      onFocus={() => onFocused(date)}
      onPointerDown={() => onPointerDownCell(date)}
      onKeyDown={(event) => {
        if (NAV_KEYS.has(event.key)) {
          event.preventDefault();
          onKeyNavigate(date, event.key);
        }
      }}
      className={[
        "relative flex h-11 w-11 shrink-0 items-center justify-center rounded-full text-sm",
        "transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2",
        "ring-2",
        isToday ? "ring-today" : "ring-transparent",
        inCurrentMonth ? "text-foreground" : "text-muted-foreground",
        isRecordedMenstrual ? "bg-primary text-primary-foreground font-semibold" : "",
        isRecordedSpotting ? "bg-primary/60 text-primary-foreground font-semibold" : "",
        !isRecordedMenstrual && !isRecordedSpotting ? "hover:bg-muted" : "",
        isPredictedPeriod
          ? "border-2 border-dashed border-primary font-medium"
          : "border-2 border-transparent",
      ].join(" ")}
    >
      {isFertileWindow ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -inset-1 rounded-full border-2 border-dashed border-chart-3"
        />
      ) : null}

      {isPendingSelection ? (
        <span aria-hidden="true" className="pointer-events-none absolute inset-0 rounded-full bg-primary/25" />
      ) : null}

      <span className="relative z-10 flex flex-col items-center leading-none gap-0.5">
        {isRecordedMenstrual ? <IconDropletSolid className="h-3 w-3" /> : null}
        {isRecordedSpotting ? <IconSpottingMark className="h-3 w-3" /> : null}
        {isPredictedPeriod ? <IconDropletOutlineDashed className="h-3 w-3 text-primary" /> : null}
        <span>{dayNumber}</span>
      </span>

      {isOvulationWindow ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 -right-1 z-10 text-chart-3"
        >
          <IconStar className="h-3 w-3" />
        </span>
      ) : null}

      {hasSymptomsOrNotes ? (
        <span aria-hidden="true" className="pointer-events-none absolute -top-0.5 -right-0.5 z-10 text-muted-foreground">
          <IconNoteMark className="h-2.5 w-2.5" />
        </span>
      ) : null}

      {loggedNothingToReport ? (
        <span aria-hidden="true" className="pointer-events-none absolute -bottom-0.5 -left-0.5 z-10 text-muted-foreground">
          <IconCheck className="h-2.5 w-2.5" />
        </span>
      ) : null}

      {/* First/last day of a period run get distinct badges (triangle = starts, square =
          ends) so a period's boundaries are visible at a glance, not just its fill. */}
      {isRecordedMenstrual && isPeriodStart ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 -left-1 z-20 flex size-3.5 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-primary"
        >
          <IconPeriodStart className="h-2 w-2" />
        </span>
      ) : null}
      {isRecordedMenstrual && isPeriodEnd ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute -bottom-1 -right-1 z-20 flex size-3.5 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-primary"
        >
          <IconPeriodEnd className="h-2 w-2" />
        </span>
      ) : null}
    </button>
  );
}

"use client";

import { useCallback } from "react";
import type { CivilDate } from "@/lib/date/civil";
import { cn } from "@/lib/utils";
import type { DayIndicators } from "./dayIndicators";
import { DayMark } from "./DayMark";

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
  /** Registers this cell's button for keyboard focus moves; returns the unregister
   * cleanup. */
  registerRef: (date: CivilDate, el: HTMLButtonElement) => () => void;
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
 * A single day in the calendar grid: the shared `DayMark` (the same shapes as Today's week
 * strip — solid fill, rings, dashes, dots, bar, diamond; never colour alone, SPEC.md §4.2)
 * inside a 44px-wide button. Everything the marks say, including facts with no mark of
 * their own (first/last day of a period, estimated phase), reaches assistive tech through
 * `accessibleLabel`.
 *
 * A pending drag selection draws a rounded-square outline and tint around the whole cell:
 * a different shape from every day mark (all circles), so it never reads as period fill.
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
  // Stable, so React attaches it once per mount (not on every render).
  const ref = useCallback(
    (el: HTMLButtonElement | null) => (el ? registerRef(date, el) : undefined),
    [date, registerRef],
  );

  return (
    <button
      type="button"
      role="gridcell"
      ref={ref}
      data-civil-date={date}
      aria-label={accessibleLabel}
      aria-current={indicators.isToday ? "date" : undefined}
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
      className={cn(
        "flex w-cal shrink-0 justify-center rounded-xl border-2 border-transparent py-0.5 transition-colors",
        isPendingSelection ? "border-foreground bg-muted" : "hover:bg-muted",
      )}
    >
      <DayMark indicators={indicators} dayNumber={dayNumber} muted={!inCurrentMonth} />
    </button>
  );
}

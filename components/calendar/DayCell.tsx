"use client";

import type { CivilDate } from "@/lib/date/civil";
import type { DayIndicators } from "./dayIndicators";
import {
  IconCheck,
  IconDropletOutlineDashed,
  IconDropletSolid,
  IconNoteMark,
  IconPeriodContinues,
  IconPeriodEnd,
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
 *
 * A 44px circle has room for exactly one mark per slot, so each one owns a slot outright:
 * centre = the day number plus (at most) one bleeding glyph, top-left = nothing to
 * report, top-right = symptoms or notes, bottom-right = ovulation, right edge = the last
 * day of a period, bottom centre = the estimated-phase underline. Previously the period
 * badges shared the bottom corners with the check and the ovulation star, so a day that
 * was both drew one mark on top of the other.
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
    isPeriodEnd,
    isPredictedPeriod,
    isExpectedPeriodDay,
    isFertileWindow,
    isOvulationWindow,
    isToday,
    hasSymptomsOrNotes,
    loggedNothingToReport,
    phase,
  } = indicators;

  const isRecordedMenstrual = recordedBleeding === "menstrual";
  const isRecordedSpotting = recordedBleeding === "spotting";
  /** Recorded days are solid-filled, so anything drawn ON them must use the fill's own
   * foreground to stay legible. Relevant since the phase underline now also appears on
   * recorded period days (the phase and the bleeding are two separate facts). */
  const onSolidFill = isRecordedMenstrual || isRecordedSpotting;

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
        // Two DIFFERENT expectations, two different outlines (§4.2: one visual per
        // meaning). Dashed = the NEXT period, predicted. Dotted = the period you are
        // having now, expected to continue. They were one shared dashed treatment, which
        // made "still bleeding tomorrow" and "a period due in three weeks" look identical.
        isPredictedPeriod ? "border-2 border-dashed border-primary font-medium" : "",
        isExpectedPeriodDay ? "border-2 border-dotted border-primary font-medium" : "",
        !isPredictedPeriod && !isExpectedPeriodDay ? "border-2 border-transparent" : "",
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

      {/* Exactly one of these four glyphs can ever apply: the predicted/expected markers
          are both suppressed on a day with a recorded bleeding fact (dayIndicators.ts),
          so this stack is always the day number plus at most one icon. */}
      <span className="relative z-10 flex flex-col items-center leading-none gap-0.5">
        {isRecordedMenstrual ? <IconDropletSolid className="size-3" /> : null}
        {isRecordedSpotting ? <IconSpottingMark className="size-3" /> : null}
        {isPredictedPeriod ? <IconDropletOutlineDashed className="size-3 text-primary" /> : null}
        {isExpectedPeriodDay ? <IconPeriodContinues className="size-3 text-primary" /> : null}
        <span>{dayNumber}</span>
      </span>

      {/* Estimated follicular/luteal phase: a thin underline whose SHAPE carries the
          meaning — follicular is two separate dashes, luteal one continuous bar — so the
          two stay distinguishable on a solid-filled cell, where both are forced to
          `primary-foreground` and hue tells you nothing (SPEC.md §4.2: colour is never
          the sole carrier). The previous `border-dashed` version resolved to about two
          dashes anyway at this width, and did so at the UA's discretion; drawing the
          dashes as real elements makes the difference deterministic. `inset-x-3` is as
          wide as the bar can go without reaching the ovulation star, which starts 12px
          in from the right edge of the 44px cell. */}
      {phase === "follicular" || phase === "luteal" ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-3 bottom-1 z-10 flex h-0.5 justify-between"
        >
          {(phase === "follicular" ? ["a", "b"] : ["a"]).map((key) => (
            <span
              key={key}
              className={`h-full rounded-full ${phase === "follicular" ? "w-2/5" : "w-full"} ${
                onSolidFill ? "bg-primary-foreground" : phase === "follicular" ? "bg-chart-4" : "bg-chart-5"
              }`}
            />
          ))}
        </span>
      ) : null}

      {loggedNothingToReport ? (
        <span aria-hidden="true" className="pointer-events-none absolute -top-0.5 -left-0.5 z-10 text-muted-foreground">
          <IconCheck className="size-3" />
        </span>
      ) : null}

      {hasSymptomsOrNotes ? (
        <span aria-hidden="true" className="pointer-events-none absolute -top-0.5 -right-0.5 z-10 text-muted-foreground">
          <IconNoteMark className="size-3" />
        </span>
      ) : null}

      {isOvulationWindow ? (
        <span aria-hidden="true" className="pointer-events-none absolute -right-0.5 -bottom-0.5 z-10 text-chart-3">
          <IconStar className="size-3.5" />
        </span>
      ) : null}

      {/* Only the LAST day of a period gets a badge, on the right edge where it reads as
          the run's closing bracket. There is no matching "first day" badge: the first
          filled cell of a run already is the first day, so a second mark saying so was
          pure noise — the fact still reaches assistive tech through `accessibleLabel`,
          and an end badge is the one boundary the fill cannot show (an ongoing period
          simply has none). */}
      {isRecordedMenstrual && isPeriodEnd ? (
        <span
          aria-hidden="true"
          className="pointer-events-none absolute top-1/2 -right-1 z-20 flex size-3.5 -translate-y-1/2 items-center justify-center rounded-full bg-card text-primary shadow-sm ring-1 ring-primary"
        >
          <IconPeriodEnd className="size-2" />
        </span>
      ) : null}
    </button>
  );
}

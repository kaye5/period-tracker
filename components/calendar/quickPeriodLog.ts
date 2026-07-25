/**
 * Pure logic behind press-and-drag period selection (SPEC.md U3 brief: "press-and-drag
 * selects consecutive period days via the existing useDragSelect hook"). Kept free of
 * React/fetch so it is unit-testable directly (SPEC.md R10) — Calendar.tsx is a thin
 * caller: it turns a resolved `DragRange` into a list of DayLog payloads with this
 * module, then POSTs each one to app/api/day-logs itself (the WRITE/MUTATE pattern
 * every interactive client component in this build follows).
 *
 * R7 discipline: a day already carrying other recorded facts (symptoms, notes, flow,
 * ...) keeps every one of them — the drag gesture only ever asserts "menstrual bleeding
 * happened here", never silently discards what else was already true about the day. The
 * one field it does deliberately clear is `nothingToReport`: a day can't simultaneously
 * be a recorded true-negative and a recorded period day, and the drag gesture is the
 * more specific, more recent assertion.
 */
import { compare, rangeInclusive, type CivilDate } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import { formatShortDayLabel } from "./civilDateDisplay";
import type { DragRange } from "./useDragSelect";

export type { DragRange };

/** Every date in the range, chronological order, both ends inclusive. */
export function quickPeriodDatesInRange(range: DragRange): CivilDate[] {
  return rangeInclusive(range.start, range.end);
}

/** The DayLog to upsert for one date in a confirmed drag-select range. Merges onto
 * whatever was already recorded for that date, if anything. */
export function buildQuickPeriodDayLog(
  date: CivilDate,
  today: CivilDate,
  existing: DayLog | undefined,
): DayLog {
  if (existing) {
    return { ...existing, date, bleeding: "menstrual", nothingToReport: undefined };
  }
  return {
    date,
    bleeding: "menstrual",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: today,
  };
}

/** The full set of DayLog payloads to upsert for a confirmed drag-select range. */
export function buildQuickPeriodDayLogs(
  range: DragRange,
  today: CivilDate,
  dayLogByDate: ReadonlyMap<CivilDate, DayLog>,
): DayLog[] {
  return quickPeriodDatesInRange(range).map((date) =>
    buildQuickPeriodDayLog(date, today, dayLogByDate.get(date)),
  );
}

/** Human-readable confirmation prompt for a drag-select range, e.g. "Mark Jul 10 as a
 * period day?" or "Mark 3 days (Jul 10 to Jul 12) as period days?". */
export function formatDragRangeLabel(range: DragRange): string {
  const dates = quickPeriodDatesInRange(range);
  if (dates.length <= 1) {
    return `Mark ${formatShortDayLabel(range.start)} as a period day?`;
  }
  return `Mark ${dates.length} days (${formatShortDayLabel(range.start)} to ${formatShortDayLabel(range.end)}) as period days?`;
}

/** True iff `date` falls within `range`, inclusive. Shared by Calendar.tsx for
 * highlighting the live drag preview and the pending-confirmation range identically. */
export function isDateWithinDragRange(date: CivilDate, range: DragRange | null): boolean {
  if (!range) return false;
  return compare(date, range.start) >= 0 && compare(date, range.end) <= 0;
}

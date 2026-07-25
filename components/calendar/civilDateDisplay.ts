/**
 * Pure display-string helpers for CivilDate values, kept local to components/calendar/
 * (agent U3 owns nothing under lib/). Per SPEC.md R1, only lib/date/civil.ts may
 * construct `Date` objects — this file never does. Month/day/year come straight out of
 * the "YYYY-MM-DD" string, and weekday names come from the caller-supplied grid column
 * index (0..6, offset by `weekStartsOn`) rather than from any Date computation, since
 * lib/date/civil.ts's `monthGrid` already lays days out in weekday order.
 */
import type { CivilDate } from "@/lib/date/civil";

const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];

const MONTH_NAMES_SHORT = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

const WEEKDAY_NAMES = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

const WEEKDAY_NAMES_SHORT = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export interface CivilDateParts {
  year: number;
  month: number; // 1-indexed
  day: number;
}

/** Splits "YYYY-MM-DD" into numeric parts without ever constructing a `Date`. */
export function civilDateParts(date: CivilDate): CivilDateParts {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

export function monthName(month1indexed: number, short = false): string {
  const names = short ? MONTH_NAMES_SHORT : MONTH_NAMES;
  return names[(month1indexed - 1 + 12) % 12];
}

/** Weekday name for a grid column, computed from position (not from a Date). `column`
 * is 0..6 within a week row produced by `lib/date/civil.ts`'s `monthGrid`. */
export function weekdayNameForColumn(column: number, weekStartsOn: 0 | 1, short = false): string {
  const names = short ? WEEKDAY_NAMES_SHORT : WEEKDAY_NAMES;
  return names[(weekStartsOn + column) % 7];
}

/** Full human-readable label for a day cell's accessible name, e.g.
 * "Wednesday, July 22, 2026". */
export function formatFullDayLabel(date: CivilDate, column: number, weekStartsOn: 0 | 1): string {
  const { year, month, day } = civilDateParts(date);
  return `${weekdayNameForColumn(column, weekStartsOn)}, ${monthName(month)} ${day}, ${year}`;
}

export function formatMonthYearLabel(year: number, month: number): string {
  return `${monthName(month)} ${year}`;
}

/** Short human-readable label for a single day, e.g. "Jul 22" — used where a full
 * weekday-qualified label (formatFullDayLabel) would be too verbose, such as the
 * drag-select confirmation prompt. */
export function formatShortDayLabel(date: CivilDate): string {
  const { month, day } = civilDateParts(date);
  return `${monthName(month, true)} ${day}`;
}

/**
 * Display-string formatting for civil dates and small numeric facts, scoped to
 * `components/dashboard/**`.
 *
 * SPEC.md R1: "Never store a `Date`, never call `new Date()` for date arithmetic outside
 * `lib/date/civil.ts`." Everything below reads a `CivilDate` (`"YYYY-MM-DD"`) by string
 * slicing only — no `Date` object is ever constructed here. Any actual date *arithmetic*
 * (adding days, diffing) is delegated to `lib/date/civil.ts`, never reimplemented.
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
] as const;

export interface CivilDateParts {
  year: number;
  month: number; // 1-12
  day: number;
}

/** Pure string slicing — see the module header for why this is not `new Date()`. */
export function civilDateParts(date: CivilDate): CivilDateParts {
  return {
    year: Number(date.slice(0, 4)),
    month: Number(date.slice(5, 7)),
    day: Number(date.slice(8, 10)),
  };
}

function monthName(month: number): string {
  return MONTH_NAMES[month - 1] ?? "";
}

/** "July 26" — no year. Used for dates that are obviously "soon" (predictions, recent
 * history) where the year is implied. */
export function formatMonthDay(date: CivilDate): string {
  const { month, day } = civilDateParts(date);
  return `${monthName(month)} ${day}`;
}

/** "July 26, 2026" — with year, for dates that could be ambiguous (e.g. a period start
 * from a while ago, or a range spanning a year boundary). */
export function formatLongDate(date: CivilDate, referenceYear?: number): string {
  const { year, month, day } = civilDateParts(date);
  if (referenceYear !== undefined && year === referenceYear) return formatMonthDay(date);
  return `${monthName(month)} ${day}, ${year}`;
}

/**
 * A range between two civil dates, collapsing shared month/year the way a person would
 * write it: "July 26–29", "July 26 – August 2", "December 30, 2026 – January 2, 2027".
 * Both ends are always shown as *dates*, never collapsed into a single date — a range is
 * a range, never a single date (SPEC.md's core rule for predictions).
 */
export function formatDateRange(low: CivilDate, high: CivilDate): string {
  const a = civilDateParts(low);
  const b = civilDateParts(high);

  if (a.year === b.year && a.month === b.month) {
    return `${monthName(a.month)} ${a.day}–${b.day}`;
  }
  if (a.year === b.year) {
    return `${monthName(a.month)} ${a.day} – ${monthName(b.month)} ${b.day}`;
  }
  return `${monthName(a.month)} ${a.day}, ${a.year} – ${monthName(b.month)} ${b.day}, ${b.year}`;
}

/** "3 days", "1 day" — never a bare number where the unit could be ambiguous. */
export function formatDayCount(days: number): string {
  const n = Math.round(Math.abs(days));
  return `${n} day${n === 1 ? "" : "s"}`;
}

/** "1 cycle", "4 cycles". */
export function formatCycleCount(n: number): string {
  return `${n} cycle${n === 1 ? "" : "s"}`;
}

/**
 * Pure, civil-date-safe display formatting shared by the history, report and chart
 * screens (agent U4). SPEC.md R1: every date the user perceives is a "YYYY-MM-DD" civil
 * date; this module formats those strings for display by slicing/parsing the string
 * itself, never by constructing a `Date` object (R1 reserves `Date` construction for
 * `lib/date/civil.ts` alone). Pure and dependency-free, so it is unit-tested directly.
 */
import type { CivilDate } from "@/lib/date/civil";

const MONTH_ABBR = [
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
] as const;

interface CivilParts {
  year: number;
  month: number; // 1-indexed
  day: number;
}

/** Splits a "YYYY-MM-DD" string into numeric parts without constructing a `Date`. */
export function civilParts(date: CivilDate): CivilParts {
  const [y, m, d] = date.split("-").map(Number);
  return { year: y, month: m, day: d };
}

/** "YYYY-MM" bucket key for a civil date — pure string slicing. */
export function monthKey(date: CivilDate): string {
  return date.slice(0, 7);
}

/** "Jan 2026" from a "YYYY-MM" key. */
export function monthKeyLabel(key: string): string {
  const [y, m] = key.split("-").map(Number);
  return `${MONTH_ABBR[m - 1]} ${y}`;
}

/** "Jul 22, 2026" — the report/history display form of a civil date. */
export function formatCivilDate(date: CivilDate): string {
  const { year, month, day } = civilParts(date);
  return `${MONTH_ABBR[month - 1]} ${day}, ${year}`;
}

/** "Jul 22" — compact form for dense chart axes/tables. */
export function formatCivilDateShort(date: CivilDate): string {
  const { month, day } = civilParts(date);
  return `${MONTH_ABBR[month - 1]} ${day}`;
}

/** "27–34 days" / "30 days" when low === high — never claims false precision by
 * printing a range around a single-point value. */
export function formatDayRange(low: number, high: number): string {
  return low === high ? `${low} days` : `${low}–${high} days`;
}

export function pluralize(n: number, singular: string, plural = `${singular}s`): string {
  return n === 1 ? singular : plural;
}

/** Rounds to the nearest integer for display; statistics upstream are computed on exact
 * values, this is presentation-only rounding. */
export function roundForDisplay(n: number): number {
  return Math.round(n);
}

export function formatSignedDays(n: number): string {
  const rounded = roundForDisplay(n);
  if (rounded === 0) return "0 days";
  const sign = rounded > 0 ? "+" : "−";
  return `${sign}${Math.abs(rounded)} ${pluralize(Math.abs(rounded), "day")}`;
}

export function formatPercent(fraction: number): string {
  return `${Math.round(fraction * 100)}%`;
}

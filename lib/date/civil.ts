/**
 * Civil dates — the only file in this codebase permitted to construct `Date` objects
 * (SPEC.md R1). A CivilDate is a branded "YYYY-MM-DD" string representing a date as a
 * person perceives it, with no attached time or timezone. Internally, whenever we need
 * to do calendar arithmetic we build a `Date` pinned to UTC **noon** for that Y-M-D and
 * only ever read back the UTC calendar fields. Because UTC has no DST transitions, this
 * trick makes addDays/diffDays immune to DST shifts, timezone offsets, and the classic
 * "period logged at 00:30 rolled back a day" bug — the arithmetic never touches local
 * time at all once a CivilDate exists.
 *
 * Per SPEC.md R3, this file must stay free of Date.now(), randomness, environment access
 * and React. `todayInZone` therefore takes the current instant as an explicit parameter
 * (epoch milliseconds) rather than reading the clock itself — the caller (I/O layer)
 * supplies "now"; this file only ever converts an already-known instant into a civil date.
 */

export type CivilDate = string & { readonly __civilDate: unique symbol };

const CIVIL_DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}

function pad4(n: number): string {
  return n.toString().padStart(4, "0");
}

/** Days-in-month lookup honoring leap years (Gregorian calendar). */
function daysInMonth(year: number, month1indexed: number): number {
  // Date.UTC handles month overflow, so day 0 of the *next* month = last day of this one.
  return new Date(Date.UTC(year, month1indexed, 0)).getUTCDate();
}

function isLeapYear(year: number): boolean {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

/**
 * True iff `s` is a syntactically well-formed "YYYY-MM-DD" string that names a real
 * Gregorian calendar date (rejects e.g. "2026-02-30", "2026-13-01", "2026-00-01").
 */
export function isValid(s: string): boolean {
  const m = CIVIL_DATE_RE.exec(s);
  if (!m) return false;
  const year = Number(m[1]);
  const month = Number(m[2]);
  const day = Number(m[3]);
  if (month < 1 || month > 12) return false;
  if (day < 1 || day > daysInMonth(year, month)) return false;
  return true;
}

/** Parse and validate a "YYYY-MM-DD" string. Throws on malformed or non-existent dates. */
export function parseCivil(s: string): CivilDate {
  if (!isValid(s)) {
    throw new Error(`Not a valid civil date: ${JSON.stringify(s)}`);
  }
  return s as CivilDate;
}

/** Construct a CivilDate from calendar parts. `month` is 1-indexed. Throws if invalid. */
export function toCivil(year: number, month: number, day: number): CivilDate {
  const s = `${pad4(year)}-${pad2(month)}-${pad2(day)}`;
  return parseCivil(s);
}

interface Parts {
  year: number;
  month: number; // 1-indexed
  day: number;
}

function parts(date: CivilDate): Parts {
  const m = CIVIL_DATE_RE.exec(date);
  if (!m) throw new Error(`Not a valid civil date: ${JSON.stringify(date)}`);
  return { year: Number(m[1]), month: Number(m[2]), day: Number(m[3]) };
}

/** The instant of this civil date, pinned to UTC noon, so DST can never shift it. */
function toUtcNoon(date: CivilDate): number {
  const { year, month, day } = parts(date);
  return Date.UTC(year, month - 1, day, 12, 0, 0, 0);
}

function fromUtcNoon(ms: number): CivilDate {
  const d = new Date(ms);
  return toCivil(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
}

const MS_PER_DAY = 24 * 60 * 60 * 1000;

/** Add (or subtract, for negative `days`) whole calendar days to a civil date. */
export function addDays(date: CivilDate, days: number): CivilDate {
  return fromUtcNoon(toUtcNoon(date) + days * MS_PER_DAY);
}

/** Number of calendar days from `from` to `to` (positive if `to` is later). */
export function diffDays(from: CivilDate, to: CivilDate): number {
  return Math.round((toUtcNoon(to) - toUtcNoon(from)) / MS_PER_DAY);
}

/**
 * Lexicographic comparison. This works correctly (and needs no Date construction) only
 * because "YYYY-MM-DD" is fixed-width and zero-padded: string order equals chronological
 * order for every valid CivilDate.
 */
export function compare(a: CivilDate, b: CivilDate): -1 | 0 | 1 {
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

export function min(...dates: CivilDate[]): CivilDate {
  if (dates.length === 0) throw new Error("min() requires at least one date");
  return dates.reduce((acc, d) => (compare(d, acc) < 0 ? d : acc));
}

export function max(...dates: CivilDate[]): CivilDate {
  if (dates.length === 0) throw new Error("max() requires at least one date");
  return dates.reduce((acc, d) => (compare(d, acc) > 0 ? d : acc));
}

/**
 * The civil date in IANA timezone `tz` at instant `epochMs`. Delegates to the platform's
 * ICU timezone database (via Intl.DateTimeFormat) rather than hand-rolled offset math, so
 * DST transitions and fractional-hour offsets (e.g. Pacific/Chatham's +13:45) are handled
 * correctly. `epochMs` must be supplied by the caller — see the file header re: R3.
 */
export function todayInZone(tz: string, epochMs: number): CivilDate {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: tz,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  // en-CA formats as YYYY-MM-DD, which is exactly our wire format.
  const formatted = formatter.format(new Date(epochMs));
  return parseCivil(formatted);
}

/** All civil dates from `start` to `end` inclusive. Empty array if `end` precedes `start`. */
export function rangeInclusive(start: CivilDate, end: CivilDate): CivilDate[] {
  const n = diffDays(start, end);
  if (n < 0) return [];
  const out: CivilDate[] = new Array(n + 1);
  for (let i = 0; i <= n; i++) out[i] = addDays(start, i);
  return out;
}

/**
 * A calendar month grid for display: an array of week-rows, each exactly 7 CivilDates,
 * beginning on the first `weekStartsOn` day on/before the 1st of the month and ending on
 * the last such day on/after the month's final day. Leading/trailing days from adjacent
 * months are included (typical calendar-UI behaviour) so every row is a full week.
 *
 * @param year   calendar year
 * @param month  1-indexed month (1 = January)
 * @param weekStartsOn 0 = Sunday, 1 = Monday
 */
export function monthGrid(
  year: number,
  month: number,
  weekStartsOn: 0 | 1,
): CivilDate[][] {
  const firstOfMonth = toCivil(year, month, 1);
  const lastOfMonth = toCivil(year, month, daysInMonth(year, month));

  const firstWeekday = new Date(toUtcNoon(firstOfMonth)).getUTCDay(); // 0=Sun..6=Sat
  const leadingOffset = (firstWeekday - weekStartsOn + 7) % 7;
  const gridStart = addDays(firstOfMonth, -leadingOffset);

  const lastWeekday = new Date(toUtcNoon(lastOfMonth)).getUTCDay();
  const trailingOffset = (weekStartsOn + 6 - lastWeekday + 7) % 7;
  const gridEnd = addDays(lastOfMonth, trailingOffset);

  const allDays = rangeInclusive(gridStart, gridEnd);
  const weeks: CivilDate[][] = [];
  for (let i = 0; i < allDays.length; i += 7) {
    weeks.push(allDays.slice(i, i + 7));
  }
  return weeks;
}

// Re-exported for callers that want leap-year logic without duplicating it (e.g. UI
// components deciding whether to render Feb 29).
export { isLeapYear };

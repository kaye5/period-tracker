/**
 * Pure date-range logic for the Report screen's range picker (SPEC.md's U4 brief:
 * "range picker 3/6/12-month or custom range"). SPEC.md R1 reserves `Date` construction
 * to `lib/date/civil.ts` — this module never constructs one itself; month subtraction is
 * done on the civil-date's own numeric parts, with `lib/date/civil.ts`'s `isValid` doing
 * the calendar-validity check (leap years, 30- vs 31-day months) that only it knows how
 * to do without a `Date`.
 */
import { compare, isValid as isValidCivilDate, toCivil, type CivilDate } from "@/lib/date/civil";
import { formatCivilDate } from "@/components/charts/format";

export type ReportRangeOption = "3m" | "6m" | "12m" | "custom";

export const REPORT_RANGE_OPTIONS: readonly { value: ReportRangeOption; label: string }[] = [
  { value: "3m", label: "Last 3 months" },
  { value: "6m", label: "Last 6 months" },
  { value: "12m", label: "Last 12 months" },
  { value: "custom", label: "Custom" },
];

export interface ReportRange {
  from: CivilDate;
  to: CivilDate;
}

interface CivilParts {
  year: number;
  month: number; // 1-indexed
  day: number;
}

function civilParts(date: CivilDate): CivilParts {
  const [year, month, day] = date.split("-").map(Number);
  return { year, month, day };
}

function pad2(n: number): string {
  return n < 10 ? `0${n}` : `${n}`;
}
function pad4(n: number): string {
  return String(n).padStart(4, "0");
}

/**
 * `date` minus `months` calendar months, clamping the day-of-month down when the target
 * month is shorter (e.g. Mar 31 − 1 month → Feb 28/29, never "Mar 3"). No `Date` object
 * is constructed here — `isValidCivilDate` (from `lib/date/civil.ts`) is the sole judge
 * of which candidate "YYYY-MM-DD" strings name a real calendar date.
 */
export function subtractMonths(date: CivilDate, months: number): CivilDate {
  const { year, month, day } = civilParts(date);
  const absoluteMonthIndex = year * 12 + (month - 1) - months;
  const newYear = Math.floor(absoluteMonthIndex / 12);
  const newMonth = absoluteMonthIndex - newYear * 12 + 1; // 1..12

  for (let candidateDay = day; candidateDay >= 1; candidateDay--) {
    const candidate = `${pad4(newYear)}-${pad2(newMonth)}-${pad2(candidateDay)}`;
    if (isValidCivilDate(candidate)) return toCivil(newYear, newMonth, candidateDay);
  }
  // Day 1 of any month is always valid; unreachable in practice.
  return toCivil(newYear, newMonth, 1);
}

const PRESET_MONTHS: Record<Exclude<ReportRangeOption, "custom">, number> = {
  "3m": 3,
  "6m": 6,
  "12m": 12,
};

export interface CustomRangeInput {
  from: CivilDate | null;
  to: CivilDate | null;
}

export interface ReportRangeResult {
  range: ReportRange | null;
  error: string | null;
}

/**
 * Resolves the picker's current selection into a concrete `{from, to}` range, or an
 * honest error for an incomplete/invalid custom range — never a silently-clamped guess.
 * A preset range always ends "today" (the report is always "as of now"); a custom range
 * ending after today is clamped back to today, since there is no future data to report.
 */
export function resolveReportRange(
  option: ReportRangeOption,
  today: CivilDate,
  custom: CustomRangeInput = { from: null, to: null },
): ReportRangeResult {
  if (option !== "custom") {
    const months = PRESET_MONTHS[option];
    return { range: { from: subtractMonths(today, months), to: today }, error: null };
  }

  if (custom.from === null || custom.to === null) {
    return { range: null, error: "Choose both a start and an end date." };
  }
  if (compare(custom.from, custom.to) > 0) {
    return { range: null, error: "The start date must be on or before the end date." };
  }
  const to = compare(custom.to, today) > 0 ? today : custom.to;
  return { range: { from: custom.from, to }, error: null };
}

/** "Jan 1, 2026 – Jul 23, 2026" — the range as it should appear in the report header. */
export function formatReportRange(range: ReportRange): string {
  return `${formatCivilDate(range.from)} – ${formatCivilDate(range.to)}`;
}

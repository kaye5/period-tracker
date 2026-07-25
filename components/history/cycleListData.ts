/**
 * Pure view-model builders for the History screen's cycle list (agent U4; SPEC.md's U4
 * brief: "Cycles the engine marked gap_unknown / skip_suspected / excluded appear in the
 * list WITH their statusReason — never silently dropped"; R7: "an excluded cycle stays
 * visible in history, marked, with the reason").
 */
import { compare, isValid as isValidCivilDate, type CivilDate } from "@/lib/date/civil";
import type { Cycle } from "@/lib/domain/types";
import type { SkipPromptItem } from "@/lib/engine";
import { formatCivilDate } from "@/components/charts/format";

// ============================================================================
// Status labels — same non-colour-only posture as components/charts/CycleLengthChart.tsx
// (SPEC.md §4.2/§4.5: never colour alone), restated here for the list view's own copy.
// ============================================================================

export const CYCLE_STATUS_LABEL: Record<Cycle["status"], string> = {
  ok: "Recorded",
  gap_unknown: "Gap — unknown",
  skip_suspected: "Possible missed period",
  excluded_by_user: "Excluded by you",
  in_progress: "In progress",
};

export interface CycleRowViewModel {
  cycle: Cycle;
  key: CivilDate;
  dateRangeText: string;
  lengthText: string;
  statusLabel: string;
  /** The engine's own `statusReason`, restated verbatim — never dropped (R7). */
  statusReason: string | null;
  isAnomalous: boolean;
  isHighlighted: boolean;
}

/** "Jul 1, 2026 – Jul 5, 2026" or "Jul 1, 2026 – (ongoing)" for the in-progress cycle. */
function dateRangeText(cycle: Cycle): string {
  const start = formatCivilDate(cycle.startDate);
  if (cycle.nextStartDate === null) return `${start} – present`;
  // A cycle's own "end" for display purposes is the day before the next cycle starts.
  return `${start} – ${formatCivilDate(cycle.nextStartDate)}`;
}

function lengthText(cycle: Cycle): string {
  if (cycle.lengthDays === null) return "Length not yet known";
  return `${cycle.lengthDays} day${cycle.lengthDays === 1 ? "" : "s"}`;
}

/** Chronological, most-recent-first — the order a history list reads naturally. */
export function sortCyclesDescending(cycles: readonly Cycle[]): Cycle[] {
  return [...cycles].sort((a, b) => compare(b.startDate, a.startDate));
}

/** Cycle dates the row's episode overlaps, for the `?dates=` highlight contract
 * documented in `components/dashboard/links.ts` ("history list, expected to
 * highlight/filter to just those dates"). Uses the episode's own bleeding/spotting
 * days plus its start date, since that's the set a dashboard insight could plausibly
 * link to. */
function cycleContainsAnyDate(cycle: Cycle, dates: ReadonlySet<CivilDate>): boolean {
  if (dates.has(cycle.startDate)) return true;
  for (const d of cycle.episode.menstrualDays) if (dates.has(d)) return true;
  for (const d of cycle.episode.spottingDays) if (dates.has(d)) return true;
  return false;
}

export function buildCycleRowViewModels(
  cycles: readonly Cycle[],
  highlightedDates: readonly CivilDate[] = [],
): CycleRowViewModel[] {
  const highlightSet = new Set(highlightedDates);
  return sortCyclesDescending(cycles).map((cycle) => ({
    cycle,
    key: cycle.startDate,
    dateRangeText: dateRangeText(cycle),
    lengthText: lengthText(cycle),
    statusLabel: CYCLE_STATUS_LABEL[cycle.status],
    statusReason: cycle.statusReason ?? null,
    isAnomalous: cycle.status !== "ok" && cycle.status !== "in_progress",
    isHighlighted: highlightSet.size > 0 && cycleContainsAnyDate(cycle, highlightSet),
  }));
}

/** When the `?dates=` filter is active, only the matching rows — but never an empty
 * list silently: if nothing matches (e.g. a stale link), the caller falls back to the
 * unfiltered list rather than showing nothing. */
export function applyDateFilter(
  rows: readonly CycleRowViewModel[],
  highlightedDates: readonly CivilDate[],
): { rows: CycleRowViewModel[]; filtered: boolean } {
  if (highlightedDates.length === 0) return { rows: [...rows], filtered: false };
  const matching = rows.filter((r) => r.isHighlighted);
  if (matching.length === 0) return { rows: [...rows], filtered: false };
  return { rows: matching, filtered: true };
}

/** Parses the `dates` query-string value from `components/dashboard/links.ts`'s
 * `historyHref` contract (`?dates=YYYY-MM-DD,YYYY-MM-DD,...`), tolerating malformed
 * entries by dropping them rather than crashing the page. */
export function parseDatesParam(raw: string | undefined | null): CivilDate[] {
  if (!raw) return [];
  return raw
    .split(",")
    .map((s) => s.trim())
    .filter(isValidCivilDate) as CivilDate[];
}

// ============================================================================
// Skip prompts — "did you miss logging a period around {date}?"
// ============================================================================

export interface SkipPromptViewModel {
  cycleStartDate: CivilDate;
  question: string;
  suggestedDate: CivilDate;
  suggestedDateText: string;
  /** Alternative candidate dates beyond the suggested one (k* > 2 case) — shown as a
   * secondary choice, never forced, since the engine itself only picks the first one as
   * "most actionable" and leaves the rest as options. */
  alternativeDates: { date: CivilDate; text: string }[];
}

export function buildSkipPromptViewModels(items: readonly SkipPromptItem[]): SkipPromptViewModel[] {
  return [...items]
    .sort((a, b) => compare(a.cycleStartDate, b.cycleStartDate))
    .map((item) => ({
      cycleStartDate: item.cycleStartDate,
      question: item.prompt.question,
      suggestedDate: item.prompt.suggestedDate,
      suggestedDateText: formatCivilDate(item.prompt.suggestedDate),
      alternativeDates: item.prompt.options
        .filter((d) => d !== item.prompt.suggestedDate)
        .map((d) => ({ date: d, text: formatCivilDate(d) })),
    }));
}

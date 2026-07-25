/**
 * "View the records behind this" deep links (this agent's brief: "Every insight card
 * carries its supporting evidence and a 'view the records behind this' control that
 * deep-links into the history/day views using the Insight.supportingDates the engine
 * provides. An insight without visible supporting records fails the PRD's acceptance
 * criteria.").
 *
 * There is no /log route: a single supporting date opens the app-wide day-log dialog
 * (PrimaryCard calls `useDayLog().open(date)` directly). Multiple/zero dates still deep
 * link into the history view via `historyHref` below — the history list highlights/filters
 * to just those dates; an empty list falls back to the default recent list.
 */
import type { CivilDate } from "@/lib/date/civil";
import { compare } from "@/lib/date/civil";

export function historyHref(dates: readonly CivilDate[]): string {
  if (dates.length === 0) return "/history";
  const sorted = [...dates].sort(compare);
  const params = new URLSearchParams({ dates: sorted.join(",") });
  return `/history?${params.toString()}`;
}

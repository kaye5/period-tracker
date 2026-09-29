/**
 * Pure logic behind the History screen's "edit a historical period" sheet (SPEC.md's U4
 * brief: "Inline editing of a historical period goes through app/api/day-logs and
 * refreshes (the engine recomputes everything downstream — SPEC §4.1)").
 *
 * Editing a period here means editing the underlying `DayLog.bleeding`/`flow` for each
 * day in a small window around the recorded episode — the engine derives episodes and
 * cycles from `dayLogs` (R2), so there is no "period" record to edit directly; the UI
 * edits the recorded days, and a fresh `computeEverything` re-derives everything else.
 *
 * `PUT /api/day-logs/:date` is a full replace ("no partial-update helper on purpose" —
 * `lib/repo/dayLogs.ts`), so every write here is a read-merge-write: start from the
 * existing `DayLog` (if any) and only change the bleeding-related fields, leaving
 * symptoms/pain/notes/mood/fertility untouched (R7: never silently discard user data).
 */
import { addDays, compare, max, rangeInclusive, type CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, BleedingKind, DayLog, FlowLevel } from "@/lib/domain/types";
import { formatCivilDate } from "@/components/charts/format";

/** Days of padding shown on either side of the recorded episode, so the user can
 * extend the period (a day was missed) or shrink it (a day was logged by mistake)
 * without needing a second control to change the visible window. [choice] — no research
 * source names a window size for this UI affordance; 5 days is generous relative to the
 * shortest valid period length while staying well short of `MIN_CYCLE` (10 days), so an
 * edit window can never accidentally reach into the *next* period for a typical cycle. */
export const EDIT_PAD_DAYS = 5;

export interface PeriodEditRow {
  date: CivilDate;
  bleeding: BleedingKind;
  flow?: FlowLevel;
}

export interface PeriodEditDraft {
  rangeStart: CivilDate;
  rangeEnd: CivilDate;
  rows: PeriodEditRow[];
}

/** The last day this episode covers, whether or not it has an explicit `endDate`
 * (an ongoing/never-closed episode still has a last logged day). */
function lastEpisodeDay(episode: BleedingEpisode): CivilDate {
  if (episode.endDate !== null) return episode.endDate;
  const candidates = [episode.startDate, ...episode.menstrualDays, ...episode.spottingDays];
  return max(...candidates);
}

/** The editable window around an episode: its recorded span, padded by
 * `EDIT_PAD_DAYS` on each side. */
export function buildEditableRange(
  episode: BleedingEpisode,
  padDays: number = EDIT_PAD_DAYS,
): { start: CivilDate; end: CivilDate } {
  return {
    start: addDays(episode.startDate, -padDays),
    end: addDays(lastEpisodeDay(episode), padDays),
  };
}

/** One row per day in `range`, seeded from whatever `DayLog` already exists for that
 * date (an unlogged day starts as `bleeding: 'none'`, nothing invented). */
export function buildPeriodEditDraft(
  range: { start: CivilDate; end: CivilDate },
  dayLogsByDate: ReadonlyMap<CivilDate, DayLog>,
): PeriodEditDraft {
  const rows = rangeInclusive(range.start, range.end).map((date) => {
    const log = dayLogsByDate.get(date);
    return { date, bleeding: log?.bleeding ?? "none", flow: log?.flow };
  });
  return { rangeStart: range.start, rangeEnd: range.end, rows };
}

/** Sets a row's bleeding kind. Clearing to `'none'` also clears `flow` — a non-bleeding
 * day has no flow level to speak of, and leaving a stale one would silently mislabel it
 * later. */
export function setRowBleeding(
  draft: PeriodEditDraft,
  date: CivilDate,
  bleeding: BleedingKind,
): PeriodEditDraft {
  return {
    ...draft,
    rows: draft.rows.map((row) =>
      row.date === date ? { date, bleeding, flow: bleeding === "none" ? undefined : row.flow } : row,
    ),
  };
}

/** Sets a row's flow level. Ignored (returns `draft` unchanged) for a `'none'` row —
 * there is nothing to set a flow level on. */
export function setRowFlow(draft: PeriodEditDraft, date: CivilDate, flow: FlowLevel): PeriodEditDraft {
  return {
    ...draft,
    rows: draft.rows.map((row) => (row.date === date && row.bleeding !== "none" ? { ...row, flow } : row)),
  };
}

// ============================================================================
// Boundary detection — periodBoundary is "an explicit user assertion, not inferred"
// (SPEC.md §3), and this *is* the user's explicit assertion: editing the draft in this
// sheet and saving it is exactly the act of asserting where the period starts and ends.
// ============================================================================

export interface PeriodBoundary {
  start: CivilDate;
  end: CivilDate;
}

/** Finds the contiguous run of bleeding days (any non-`'none'` kind) in the draft that
 * contains — or is nearest to — `anchorDate` (normally the episode's original start
 * date), and returns its first/last day. Returns `null` when the draft has no bleeding
 * day left at all (the user cleared the whole period). */
export function computeBoundary(draft: PeriodEditDraft, anchorDate: CivilDate): PeriodBoundary | null {
  const rows = draft.rows;
  let idx = rows.findIndex((r) => r.date === anchorDate);
  if (idx === -1) idx = 0;

  if (rows[idx]?.bleeding === "none" || idx >= rows.length) {
    let left = idx - 1;
    let right = idx + 1;
    let found = -1;
    while (left >= 0 || right < rows.length) {
      if (left >= 0 && rows[left].bleeding !== "none") {
        found = left;
        break;
      }
      if (right < rows.length && rows[right].bleeding !== "none") {
        found = right;
        break;
      }
      left--;
      right++;
    }
    if (found === -1) return null;
    idx = found;
  }

  let start = idx;
  let end = idx;
  while (start - 1 >= 0 && rows[start - 1].bleeding !== "none") start--;
  while (end + 1 < rows.length && rows[end + 1].bleeding !== "none") end++;
  return { start: rows[start].date, end: rows[end].date };
}

// ============================================================================
// Diffing against the original day logs — only changed days are written
// ============================================================================

function defaultDayLog(date: CivilDate, today: CivilDate): DayLog {
  return {
    date,
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: today,
  };
}

/**
 * The `DayLog`s that actually need writing to reflect this draft — a read-merge-write
 * per changed day (R7: never discard fields this editor doesn't know about). A day
 * whose bleeding, flow and boundary all match what's already recorded is omitted
 * entirely, so saving a draft with no real edits issues zero requests.
 *
 * Re-asserting the start/end boundary markers only happens when the user actually
 * edited some day's bleeding/flow in this draft. Without that gate, opening an
 * *ongoing* period (no explicit end logged) and saving with zero changes would still
 * "discover" a boundary — the last already-logged bleeding day — and write
 * `periodBoundary: 'end'` on it, silently declaring the period over even though the
 * user never asserted that. An edit to the draft IS the user's assertion (per this
 * file's header comment); the absence of one is not.
 *
 * The `end` marker is never written for `today` or later, even when the draft's last
 * bleeding day is there. `periodBoundary: 'end'` means "this period is over", and a day
 * that has not finished yet cannot carry that assertion — writing it closed the ongoing
 * period behind the user's back the moment they edited any day in the sheet, which also
 * silently killed the calendar's "period expected to continue" days. (Same reasoning as
 * `buildEpisodes`'s `compare(date, today) < 0` guard.) The day-log dialog's explicit
 * "last day" control remains the way to end a period that is still running. `start` is
 * unaffected: a period demonstrably did begin on a past-or-present day.
 *
 * `today` stamps `loggedAt` only on days that had no prior `DayLog` (a brand-new
 * record is genuinely being logged today); an edit to an existing day's `loggedAt` is
 * left untouched, since `loggedAt` records when the entry was first made (S17), not
 * when it was last edited.
 */
export function buildDayLogsToSave(
  draft: PeriodEditDraft,
  originalDayLogsByDate: ReadonlyMap<CivilDate, DayLog>,
  boundary: PeriodBoundary | null,
  today: CivilDate,
): DayLog[] {
  const userEditedBleeding = draft.rows.some((row) => {
    const original = originalDayLogsByDate.get(row.date);
    return row.bleeding !== (original?.bleeding ?? "none") || row.flow !== original?.flow;
  });

  const out: DayLog[] = [];
  for (const row of draft.rows) {
    const original = originalDayLogsByDate.get(row.date);
    const originalBleeding = original?.bleeding ?? "none";
    const originalFlow = original?.flow;
    const originalBoundary = original?.periodBoundary;

    const nextBoundary: "start" | "end" | undefined = userEditedBleeding
      ? boundary !== null && compare(row.date, boundary.start) === 0
        ? "start"
        : boundary !== null &&
            compare(row.date, boundary.end) === 0 &&
            compare(boundary.end, today) < 0
          ? "end"
          : undefined
      : originalBoundary;

    const changed =
      row.bleeding !== originalBleeding || row.flow !== originalFlow || nextBoundary !== originalBoundary;
    if (!changed) continue;

    const base = original ?? defaultDayLog(row.date, today);
    const next: DayLog = { ...base, date: row.date, bleeding: row.bleeding };
    if (row.flow !== undefined) next.flow = row.flow;
    else delete next.flow;
    if (nextBoundary !== undefined) next.periodBoundary = nextBoundary;
    else delete next.periodBoundary;

    out.push(next);
  }
  return out;
}

/** "Jul 1 – Jul 5, 2026" — the draft's current boundary, for the sheet's header. */
export function describeBoundary(boundary: PeriodBoundary | null): string {
  if (boundary === null) return "No period days selected";
  return `${formatCivilDate(boundary.start)} – ${formatCivilDate(boundary.end)}`;
}

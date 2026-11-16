/**
 * Pure logic behind Today's quick-log card (Daylight redesign) and the MCP write tools: one tap = one change to
 * one day's DayLog, merged onto whatever was already recorded for that day and POSTed
 * through the same /api/day-logs upsert the full form uses. Nothing here does I/O, so it
 * is unit-testable directly (SPEC.md R10).
 *
 * R7 discipline, as in components/calendar/quickPeriodLog.ts: a quick tap only asserts the one fact
 * it names and keeps every other recorded field. A positive assertion (a period day, a
 * mood, a symptom) clears `nothingToReport`, since a day cannot be both a recorded true
 * negative and carry that fact.
 */
import { diffDays, compare, type CivilDate } from "@/lib/date/civil";
import type { Cycle, DayLog, FlowLevel, MoodId, SymptomId } from "@/lib/domain/types";
import { PERIOD_DURATION_BOUNDS } from "@/components/onboarding/onboardingAnswers";
import { nothingToReportPayload, toggleMember } from "@/components/daylog/dayLogFormState";

export type QuickAction =
  /** Today is (on) / is not (off) a period day. `start` also marks it the first day. */
  | { kind: "period"; on: boolean; start?: boolean }
  /** The day is (on) / is not (off) the last day of the period — closes the episode. */
  | { kind: "lastDay"; on: boolean }
  | { kind: "flow"; flow: FlowLevel | undefined }
  /** `on` undefined toggles (Today's chips); true/false ensures present/absent (idempotent). */
  | { kind: "mood"; mood: MoodId; on?: boolean }
  | { kind: "symptom"; symptom: SymptomId; on?: boolean }
  /** The day is (on) / is not (off) a spotting day. Spotting never carries flow or a boundary. */
  | { kind: "spotting"; on: boolean }
  | { kind: "nothing" };

export function emptyDayLog(date: CivilDate, today: CivilDate): DayLog {
  return { date, bleeding: "none", pain: { severity: "none" }, symptoms: [], loggedAt: today };
}

/** The DayLog to upsert for `date` after `action`. `existing` is that date's current log. */
export function applyQuickAction(
  existing: DayLog | undefined,
  action: QuickAction,
  date: CivilDate,
  today: CivilDate,
): DayLog {
  if (action.kind === "nothing") return nothingToReportPayload(date, today, existing?.loggedAt);

  const base: DayLog = { ...(existing ?? emptyDayLog(date, today)), date };
  const positive: DayLog = { ...base, nothingToReport: undefined };

  switch (action.kind) {
    case "period":
      if (!action.on) {
        // Mirrors the form's "period off": flow and boundary only make sense on a period day.
        return { ...base, bleeding: "none", flow: undefined, periodBoundary: undefined };
      }
      return {
        ...positive,
        bleeding: "menstrual",
        periodBoundary: action.start ? "start" : base.periodBoundary,
      };
    case "lastDay":
      return action.on
        ? { ...positive, bleeding: "menstrual", periodBoundary: "end" }
        : { ...base, periodBoundary: undefined };
    case "spotting":
      return action.on
        ? { ...positive, bleeding: "spotting", flow: undefined, periodBoundary: undefined }
        : { ...base, bleeding: "none", flow: undefined, periodBoundary: undefined };
    case "flow":
      return { ...positive, bleeding: "menstrual", flow: action.flow };
    case "mood": {
      if (alreadySo(base.mood ?? [], action.mood, action.on)) return base;
      const mood = toggleMember(base.mood ?? [], action.mood);
      return { ...positive, mood: mood.length ? mood : undefined };
    }
    case "symptom":
      if (alreadySo(base.symptoms, action.symptom, action.on)) return base;
      return { ...positive, symptoms: toggleMember(base.symptoms, action.symptom) };
  }
}

/** An explicit add/remove (`on` set) that would change nothing. */
function alreadySo<T>(list: readonly T[], value: T, on: boolean | undefined): boolean {
  return on !== undefined && list.includes(value) === on;
}

/**
 * Which period control Today offers:
 *  - "today": today is already logged as a period day (offer flow + "last day").
 *  - "ongoing": an open period whose last recorded period day was before today (offer
 *    "period today" and "it ended on <lastPeriodDay>").
 *  - "none": no open period (offer "period started today").
 *
 * An episode the engine still has open but that started PERIOD_DURATION_BOUNDS.max or more
 * days ago is treated as "none": the engine only closes an episode on positive evidence,
 * so a period never marked as ended stays open forever, and offering "period today" for it
 * months later would be wrong. The bound is the app's existing period-length limit, not a
 * new constant.
 */
export type QuickPeriodStatus =
  | { kind: "today" }
  | { kind: "ongoing"; lastPeriodDay: CivilDate }
  | { kind: "none" };

export function quickPeriodStatus(
  todayLog: DayLog | undefined,
  cycles: readonly Cycle[],
  today: CivilDate,
): QuickPeriodStatus {
  if (todayLog?.bleeding === "menstrual") return { kind: "today" };
  const open = cycles.find(
    (c) => c.episode.endDate === null && c.episode.menstrualDays.length > 0,
  );
  if (!open || diffDays(open.episode.startDate, today) >= PERIOD_DURATION_BOUNDS.max) {
    return { kind: "none" };
  }
  const days = open.episode.menstrualDays.filter((d) => compare(d, today) < 0);
  const lastPeriodDay = days[days.length - 1];
  return lastPeriodDay ? { kind: "ongoing", lastPeriodDay } : { kind: "none" };
}

/** Symptoms offered on Today: the user's most-logged, falling back to the first entries of
 * the default panel when there is no history yet. */
export function quickSymptoms(
  frequencies: readonly { symptom: SymptomId; occurrences: number }[],
  fallback: readonly SymptomId[],
  limit: number,
): SymptomId[] {
  const logged = frequencies
    .filter((f) => f.occurrences > 0)
    .slice()
    .sort((a, b) => b.occurrences - a.occurrences || a.symptom.localeCompare(b.symptom))
    .map((f) => f.symptom);
  const picked = [...logged, ...fallback.filter((s) => !logged.includes(s))];
  return picked.slice(0, limit);
}

/**
 * Pure presenters for the MCP read tools (MCP-SPEC "Read tools"): select and shape what the
 * engine already computed — nothing is recomputed here. Mirrors Today
 * (components/dashboard/DashboardScreen.tsx) so a client sees the same answers as the app.
 */
import { compare, diffDays, isValid, type CivilDate } from "@/lib/date/civil";
import type { DayLog, Profile } from "@/lib/domain/types";
import { cyclePhase, type EngineResult } from "@/lib/engine";
import { CONFIDENCE_LABELS, FERTILITY_DISCLAIMER, PHASE_LABELS } from "@/lib/copy/general";
import { INSIGHT_DISCLAIMER } from "@/lib/copy/insights";
import { quickPeriodStatus } from "@/lib/logging/quickActions";
import { expectedPeriodRange } from "@/components/calendar/dayIndicators";
import type { DashboardCalendarData } from "@/components/dashboard/DashboardScreen";

/** `loadCycleData`'s result once a profile exists. */
export interface CycleView {
  profile: Profile;
  today: CivilDate;
  logsByDate: Map<CivilDate, DayLog>;
  dayLogs: DayLog[];
  output: EngineResult;
  calendar: DashboardCalendarData;
}

export const NEXT_PERIOD_NOTE = "This is an estimate. Always present it as a range, never a single date.";

/** The period in progress, by Today's rule (`quickPeriodStatus`, incl. its staleness bound). */
export function ongoingPeriod({ output, today, logsByDate }: Pick<CycleView, "output" | "today" | "logsByDate">) {
  const status = quickPeriodStatus(logsByDate.get(today), output.cycles, today);
  if (status.kind === "none") return null;
  const lastRecordedDay = status.kind === "today" ? today : status.lastPeriodDay;
  const episode = output.episodes.find((e) => e.menstrualDays.includes(lastRecordedDay));
  return episode ? { startDate: episode.startDate, lastRecordedDay } : null;
}

export function presentToday(view: CycleView) {
  const { output, profile, today, logsByDate } = view;
  const todayLog = logsByDate.get(today);
  const fertility = profile.settings.fertilityEnabled ? (output.fertility ?? null) : null;
  const current = output.cycles.find((c) => c.status === "in_progress") ?? null;
  const phase = current
    ? cyclePhase({
        date: today,
        cycleStart: current.startDate,
        predictedHigh: output.prediction.high,
        fertility,
        isBleeding: todayLog?.bleeding === "menstrual",
      })
    : null;
  return {
    date: today,
    cycleDay: current ? diffDays(current.startDate, today) + 1 : null,
    phase: phase ? { name: phase, label: PHASE_LABELS[phase], estimated: phase !== "menstrual" } : null,
    periodToday: todayLog?.bleeding === "menstrual",
    ongoingPeriod: ongoingPeriod(view),
    loggedToday: todayLog
      ? {
          bleeding: todayLog.bleeding,
          flow: todayLog.flow ?? null,
          moods: todayLog.mood ?? [],
          symptoms: todayLog.symptoms,
          nothingToReport: todayLog.nothingToReport === true,
        }
      : null,
  };
}

/** SPEC R8: a range or nothing — `prediction.center` is deliberately never read here. */
export function presentNextPeriod({ output, today }: CycleView) {
  const p = output.prediction;
  const range = p.low !== null && p.high !== null ? { from: p.low, to: p.high } : null;
  return {
    range,
    confidence: { label: CONFIDENCE_LABELS[p.confidence], reason: p.confidenceReason },
    basedOnCycles: p.basis.usableCycles,
    predictionKind: p.kind,
    daysUntilRange: range && compare(today, range.from) < 0 ? diffDays(today, range.from) : null,
    overdueByDays: range && compare(today, range.to) > 0 ? diffDays(range.to, today) : null,
    note: NEXT_PERIOD_NOTE,
  };
}

export function presentPeriodLength(view: CycleView) {
  const { output, profile, today, calendar } = view;
  const d = output.stats.periodDuration;
  const reported = profile.reportedTypicalPeriodDays;
  const typicalDuration = d
    ? { low: d.low, high: d.high, basedOnPeriods: d.n, source: "recorded" as const }
    : reported != null
      ? { low: reported, high: reported, basedOnPeriods: 0, source: "self_reported" as const }
      : null;
  const ongoing = ongoingPeriod(view);
  const expected = expectedPeriodRange(output.cycles, calendar.typicalPeriodDays, today);
  return {
    typicalDuration,
    current: ongoing && {
      ...ongoing,
      daysSoFar: diffDays(ongoing.startDate, ongoing.lastRecordedDay) + 1,
      expectedToContinueThrough: expected && { from: expected.from, to: expected.through },
    },
  };
}

export function presentCycleStats({ output }: CycleView) {
  const t = output.stats.typicalCycleLength;
  return {
    typicalCycleLength: t && { low: t.low, high: t.high, basedOnCycles: t.n },
    variability: output.stats.variabilityHeadline,
    completedCycles: output.stats.completedCycleCount,
  };
}

export function presentFertileWindow({ output, profile }: CycleView) {
  if (!profile.settings.fertilityEnabled) {
    return { enabled: false, message: "Fertility features are off in Settings." };
  }
  const f = output.fertility;
  return {
    enabled: true,
    fertileWindow: f ? { from: f.fertileLow, to: f.fertileHigh } : null,
    ovulation: f ? { from: f.ovulationLow, to: f.ovulationHigh } : null,
    confidenceNote: f?.confidenceNote ?? null,
    disclaimer: FERTILITY_DISCLAIMER,
  };
}

export function presentInsights({ output }: CycleView) {
  return { insights: output.insights, disclaimer: INSIGHT_DISCLAIMER };
}

export function presentHealthNotes({ output }: CycleView) {
  const urgent = output.healthMessages.filter((m) => m.severity === "seek_urgent_care");
  const rest = output.healthMessages.filter((m) => m.severity !== "seek_urgent_care");
  return { notes: [...urgent, ...rest] };
}

export const MAX_HISTORY_DAYS = 366;

/** A plain-language reason the range is unusable, or null. */
export function historyRangeError(from: string, to: string): string | null {
  if (!isValid(from) || !isValid(to)) return "from and to must be valid YYYY-MM-DD dates.";
  const days = diffDays(from as CivilDate, to as CivilDate) + 1;
  if (days < 1) return "to must be on or after from.";
  if (days > MAX_HISTORY_DAYS) return `The range can cover at most ${MAX_HISTORY_DAYS} days.`;
  return null;
}

export function presentHistory({ dayLogs }: CycleView, from: CivilDate, to: CivilDate) {
  const days = dayLogs
    .filter((l) => compare(l.date, from) >= 0 && compare(l.date, to) <= 0)
    .sort((a, b) => compare(a.date, b.date));
  return { from, to, days };
}

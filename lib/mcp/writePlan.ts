/**
 * Pure planning for the MCP write tools (MCP-SPEC "Write tools"): which day a call writes,
 * the merged DayLog to save, or a plain-language refusal. No I/O. Every change goes through
 * Today's own `applyQuickAction`, so a tool call saves exactly what the matching tap would.
 */
import { isDeepStrictEqual } from "node:util";
import { compare, isValid, type CivilDate } from "@/lib/date/civil";
import type { Cycle, DayLog, FlowLevel, MoodId, Settings, SymptomId } from "@/lib/domain/types";
import { SYMPTOM_PANEL_TIER_C } from "@/lib/engine/constants";
import { SYMPTOM_LABELS } from "@/lib/copy/insights";
import { applyQuickAction, emptyDayLog, quickPeriodStatus, type QuickAction } from "@/lib/logging/quickActions";

export const FUTURE_DATE = "Can't log a future date.";
export const INVALID_DATE = "date must be a valid YYYY-MM-DD calendar date.";
export const NO_OPEN_PERIOD = "No ongoing period found to end.";
export const HAS_DATA =
  "This day already has recorded data, and nothing to report would replace it. Use log_period_day, log_spotting, log_mood or log_symptoms to add to it instead.";

type Mode = "add" | "remove";

export type WriteInput = { date?: string } & (
  | { tool: "log_period_start" }
  | { tool: "log_period_day"; flow?: FlowLevel }
  | { tool: "log_period_end" }
  | { tool: "log_spotting" }
  | { tool: "log_mood"; moods: MoodId[]; mode?: Mode }
  | { tool: "log_symptoms"; symptoms: SymptomId[]; mode?: Mode }
  | { tool: "log_nothing_to_report" }
);

export interface WriteContext {
  today: CivilDate;
  logsByDate: Map<CivilDate, DayLog>;
  cycles: readonly Cycle[];
  settings: Settings;
}

export type WritePlan =
  | { ok: false; error: string }
  /** `changed: false` → the saved log already says this (or there is nothing to remove); don't write. */
  | { ok: true; date: CivilDate; dayLog: DayLog; changed: boolean; changedFromPeriod?: boolean };

const refuse = (error: string) => ({ ok: false as const, error });

/** Same recorded facts, ignoring key order and keys that are merely undefined. */
function sameLog(a: DayLog, b: DayLog): boolean {
  return isDeepStrictEqual(JSON.parse(JSON.stringify(a)), JSON.parse(JSON.stringify(b)));
}

export function planWrite(ctx: WriteContext, input: WriteInput): WritePlan {
  const { today, logsByDate } = ctx;
  let date: CivilDate = today;
  if (input.date !== undefined) {
    if (!isValid(input.date)) return refuse(INVALID_DATE);
    date = input.date as CivilDate;
    if (compare(date, today) > 0) return refuse(FUTURE_DATE);
  } else if (input.tool === "log_period_end") {
    const status = quickPeriodStatus(logsByDate.get(today), ctx.cycles, today);
    if (status.kind === "none") return refuse(NO_OPEN_PERIOD);
    if (status.kind === "ongoing") date = status.lastPeriodDay;
  }

  const existing = logsByDate.get(date);
  const actions: QuickAction[] = [];
  switch (input.tool) {
    case "log_period_start":
      actions.push({ kind: "period", on: true, start: true });
      break;
    case "log_period_day":
      actions.push({ kind: "period", on: true });
      if (input.flow) actions.push({ kind: "flow", flow: input.flow });
      break;
    case "log_period_end":
      actions.push({ kind: "lastDay", on: true });
      break;
    case "log_spotting":
      actions.push({ kind: "spotting", on: true });
      break;
    case "log_mood":
      for (const mood of input.moods) actions.push({ kind: "mood", mood, on: input.mode !== "remove" });
      break;
    case "log_symptoms": {
      const off = settingsOff(input.symptoms, ctx.settings);
      if (off.length) {
        return refuse(
          `These symptoms are turned off in Settings: ${off.map((s) => SYMPTOM_LABELS[s]).join(", ")}. Turn on "Extra symptom tracking" in the app's Settings to log them.`,
        );
      }
      for (const symptom of input.symptoms) actions.push({ kind: "symptom", symptom, on: input.mode !== "remove" });
      break;
    }
    case "log_nothing_to_report":
      if (existing?.nothingToReport) return { ok: true, date, dayLog: existing, changed: false };
      if (existing && !sameLog({ ...existing, nothingToReport: undefined }, emptyDayLog(date, existing.loggedAt))) {
        return refuse(HAS_DATA);
      }
      actions.push({ kind: "nothing" });
      break;
  }

  const dayLog = actions.reduce<DayLog | undefined>((log, a) => applyQuickAction(log, a, date, today), existing)!;
  const plan: WritePlan = {
    ok: true,
    date,
    dayLog,
    changed: !sameLog(dayLog, existing ?? emptyDayLog(date, today)),
  };
  if (input.tool === "log_spotting") plan.changedFromPeriod = existing?.bleeding === "menstrual";
  return plan;
}

function settingsOff(symptoms: readonly SymptomId[], settings: Settings): SymptomId[] {
  if (settings.tierCSymptomsEnabled) return [];
  return symptoms.filter((s) => (SYMPTOM_PANEL_TIER_C as readonly SymptomId[]).includes(s));
}

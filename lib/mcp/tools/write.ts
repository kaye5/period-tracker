import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import { formatInstant } from "@/lib/date/civil";
import { dayLogSchema } from "@/lib/domain/schema";
import { getDayLogUpdatedAt, upsertDayLog } from "@/lib/repo/dayLogs";
import { loadCycleData } from "@/lib/cycleView/load";
import { envelope, resolveMcpTimeZone, timeContext, toolError, toolResult } from "@/lib/mcp/envelope";
import { civilDate, envelopeOutput, flowLevel, moodId, symptomId, timeZone } from "@/lib/mcp/schemas";
import { presentToday, type CycleView } from "@/lib/mcp/present";
import { NO_PROFILE, TIME_ZONE_NOTE } from "@/lib/mcp/tools/read";
import { planWrite, type WriteInput } from "@/lib/mcp/writePlan";

const date = civilDate.optional().describe("The day, YYYY-MM-DD; defaults to today. Not in the future.");
const mode = z.enum(["add", "remove"]).default("add").describe("add (default) or remove exactly these; never toggles.");
const ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };
const MERGE_NOTE = "Merges into the day's existing log; everything else recorded that day is kept.";

/** Resolve the zone → load → plan → validate → save → reload for `status` → time envelope. */
async function runWriteTool(tz: string | undefined, input: WriteInput) {
  const resolved = await resolveMcpTimeZone(tz);
  const before = await loadCycleData(resolved.timeZone);
  if (!before.profile || !before.output) return toolError(NO_PROFILE);
  const plan = planWrite(
    { today: before.today, logsByDate: before.logsByDate, cycles: before.output.cycles, settings: before.profile.settings },
    input,
  );
  if (!plan.ok) return toolError(plan.error);
  if (plan.changed) await upsertDayLog(dayLogSchema.parse(plan.dayLog));

  const after = await loadCycleData(resolved.timeZone);
  const updatedMs = await getDayLogUpdatedAt(plan.date);
  return toolResult(
    envelope(timeContext(resolved, Date.now()), {
      date: plan.date,
      dayLog: after.logsByDate.get(plan.date) ?? null,
      changed: plan.changed,
      ...(plan.changedFromPeriod !== undefined && { changedFromPeriod: plan.changedFromPeriod }),
      updatedAt: updatedMs === null ? null : formatInstant(updatedMs, resolved.timeZone),
      status: presentToday(after as CycleView),
    }),
  );
}

type Tool = [name: WriteInput["tool"], title: string, description: string, input: z.ZodRawShape];

const TOOLS: Tool[] = [
  ["log_period_start", "Log period start", "Marks the day as a period day and the first day of the period.", {}],
  ["log_period_day", "Log period day", 'Marks the day as a period day ("still on my period"), with the flow if given.', { flow: flowLevel.optional() }],
  [
    "log_period_end",
    "Log period end",
    "Marks the last day of the period. Without date: today if today is a period day, otherwise the last recorded day of the ongoing period.",
    {},
  ],
  [
    "log_spotting",
    "Log spotting",
    "Marks the day as spotting, which never starts or extends a period; clears flow and period start/end on that day. changedFromPeriod says whether it was a period day before.",
    {},
  ],
  ["log_mood", "Log mood", "Adds or removes exactly these moods for the day.", { moods: z.array(moodId).min(1), mode }],
  [
    "log_symptoms",
    "Log symptoms",
    'Adds or removes exactly these symptoms for the day. Sleep, exercise, focus and libido changes need "Extra symptom tracking" on in Settings.',
    { symptoms: z.array(symptomId).min(1), mode },
  ],
  [
    "log_nothing_to_report",
    "Log nothing to report",
    "Records the day as having nothing to report. Refused if the day already has recorded data.",
    {},
  ],
];

/** Registers the logging (write) tools (MCP-SPEC "Write tools"). */
export function registerWriteTools(server: McpServer): void {
  for (const [name, title, description, input] of TOOLS) {
    server.registerTool(
      name,
      {
        title,
        description: `${description} ${MERGE_NOTE} Returns the saved log and today's status. ${TIME_ZONE_NOTE}`,
        inputSchema: { ...input, date, timeZone },
        outputSchema: envelopeOutput,
        annotations: ANNOTATIONS,
      },
      ({ timeZone: tz, ...args }) => runWriteTool(tz as string | undefined, { tool: name, ...args } as WriteInput),
    );
  }
}

import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { DayLog } from "@/lib/domain/types";
import { z } from "zod";
import { formatInstant } from "@/lib/date/civil";
import { dayLogSchema } from "@/lib/domain/schema";
import { getDayLogUpdatedAt, listDayLogUpdatedAt, upsertDayLogIfUnchanged } from "@/lib/repo/dayLogs";
import { loadCycleData } from "@/lib/cycleView/load";
import { envelope, resolveMcpTimeZone, timeContext, toolError, toolResult } from "@/lib/mcp/envelope";
import { civilDate, envelopeOutput, flowLevel, moodId, symptomId, timeZone } from "@/lib/mcp/schemas";
import { presentToday, type CycleView } from "@/lib/mcp/present";
import { NO_PROFILE, TIME_ZONE_NOTE } from "@/lib/mcp/tools/read";
import { planWrite, type WriteInput } from "@/lib/mcp/writePlan";

const date = civilDate.optional().describe("The day, YYYY-MM-DD; defaults to today. Not in the future.");
const mode = z.enum(["add", "remove"]).default("add").describe("add (default) or remove exactly these; never toggles.");
const ANNOTATIONS = { readOnlyHint: false, destructiveHint: false, idempotentHint: true };
const MERGE_NOTE =
  "Merges into the day's existing log; everything else recorded that day is kept. Call write tools one at a time and wait for each result.";
export const WRITE_CONFLICT = "Another change to this day happened at the same time — please try again.";
export const WRITE_FAILED =
  "Couldn't save that right now — it may not have been saved; check get_history before retrying.";
const ATTEMPTS = 3;

/** Any unexpected error becomes a plain-language tool error; details go to the server log only. */
export async function runWriteTool(tz: string | undefined, input: WriteInput) {
  try {
    return await saveAndReport(tz, input);
  } catch (err) {
    console.error("MCP write tool failed", err);
    return toolError(WRITE_FAILED);
  }
}

/** Resolve the zone → load → plan → validate → save if the day is unchanged since the load
 * (else reload and re-plan, up to ATTEMPTS) → reload for `status` → time envelope. */
async function saveAndReport(tz: string | undefined, input: WriteInput) {
  const resolved = await resolveMcpTimeZone(tz);
  for (let attempt = 0; attempt < ATTEMPTS; attempt++) {
    // Versions first, then the logs: a save landing in between makes the check fail (retry),
    // never pass against logs the plan didn't see.
    const versions = await listDayLogUpdatedAt();
    const before = await loadCycleData(resolved.timeZone);
    if (!before.profile || !before.output) return toolError(NO_PROFILE);
    const plan = planWrite(
      { today: before.today, logsByDate: before.logsByDate, cycles: before.output.cycles, settings: before.profile.settings },
      input,
    );
    if (!plan.ok) return toolError(plan.error);
    if (plan.changed && !(await trySave(plan.dayLog, versions.get(plan.date) ?? null))) continue;

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
  return toolError(WRITE_CONFLICT);
}

/** False when another save to the same day got there first: the version moved, or two
 * inserts of a new day raced (deadlock / duplicate key, possibly wrapped by Drizzle). */
async function trySave(dayLog: DayLog, expectedUpdatedAt: number | null): Promise<boolean> {
  try {
    return (await upsertDayLogIfUnchanged(dayLogSchema.parse(dayLog), expectedUpdatedAt)).ok;
  } catch (err) {
    const codes = [err, (err as { cause?: unknown } | null)?.cause].map((e) => (e as { code?: unknown } | null)?.code);
    if (codes.some((c) => c === "ER_LOCK_DEADLOCK" || c === "ER_DUP_ENTRY")) return false;
    throw err;
  }
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

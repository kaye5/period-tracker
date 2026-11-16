import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import type { CivilDate } from "@/lib/date/civil";
import { loadCycleData } from "@/lib/cycleView/load";
import { envelope, resolveMcpTimeZone, timeContext, toolError, toolResult } from "@/lib/mcp/envelope";
import { civilDate, envelopeOutput, moodId, symptomId, timeZone } from "@/lib/mcp/schemas";
import { buildPatternData } from "@/lib/mcp/patterns";
import {
  historyRangeError,
  presentCycleStats,
  presentFertileWindow,
  presentHealthNotes,
  presentHistory,
  presentInsights,
  presentNextPeriod,
  presentPeriodLength,
  presentToday,
  type CycleView,
} from "@/lib/mcp/present";

export const NO_PROFILE = "No profile yet — finish onboarding in the app first.";
export const PREDICTION_NOTE = "Present predictions as ranges with their confidence; this is not medical advice.";
export const TIME_ZONE_NOTE =
  'If timeZoneSource is "fallback_utc", say the day was worked out in UTC and suggest passing timeZone.';

export const READ_FAILED = "Couldn't read your data right now — please try again.";

/** Resolve the zone → load → present → wrap in the time envelope. Any unexpected error becomes
 * a plain-language tool error; details go to the server log only. */
export async function runReadTool(tz: string | undefined, present: (view: CycleView) => object) {
  try {
    const resolved = await resolveMcpTimeZone(tz);
    const data = await loadCycleData(resolved.timeZone);
    if (!data.profile || !data.output || !data.calendar) return toolError(NO_PROFILE);
    // ponytail: envelope `now` is read just after the load's own Date.now(); they can straddle
    // midnight by milliseconds. Pass one nowMs into loadCycleData if that ever matters.
    return toolResult(envelope(timeContext(resolved, Date.now()), present(data as CycleView)));
  } catch (err) {
    console.error("MCP read tool failed", err);
    return toolError(READ_FAILED);
  }
}

const SIMPLE_TOOLS: [name: string, title: string, description: string, present: (v: CycleView) => object][] = [
  ["get_today", "Today", `What cycle day it is, today's estimated phase (when fertility features are on), whether a period is ongoing, and what was logged today. ${PREDICTION_NOTE}`, presentToday],
  ["get_next_period", "Next period", `When the next period is expected, as a date range with its confidence and the cycles it is based on. ${PREDICTION_NOTE}`, presentNextPeriod],
  ["get_period_length", "Period length", `How long the user's periods typically last, and how long an ongoing period is expected to continue. ${PREDICTION_NOTE}`, presentPeriodLength],
  ["get_cycle_stats", "Cycle stats", "How long and how regular the user's recorded cycles are.", presentCycleStats],
  ["get_fertile_window", "Fertile window", `The estimated fertile window and ovulation range, only when fertility features are on in Settings; always quote the disclaimer. ${PREDICTION_NOTE}`, presentFertileWindow],
  ["get_insights", "Insights", "Patterns the app found in the user's own records (e.g. symptoms before a period), with their counts; always quote the disclaimer.", presentInsights],
  ["get_health_notes", "Health notes", "Active health-awareness messages, verbatim, with severity and cited source; urgent ones first.", presentHealthNotes],
];

/** Registers the read-only tools (MCP-SPEC "Read tools"). */
export function registerReadTools(server: McpServer): void {
  for (const [name, title, description, present] of SIMPLE_TOOLS) {
    server.registerTool(
      name,
      {
        title,
        description: `${description} ${TIME_ZONE_NOTE}`,
        inputSchema: { timeZone },
        outputSchema: envelopeOutput,
        annotations: { readOnlyHint: true },
      },
      ({ timeZone: tz }) => runReadTool(tz, present),
    );
  }

  server.registerTool(
    "get_history",
    {
      title: "History",
      description: `What the user logged on each day from \`from\` to \`to\` (inclusive, at most 366 days). ${TIME_ZONE_NOTE}`,
      inputSchema: { from: civilDate, to: civilDate, timeZone },
      outputSchema: envelopeOutput,
      annotations: { readOnlyHint: true },
    },
    ({ from, to, timeZone: tz }) => {
      const error = historyRangeError(from, to);
      if (error) return toolError(error);
      return runReadTool(tz, (view) => presentHistory(view, from as CivilDate, to as CivilDate));
    },
  );

  server.registerTool(
    "get_pattern_data",
    {
      title: "Pattern data",
      description: [
        "The user's own symptom and mood counts by cycle day (before the next period, during the period, and the days after it), each offset already projected onto calendar dates — the data behind forecasts like \"you usually log irritability in the week before your period\".",
        "When using it: (1) Base every forecast on these counts and quote them (e.g. \"5 of 7 logged days, 8 cycles\").",
        "(2) Always give dates as ranges (`upcoming`); the next period date is itself an estimate. `currentPeriod` is an exact date only because that period has already started.",
        "(3) If basedOnCycles < minimumCyclesForPatterns, or knownDays is small, say the pattern is weak.",
        "(4) Give no medical explanations (hormones, diagnoses, treatments) and no health advice.",
        "(5) Say it comes from the user's own records.",
        TIME_ZONE_NOTE,
      ].join(" "),
      inputSchema: {
        items: z
          .array(z.union([symptomId, moodId]))
          .optional()
          .describe("Only these symptoms and/or moods; all when omitted."),
        minKnownDays: z
          .number()
          .int()
          .min(1)
          .default(1)
          .describe("Leave out cycle days with fewer known (logged) days than this."),
        timeZone,
      },
      outputSchema: envelopeOutput,
      annotations: { readOnlyHint: true },
    },
    ({ items, minKnownDays, timeZone: tz }) =>
      runReadTool(tz, ({ output, dayLogs, today }) => buildPatternData({ output, dayLogs, today, items, minKnownDays })),
  );
}

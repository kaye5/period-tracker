/**
 * Shared zod schemas for MCP tool inputs and outputs (MCP-SPEC "Tools"). Enum values are the
 * app's own (`lib/domain/schema.ts`); each is described with its in-app label so a client can
 * map "headache" → `headache`.
 */
import { z } from "zod";
import { civilDateSchema, flowLevelSchema, moodIdSchema, symptomIdSchema } from "@/lib/domain/schema";
import { isValidTimeZone } from "@/lib/time/userTimeZone";
import { SYMPTOM_LABELS } from "@/lib/copy/insights";
import { FLOW_LEVEL_OPTIONS, MOOD_OPTIONS } from "@/components/daylog/daylogOptions";

const labelled = (pairs: [string, string][]) => pairs.map(([v, l]) => `${v} = ${l}`).join(", ");

export const civilDate = civilDateSchema.describe("A calendar day, YYYY-MM-DD.");

export const timeZone = z
  .string()
  .refine(isValidTimeZone, { message: "must be an IANA time zone name, e.g. Asia/Bangkok" })
  .optional()
  .describe("Optional IANA time zone (e.g. Asia/Bangkok) for this call only; defaults to the profile's zone.");

export const moodId = moodIdSchema.describe(
  `Mood, by in-app label: ${labelled(MOOD_OPTIONS.map((o) => [o.value, o.label]))}.`,
);

export const symptomId = symptomIdSchema.describe(
  `Symptom, by in-app label: ${labelled(Object.entries(SYMPTOM_LABELS))}.`,
);

export const flowLevel = flowLevelSchema.describe(
  `Flow, by in-app label: ${labelled(FLOW_LEVEL_OPTIONS.map((o) => [o.value, o.label]))}.`,
);

/** The time envelope every tool returns (MCP-SPEC "Tools"); `data` is tool-specific. */
export const envelopeOutput = {
  timeZone: z.string(),
  timeZoneSource: z.enum(["input", "profile", "fallback_utc"]),
  today: z.string().describe("The user's local calendar day in timeZone, YYYY-MM-DD."),
  now: z.object({ utc: z.string(), local: z.string() }),
  data: z.record(z.unknown()),
};

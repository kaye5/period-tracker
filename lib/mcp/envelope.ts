/**
 * The time context every MCP tool response is wrapped in (MCP-SPEC "Tools"), plus the
 * structured/text result shapes tools return.
 */
import { formatInstant, todayInZone, type CivilDate } from "@/lib/date/civil";
import { getUserTimeZone } from "@/lib/repo/profile";
import { resolveTimeZone, type TimeZoneSource } from "@/lib/time/userTimeZone";

export interface TimeContext {
  timeZone: string;
  timeZoneSource: TimeZoneSource;
  today: CivilDate;
  now: { utc: string; local: string };
}

export function timeContext(
  tz: { timeZone: string; source: TimeZoneSource },
  nowMs: number,
): TimeContext {
  return {
    timeZone: tz.timeZone,
    timeZoneSource: tz.source,
    today: todayInZone(tz.timeZone, nowMs),
    now: formatInstant(nowMs, tz.timeZone),
  };
}

export function envelope<T>(ctx: TimeContext, data: T): TimeContext & { data: T } {
  return { ...ctx, data };
}

/** `structuredContent` plus the same JSON as text, for clients that ignore structured output.
 * `structuredContent` is typed as the SDK's `CallToolResult` expects; any object qualifies at
 * runtime, and interfaces such as `TimeContext` don't carry the index signature TS wants. */
export function toolResult(obj: object): {
  structuredContent: Record<string, unknown>;
  content: [{ type: "text"; text: string }];
} {
  return {
    structuredContent: obj as Record<string, unknown>,
    content: [{ type: "text", text: JSON.stringify(obj) }],
  };
}

/** A plain-language tool error (never a stack trace). */
export function toolError(message: string): {
  isError: true;
  content: [{ type: "text"; text: string }];
} {
  return { isError: true, content: [{ type: "text", text: message }] };
}

/** Tool `timeZone` input, then `profile.time_zone`, else UTC. MCP has no `tz` cookie. */
export async function resolveMcpTimeZone(
  input?: unknown,
): Promise<{ timeZone: string; source: TimeZoneSource }> {
  return resolveTimeZone({ input, profile: await getUserTimeZone() });
}

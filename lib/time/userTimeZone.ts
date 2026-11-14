/**
 * Resolves the user's IANA time zone (MCP-SPEC Part A): tool input, then the browser's `tz`
 * cookie, then `profile.time_zone`, else "UTC" flagged as a fallback. Invalid candidates are
 * skipped, never thrown. Never consults the host's time zone.
 */

export type TimeZoneSource = "input" | "cookie" | "profile" | "fallback_utc";

/** A non-empty string of at most 64 chars that Intl accepts as a time zone. */
export function isValidTimeZone(tz: unknown): tz is string {
  if (typeof tz !== "string" || tz.length === 0 || tz.length > 64) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: tz });
    return true;
  } catch {
    return false;
  }
}

export function resolveTimeZone(c: { input?: unknown; cookie?: unknown; profile?: unknown }): {
  timeZone: string;
  source: TimeZoneSource;
} {
  for (const source of ["input", "cookie", "profile"] as const) {
    const tz = c[source];
    if (isValidTimeZone(tz)) return { timeZone: tz, source };
  }
  return { timeZone: "UTC", source: "fallback_utc" };
}

/**
 * Resolves the user's IANA time zone (MCP-SPEC Part A): tool input, then the browser's `tz`
 * cookie, then `profile.time_zone`, else "UTC" flagged as a fallback. Invalid candidates are
 * skipped, never thrown. Never consults the host's time zone.
 */

/** Browser-set cookie carrying the user's zone. Lives here (not requestTimeZone.ts) so client
 * code can import it without pulling in server-only modules. */
export const TZ_COOKIE = "tz";

/** Set next to `tz` while the zone is picked by hand in Settings, so TimeZoneSync stops
 * replacing it with the browser's zone. */
export const TZ_MANUAL_COOKIE = "tz_manual";

/** The raw value of cookie `name` in a `document.cookie` string, if present. */
export function cookieValue(cookies: string, name: string): string | undefined {
  const prefix = `${name}=`;
  return cookies
    .split("; ")
    .find((c) => c.startsWith(prefix))
    ?.slice(prefix.length);
}

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

/**
 * The canonical IANA name for an already-validated zone the client supplied (e.g.
 * "asia/bangkok" → "Asia/Bangkok"), so cookies and the profile store one spelling. This
 * canonicalises the zone passed in; it never reads the host's zone (no default formatter).
 */
export function canonicalTimeZone(tz: string): string {
  const { timeZone } = new Intl.DateTimeFormat("en-US", { timeZone: tz }).resolvedOptions();
  return timeZone;
}

/**
 * Whether the raw (URL-encoded) `tz` cookie already names the browser's zone. Compares
 * canonical forms because engines disagree on aliases (Node stores Asia/Kolkata as
 * Asia/Calcutta); a plain string compare would re-sync on every load.
 */
export function timeZoneCookieMatches(cookie: string | undefined, timeZone: string): boolean {
  if (!cookie) return false;
  let tz: string;
  try {
    tz = decodeURIComponent(cookie);
  } catch {
    return false;
  }
  return (
    isValidTimeZone(tz) &&
    isValidTimeZone(timeZone) &&
    canonicalTimeZone(tz) === canonicalTimeZone(timeZone)
  );
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

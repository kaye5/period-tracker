/**
 * Server-only: the requesting user's time zone and "today" (MCP-SPEC Part A). Reads the
 * browser's `tz` cookie, then `profile.time_zone`, else "UTC" — never the host's zone.
 * `Date.now()` lives here (not in component bodies) because React's purity rule for
 * Server Components forbids impure calls during render.
 */
import { cookies } from "next/headers";
import { todayInZone, type CivilDate } from "@/lib/date/civil";
import { getUserTimeZone } from "@/lib/repo/profile";
import { isValidTimeZone, resolveTimeZone, type TimeZoneSource } from "@/lib/time/userTimeZone";

export const TZ_COOKIE = "tz";

export async function getRequestTimeZone(): Promise<{ timeZone: string; source: TimeZoneSource }> {
  const cookie = (await cookies()).get(TZ_COOKIE)?.value;
  // A valid cookie wins, so skip the profile query in the common case.
  const profile = isValidTimeZone(cookie) ? null : await getUserTimeZone();
  return resolveTimeZone({ cookie, profile });
}

export async function getRequestToday(): Promise<{ today: CivilDate; timeZone: string }> {
  const { timeZone } = await getRequestTimeZone();
  return { today: todayInZone(timeZone, Date.now()), timeZone };
}

import { NextResponse } from "next/server";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";
import { getProfile, setUserTimeZone } from "@/lib/repo/profile";
import { requireApiUnlock } from "@/lib/security/guard";
import { canonicalTimeZone, isValidTimeZone, TZ_COOKIE } from "@/lib/time/userTimeZone";

export const dynamic = "force-dynamic";

/** POST /api/time-zone { timeZone } — called by TimeZoneSync when the browser's zone differs
 * from the `tz` cookie (MCP-SPEC Part A). Stores the zone on the profile and sets the cookie
 * only when unlocked and a profile exists; otherwise neither, so the cookie never says "in
 * sync" while profile.time_zone (what MCP reads) is stale. TimeZoneSync retries on the next
 * navigation (after unlock or onboarding). */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const raw = (body as { timeZone?: unknown } | null)?.timeZone;
    if (!isValidTimeZone(raw)) return jsonError(400, "Invalid time zone");
    const timeZone = canonicalTimeZone(raw);

    if ((await requireApiUnlock()) !== null || (await getProfile()) === null) {
      return NextResponse.json({ timeZone, stored: false });
    }
    await setUserTimeZone(timeZone);
    const res = NextResponse.json({ timeZone, stored: true });
    res.cookies.set(TZ_COOKIE, timeZone, {
      path: "/",
      maxAge: 31536000,
      sameSite: "lax",
      httpOnly: false,
      secure: process.env.NODE_ENV === "production",
    });
    return res;
  } catch (err) {
    return handleUnexpected(err);
  }
}

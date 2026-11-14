import { NextResponse } from "next/server";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";
import { setUserTimeZone } from "@/lib/repo/profile";
import { requireApiUnlock } from "@/lib/security/guard";
import { canonicalTimeZone, isValidTimeZone, TZ_COOKIE } from "@/lib/time/userTimeZone";

export const dynamic = "force-dynamic";

/** POST /api/time-zone { timeZone } — called by TimeZoneSync when the browser's zone differs
 * from the `tz` cookie (MCP-SPEC Part A). The cookie is set even while the screen lock is on
 * (it only steers which day is "today"); the profile is written only when unlocked. */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const raw = (body as { timeZone?: unknown } | null)?.timeZone;
    if (!isValidTimeZone(raw)) return jsonError(400, "Invalid time zone");
    const timeZone = canonicalTimeZone(raw);

    const stored = (await requireApiUnlock()) === null && (await setUserTimeZone(timeZone));
    const res = NextResponse.json({ timeZone, stored });
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

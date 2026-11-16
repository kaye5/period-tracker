import { NextResponse } from "next/server";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";
import { getTimeZoneSetting, setUserTimeZone } from "@/lib/repo/profile";
import { requireApiUnlock } from "@/lib/security/guard";
import {
  canonicalTimeZone,
  isValidTimeZone,
  TZ_COOKIE,
  TZ_MANUAL_COOKIE,
} from "@/lib/time/userTimeZone";

export const dynamic = "force-dynamic";

const COOKIE_OPTIONS = {
  path: "/",
  sameSite: "lax",
  httpOnly: false,
  secure: process.env.NODE_ENV === "production",
} as const;

/** Sets the `tz` cookie, plus `tz_manual` while the zone is picked by hand.
 * ponytail: `tz_manual` lives a day, so another device notices a switch back to automatic
 * (or a new manual zone) within a day; push the change if that ever matters. */
function withZoneCookies(res: NextResponse, timeZone: string, manual: boolean): NextResponse {
  res.cookies.set(TZ_COOKIE, timeZone, { ...COOKIE_OPTIONS, maxAge: 31536000 });
  if (manual) res.cookies.set(TZ_MANUAL_COOKIE, "1", { ...COOKIE_OPTIONS, maxAge: 86400 });
  else res.cookies.delete(TZ_MANUAL_COOKIE);
  return res;
}

/** GET /api/time-zone — `{ timeZone, manual }` for Settings (`timeZone` null before
 * onboarding or before the browser first reported one). */
export async function GET() {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    return NextResponse.json((await getTimeZoneSetting()) ?? { timeZone: null, manual: false });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** POST /api/time-zone { timeZone } — called by TimeZoneSync when the browser's zone differs
 * from the `tz` cookie (MCP-SPEC Part A). Stores the zone on the profile and sets the cookie
 * only when unlocked and a profile exists; otherwise neither, so the cookie never says "in
 * sync" while profile.time_zone (what MCP reads) is stale. TimeZoneSync retries on the next
 * navigation (after unlock or onboarding). When a zone was picked by hand in Settings it is
 * kept: nothing is stored and the cookies are set to that zone instead (`manual: true`). */
export async function POST(request: Request) {
  try {
    const body: unknown = await request.json();
    const raw = (body as { timeZone?: unknown } | null)?.timeZone;
    if (!isValidTimeZone(raw)) return jsonError(400, "Invalid time zone");
    const timeZone = canonicalTimeZone(raw);

    const setting = (await requireApiUnlock()) === null ? await getTimeZoneSetting() : null;
    if (setting === null) return NextResponse.json({ timeZone, stored: false });
    if (setting.manual && isValidTimeZone(setting.timeZone)) {
      return withZoneCookies(
        NextResponse.json({ timeZone: setting.timeZone, stored: false, manual: true }),
        setting.timeZone,
        true,
      );
    }
    await setUserTimeZone(timeZone);
    return withZoneCookies(NextResponse.json({ timeZone, stored: true }), timeZone, false);
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** PUT /api/time-zone { timeZone, manual } — Settings. `manual: true` pins `timeZone` so
 * TimeZoneSync stops replacing it; `manual: false` goes back to the browser's zone (the
 * client sends it as `timeZone`). Needs a profile: onboarding creates it. */
export async function PUT(request: Request) {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    const body = (await request.json()) as { timeZone?: unknown; manual?: unknown } | null;
    if (!isValidTimeZone(body?.timeZone)) return jsonError(400, "Invalid time zone");
    if (typeof body.manual !== "boolean") return jsonError(400, "`manual` must be true or false");
    const timeZone = canonicalTimeZone(body.timeZone);

    if (!(await setUserTimeZone(timeZone, body.manual))) {
      return jsonError(409, "Finish onboarding before setting a time zone");
    }
    return withZoneCookies(
      NextResponse.json({ timeZone, manual: body.manual }),
      timeZone,
      body.manual,
    );
  } catch (err) {
    return handleUnexpected(err);
  }
}

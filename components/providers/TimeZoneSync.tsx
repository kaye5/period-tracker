"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import {
  cookieValue,
  timeZoneCookieMatches,
  TZ_COOKIE,
  TZ_MANUAL_COOKIE,
} from "@/lib/time/userTimeZone";

/** Keeps the `tz` cookie and profile.time_zone in step with the browser's zone, then
 * refreshes so server-rendered "today" uses it (MCP-SPEC Part A). The server sets the cookie
 * only once the zone is stored (unlocked, profile exists), so re-checking on every navigation
 * makes the sync land right after unlock or onboarding. Skipped while a zone is picked by
 * hand in Settings (`tz_manual` cookie). Renders nothing; any failure is ignored and the app
 * keeps the previous zone. */
export function TimeZoneSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    if (cookieValue(document.cookie, TZ_MANUAL_COOKIE) !== undefined) return;
    const cookie = cookieValue(document.cookie, TZ_COOKIE);
    if (!timeZone || timeZoneCookieMatches(cookie, timeZone)) return;

    fetch("/api/time-zone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeZone }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { stored?: unknown; manual?: unknown } | null) => {
        if (body?.stored === true || body?.manual === true) router.refresh();
      })
      .catch(() => {});
  }, [router, pathname]);

  return null;
}

"use client";

import { useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { timeZoneCookieMatches, TZ_COOKIE } from "@/lib/time/userTimeZone";

/** Keeps the `tz` cookie and profile.time_zone in step with the browser's zone, then
 * refreshes so server-rendered "today" uses it (MCP-SPEC Part A). The server sets the cookie
 * only once the zone is stored (unlocked, profile exists), so re-checking on every navigation
 * makes the sync land right after unlock or onboarding. Renders nothing; any failure is
 * ignored and the app keeps the previous zone. */
export function TimeZoneSync() {
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const timeZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    const prefix = `${TZ_COOKIE}=`;
    const cookie = document.cookie
      .split("; ")
      .find((c) => c.startsWith(prefix))
      ?.slice(prefix.length);
    if (!timeZone || timeZoneCookieMatches(cookie, timeZone)) return;

    fetch("/api/time-zone", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ timeZone }),
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((body: { stored?: unknown } | null) => {
        if (body?.stored === true) router.refresh();
      })
      .catch(() => {});
  }, [router, pathname]);

  return null;
}

import { redirect } from "next/navigation";
import type { CivilDate } from "@/lib/date/civil";
import type { EngineResult } from "@/lib/engine";
import { loadCycleData } from "@/lib/cycleView/load";
import { requirePageUnlock } from "@/lib/security/guard";
import { getRequestTimeZone } from "@/lib/time/requestTimeZone";
import type { DashboardCalendarData } from "@/components/dashboard/DashboardScreen";

/**
 * The READ pattern shared by Today ("/") and Calendar ("/calendar"): the page wrapper
 * around `loadCycleData` (lib/cycleView/load.ts). Pages using it must be `force-dynamic` —
 * the data is per-request user data and the database may be unreachable at build time.
 *
 * Screen lock first: with a PIN configured and no unlock session this redirects to
 * /unlock before any user data is read. No profile yet → /onboarding, the true entry
 * point for a new user. A real user with nothing logged is not an error; the screens
 * render honest empty states for it.
 */
export async function loadCycleView(): Promise<{
  output: EngineResult;
  today: CivilDate;
  calendar: DashboardCalendarData;
}> {
  await requirePageUnlock();

  const { timeZone } = await getRequestTimeZone();
  const { output, today, calendar } = await loadCycleData(timeZone);
  if (output === null || calendar === null) {
    redirect("/onboarding");
  }

  return { output, today, calendar };
}

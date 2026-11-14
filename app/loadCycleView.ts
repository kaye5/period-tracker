import { redirect } from "next/navigation";
import type { CivilDate } from "@/lib/date/civil";
import { computeEverything, type EngineResult } from "@/lib/engine";
import { getProfile } from "@/lib/repo/profile";
import { listAllDayLogs } from "@/lib/repo/dayLogs";
import { getUserDecisions, listHealthMessageDecisions } from "@/lib/repo/decisions";
import { getCalibrationState } from "@/lib/repo/calibration";
import { buildHealthAwarenessState } from "@/components/dashboard/healthState";
import { requirePageUnlock } from "@/lib/security/guard";
import { getRequestToday } from "@/lib/time/requestTimeZone";
import type { DashboardCalendarData } from "@/components/dashboard/DashboardScreen";

/**
 * The READ pattern shared by Today ("/") and Calendar ("/calendar"): an async server-side
 * load that calls the data-layer repos directly and hands their output to the real
 * `computeEverything` from `@/lib/engine`. Pages using it must be `force-dynamic` — the
 * data is per-request user data and the database may be unreachable at build time.
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

  const profile = await getProfile();
  if (profile === null) {
    redirect("/onboarding");
  }

  const { today } = await getRequestToday();

  const [dayLogs, decisions, calibration, healthMessageDecisions] = await Promise.all([
    listAllDayLogs(),
    getUserDecisions(),
    getCalibrationState(),
    listHealthMessageDecisions(),
  ]);

  const output = computeEverything({
    dayLogs,
    profile,
    today,
    decisions,
    calibration,
    healthState: buildHealthAwarenessState(healthMessageDecisions),
  });

  // Week start follows locale: en-GB starts Monday, en-US (and the default) starts Sunday.
  const weekStartsOn: 0 | 1 = profile.settings.locale === "en-GB" ? 1 : 0;
  // Own history first, then the user's own onboarding answer. A first period has no
  // COMPLETED episode, so `stats.periodDuration` is null exactly when the "expected to
  // continue" hint is most useful — the fallback is what makes it visible then.
  const typicalPeriodDays: number | null =
    output.stats.periodDuration !== null
      ? Math.round(output.stats.periodDuration.center)
      : (profile.reportedTypicalPeriodDays ?? null);

  return {
    output,
    today,
    calendar: {
      dayLogs,
      fertilityEnabled: profile.settings.fertilityEnabled,
      weekStartsOn,
      typicalPeriodDays,
    },
  };
}

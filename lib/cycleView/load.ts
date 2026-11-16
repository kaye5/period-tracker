import { todayInZone, type CivilDate } from "@/lib/date/civil";
import type { DayLog, Profile } from "@/lib/domain/types";
import { computeEverything, type EngineResult } from "@/lib/engine";
import { getProfile } from "@/lib/repo/profile";
import { listAllDayLogs } from "@/lib/repo/dayLogs";
import { getUserDecisions, listHealthMessageDecisions } from "@/lib/repo/decisions";
import { getCalibrationState } from "@/lib/repo/calibration";
import { buildHealthAwarenessState } from "@/components/dashboard/healthState";
import type { DashboardCalendarData } from "@/components/dashboard/DashboardScreen";

/**
 * The shared READ: repos → the real `computeEverything` → calendar inputs, for one
 * already-resolved IANA zone. Guard-free on purpose — no PIN check, no redirect, no
 * cookies — so the MCP tools can call it; the page path (app/loadCycleView.ts) adds those.
 * `Date.now()` lives here (not in a component body) because React's purity rule for
 * Server Components forbids impure calls during render.
 *
 * No profile yet → `output` and `calendar` are null (the engine needs a profile); the
 * caller decides what that means (the pages redirect to /onboarding).
 */
export async function loadCycleData(timeZone: string): Promise<{
  profile: Profile | null;
  today: CivilDate;
  timeZone: string;
  dayLogs: DayLog[];
  logsByDate: Map<CivilDate, DayLog>;
  output: EngineResult | null;
  calendar: DashboardCalendarData | null;
}> {
  const today = todayInZone(timeZone, Date.now());

  const [profile, dayLogs, decisions, calibration, healthMessageDecisions] = await Promise.all([
    getProfile(),
    listAllDayLogs(),
    getUserDecisions(),
    getCalibrationState(),
    listHealthMessageDecisions(),
  ]);
  const logsByDate = new Map(dayLogs.map((log) => [log.date, log]));

  if (profile === null) {
    return { profile, today, timeZone, dayLogs, logsByDate, output: null, calendar: null };
  }

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
    profile,
    today,
    timeZone,
    dayLogs,
    logsByDate,
    output,
    calendar: {
      dayLogs,
      fertilityEnabled: profile.settings.fertilityEnabled,
      weekStartsOn,
      typicalPeriodDays,
    },
  };
}

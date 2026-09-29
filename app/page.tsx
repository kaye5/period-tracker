import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { todayInZone, type CivilDate } from "@/lib/date/civil";
import { computeEverything } from "@/lib/engine";
import { getProfile } from "@/lib/repo/profile";
import { listAllDayLogs } from "@/lib/repo/dayLogs";
import { getUserDecisions, listHealthMessageDecisions } from "@/lib/repo/decisions";
import { getCalibrationState } from "@/lib/repo/calibration";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { buildHealthAwarenessState } from "@/components/dashboard/healthState";
import { requirePageUnlock } from "@/lib/security/guard";

export const metadata: Metadata = {
  title: "Period Tracker",
};

// Integration (agent I): render per-request, never at build time. This page awaits the
// data layer (a SQL database via Drizzle/mysql2) during render; static prerendering at
// build would try to reach the database while it may be unreachable and fail the build.
// The data here is inherently per-request user data that must never be statically cached,
// so force-dynamic is the correct posture regardless of the DB state.
export const dynamic = "force-dynamic";

/**
 * The app's home route (this agent's brief: "app/page.tsx is the app's home route ('/')
 * ... this is the routing that makes onboarding the true entry point").
 *
 * READ pattern (this agent's DATA-FLOW PATTERN): an async Server Component that calls
 * the data-layer repos directly and passes plain, already-computed data down to a client
 * tree. It does not call `computeEverything` from `lib/repo/computeEngineOutput.ts` —
 * that file is still the pre-integration placeholder that always returns an empty/null
 * `EngineOutput` (see its own header comment: "SWAP POINT... do not add real derivation
 * logic here"), and `app/api/compute/route.ts` has not been repointed at the real
 * `lib/engine` barrel yet either, even though `lib/engine/index.ts` now exists. Both are
 * G-owned files this agent does not touch; the mismatch is reported in this agent's
 * final report. This page instead follows the DATA-FLOW PATTERN's explicit fallback —
 * "call the repo computeEngineOutput() (or the specific repo) directly" — by calling the
 * *specific* repos (dayLogs, profile, decisions, calibration) itself and handing their
 * output to the real `computeEverything` from `@/lib/engine`, exactly the way
 * `app/api/compute/route.ts` is documented to do once it's swapped over.
 *
 * No profile yet -> `redirect('/onboarding')`: onboarding is the true entry point for a
 * new user (this agent's brief, item 1). A legitimately-empty profile/day-log set past
 * that point (a real user with nothing logged yet) is not an error — `DashboardScreen`
 * renders the honest empty state for it via `selectDataTier`.
 */
// I/O boundary (SPEC.md R3 only governs the pure engine/date/stat layers, not this route
// component) — reads the server clock and local timezone once per request. Pulled out of
// the component body, same as `components/settings/SettingsScreen.tsx`'s `todayCivil()`,
// so the direct `Date.now()` call site isn't inside a component function.
function todayOnServer(): CivilDate {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return todayInZone(tz, Date.now());
}

export default async function HomePage() {
  // Screen lock (whole-app): if a PIN is configured and this browser has no valid unlock
  // session, redirect to /unlock before any user data is read or rendered. A no-op when no
  // PIN is set, so it never blocks a new user reaching onboarding.
  await requirePageUnlock();

  const profile = await getProfile();
  if (profile === null) {
    redirect("/onboarding");
  }

  const today = todayOnServer();

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

  // The embedded month calendar needs the raw day logs and the fertility toggle, which the
  // computed EngineResult does not carry. Week start follows locale: en-GB starts Monday,
  // en-US (and the default) starts Sunday.
  const weekStartsOn: 0 | 1 = profile.settings.locale === "en-GB" ? 1 : 0;
  // Own history first, then the user's own onboarding answer. A first period has no
  // COMPLETED episode, so `stats.periodDuration` is null exactly when the "expected to
  // continue" hint is most useful — the fallback is what makes it visible then.
  const typicalPeriodDays: number | null =
    output.stats.periodDuration !== null
      ? Math.round(output.stats.periodDuration.center)
      : (profile.reportedTypicalPeriodDays ?? null);

  return (
    <DashboardScreen
      output={output}
      today={today}
      calendar={{
        dayLogs,
        fertilityEnabled: profile.settings.fertilityEnabled,
        weekStartsOn,
        typicalPeriodDays,
      }}
    />
  );
}

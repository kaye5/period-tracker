import type { Metadata } from "next";
import "./report.css";
import { todayInZone, type CivilDate } from "@/lib/date/civil";
import { listAllDayLogs } from "@/lib/repo/dayLogs";
import { getProfileOrDefault } from "@/lib/repo/profile";
import { getUserDecisions } from "@/lib/repo/decisions";
import { getCalibrationState } from "@/lib/repo/calibration";
// Real, pure, fully-tested engine barrel (SPEC.md §4.1) — see app/history/page.tsx's
// comment (and this agent's final report) for why this page calls it directly rather
// than going through the still-unswapped GET /api/compute placeholder.
import { computeEverything } from "@/lib/engine";
import { ReportScreen } from "@/components/report/ReportScreen";

export const metadata: Metadata = {
  title: "Report — Period Tracker",
};

// Integration (agent I): render per-request, never at build time — this page awaits the
// data layer during render. See app/page.tsx for the full rationale (unreachable DB at
// build + inherently per-request user data).
export const dynamic = "force-dynamic";

// I/O boundary (SPEC.md R3 only governs the pure engine/date/stat layers, not this route
// component) — same pattern as app/history/page.tsx and app/page.tsx's `todayOnServer()`.
function todayOnServer(): CivilDate {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return todayInZone(tz, Date.now());
}

export default async function ReportPage() {
  const [dayLogs, profile, decisions, calibration] = await Promise.all([
    listAllDayLogs(),
    getProfileOrDefault(),
    getUserDecisions(),
    getCalibrationState(),
  ]);

  const today = todayOnServer();
  const result = computeEverything({ dayLogs, profile, today, decisions, calibration });

  return (
    <ReportScreen
      dayLogs={dayLogs}
      cycles={result.cycles}
      episodes={result.episodes}
      profile={profile}
      today={today}
    />
  );
}

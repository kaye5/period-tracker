import type { Metadata } from "next";
import { listAllDayLogs } from "@/lib/repo/dayLogs";
import { getProfileOrDefault } from "@/lib/repo/profile";
import { getUserDecisions } from "@/lib/repo/decisions";
import { getCalibrationState } from "@/lib/repo/calibration";
// Real, pure, fully-tested engine barrel (SPEC.md §4.1) — NOT the placeholder in
// lib/repo/computeEngineOutput.ts that app/api/compute/route.ts still points at as of
// this writing (see this agent's final report: that route hasn't been swapped over
// yet). A server component can call computeEverything directly, so this page does not
// wait on that swap to render real data.
import { computeEverything, predictedVsActualSeries } from "@/lib/engine";
import { parseDatesParam } from "@/components/history/cycleListData";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { requirePageUnlock } from "@/lib/security/guard";
import { getRequestToday } from "@/lib/time/requestTimeZone";

export const metadata: Metadata = {
  title: "Insights — Period Tracker",
};

// Integration (agent I): render per-request, never at build time — this page awaits the
// data layer during render. See app/page.tsx for the full rationale (unreachable DB at
// build + inherently per-request user data).
export const dynamic = "force-dynamic";

interface HistoryPageProps {
  searchParams: Promise<{ dates?: string }>;
}

export default async function HistoryPage({ searchParams }: HistoryPageProps) {
  await requirePageUnlock();

  const { dates } = await searchParams;
  const highlightedDates = parseDatesParam(dates);

  const [dayLogs, profile, decisions, calibration] = await Promise.all([
    listAllDayLogs(),
    getProfileOrDefault(),
    getUserDecisions(),
    getCalibrationState(),
  ]);

  // The user's "today" (tz cookie, else profile, else UTC) — never the host's zone.
  const { today } = await getRequestToday();

  const result = computeEverything({ dayLogs, profile, today, decisions, calibration });
  const predictedVsActual = predictedVsActualSeries(result.resolvedPredictions);

  return (
    <HistoryScreen
      cycles={result.cycles}
      episodes={result.episodes}
      dayLogs={dayLogs}
      stats={result.stats}
      skipPrompts={result.skipPrompts}
      predictedVsActual={predictedVsActual}
      highlightedDates={highlightedDates}
      today={today}
    />
  );
}

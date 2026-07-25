import { NextRequest, NextResponse } from "next/server";
import { isValid as isValidCivilDate, todayInZone, type CivilDate } from "@/lib/date/civil";
import { listAllDayLogs } from "@/lib/repo/dayLogs";
import { getProfileOrDefault } from "@/lib/repo/profile";
import { getUserDecisions } from "@/lib/repo/decisions";
import { getCalibrationState } from "@/lib/repo/calibration";
// ============================================================================
// SWAP POINT (SPEC.md §4.1) — RESOLVED by agent I. Now points at the real, fully-tested
// orchestration barrel lib/engine/index.ts (which exists and passes its tests) instead of
// the pre-integration placeholder lib/repo/computeEngineOutput.ts (which always returned an
// empty/null EngineOutput). Any client that calls GET /api/compute now receives real
// derived data, matching what the server components already compute directly.
// ============================================================================
import { computeEverything } from "@/lib/engine";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";
import { requireApiUnlock } from "@/lib/security/guard";

/**
 * GET /api/compute?today=YYYY-MM-DD — the single `EngineOutput` every screen reads from
 * (SPEC.md §4.1: "No screen recomputes anything locally"). `today` is optional and
 * exists for testing/debugging; in normal operation the server's own clock and local
 * timezone supply it.
 */
export async function GET(request: NextRequest) {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    const { searchParams } = new URL(request.url);
    const todayParam = searchParams.get("today");
    let today: CivilDate;
    if (todayParam) {
      if (!isValidCivilDate(todayParam)) {
        return jsonError(400, "`today` must be a valid YYYY-MM-DD date");
      }
      today = todayParam as CivilDate;
    } else {
      // I/O boundary (a route handler, not lib/date/civil.ts itself — SPEC.md R3 only
      // governs the pure engine/date/stat layers): reads the server clock and local
      // timezone once, then hands civil.ts an explicit instant, exactly as R3 requires
      // of every caller of todayInZone.
      const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
      today = todayInZone(tz, Date.now());
    }

    const [dayLogs, profile, decisions, calibration] = await Promise.all([
      listAllDayLogs(),
      getProfileOrDefault(),
      getUserDecisions(),
      getCalibrationState(),
    ]);

    const output = computeEverything({ dayLogs, profile, today, decisions, calibration });
    return NextResponse.json(output);
  } catch (err) {
    return handleUnexpected(err);
  }
}

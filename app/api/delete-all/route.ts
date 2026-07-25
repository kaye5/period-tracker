import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { deleteAllDayLogs } from "@/lib/repo/dayLogs";
import { deleteProfile } from "@/lib/repo/profile";
import { deleteAllPredictions } from "@/lib/repo/predictions";
import { deleteAllDecisions } from "@/lib/repo/decisions";
import { deleteCalibrationState } from "@/lib/repo/calibration";
import { deleteSecurity } from "@/lib/repo/security";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";
import { requireApiUnlock } from "@/lib/security/guard";

const CONFIRM_TOKEN = "DELETE_ALL_DATA";
const bodySchema = z.object({ confirm: z.literal(CONFIRM_TOKEN) });

/**
 * POST /api/delete-all — permanently deletes every collection's contents (SPEC.md's G
 * brief: "Delete endpoint must actually drop the data, not soft-delete it — a period
 * tracker that keeps deleted records is a liability"). Hard delete, no recovery.
 *
 * The `confirm` body field is a safety latch against an accidental call (e.g. a stray
 * script, a browser extension replaying requests) — it is not a security boundary
 * (this is a single-user, unauthenticated local app per SPEC.md §0). The real
 * "real confirmation" UX SPEC.md's U1 brief calls for lives in Settings (app/settings),
 * which is responsible for prompting the user before ever sending this request.
 */
export async function POST(request: NextRequest) {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    bodySchema.parse(await request.json());

    const [dayLogsDeleted, predictionsDeleted, decisionsDeleted] = await Promise.all([
      deleteAllDayLogs(),
      deleteAllPredictions(),
      deleteAllDecisions(),
    ]);
    const [profileDeleted, calibrationDeleted] = await Promise.all([
      deleteProfile(),
      deleteCalibrationState(),
    ]);
    // Wipe the screen-lock too, so a full delete leaves no configured PIN behind.
    await deleteSecurity();

    return NextResponse.json({
      deleted: {
        dayLogs: dayLogsDeleted,
        predictions: predictionsDeleted,
        decisions: decisionsDeleted,
        profile: profileDeleted,
        calibration: calibrationDeleted,
      },
    });
  } catch (err) {
    if (err instanceof SyntaxError) {
      return jsonError(400, `Request body must be JSON: { "confirm": "${CONFIRM_TOKEN}" }`);
    }
    return handleUnexpected(err);
  }
}

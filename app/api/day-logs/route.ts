import { NextRequest, NextResponse } from "next/server";
import { isValid as isValidCivilDate, type CivilDate } from "@/lib/date/civil";
import { listDayLogs, upsertDayLog } from "@/lib/repo/dayLogs";
import { dayLogSchema } from "@/lib/domain/schema";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";

/** GET /api/day-logs?from=YYYY-MM-DD&to=YYYY-MM-DD — all day logs, or a date range. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    let range: { from: CivilDate; to: CivilDate } | undefined;
    if (from || to) {
      if (!from || !to || !isValidCivilDate(from) || !isValidCivilDate(to)) {
        return jsonError(400, "`from` and `to` must both be present and valid YYYY-MM-DD dates");
      }
      range = { from: from as CivilDate, to: to as CivilDate };
    }
    const dayLogs = await listDayLogs(range);
    return NextResponse.json({ dayLogs });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** POST /api/day-logs — create or fully replace the log for the date in the body. */
export async function POST(request: NextRequest) {
  try {
    const body = dayLogSchema.parse(await request.json());
    const dayLog = await upsertDayLog(body);
    return NextResponse.json({ dayLog }, { status: 201 });
  } catch (err) {
    return handleUnexpected(err);
  }
}

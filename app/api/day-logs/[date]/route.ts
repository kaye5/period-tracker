import { NextRequest, NextResponse } from "next/server";
import { isValid as isValidCivilDate, type CivilDate } from "@/lib/date/civil";
import { deleteDayLog, getDayLog, upsertDayLog } from "@/lib/repo/dayLogs";
import { dayLogSchema } from "@/lib/domain/schema";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";

interface RouteContext {
  params: Promise<{ date: string }>;
}

/** GET /api/day-logs/:date */
export async function GET(_request: NextRequest, { params }: RouteContext) {
  try {
    const { date } = await params;
    if (!isValidCivilDate(date)) return jsonError(400, "`date` must be a valid YYYY-MM-DD date");
    const dayLog = await getDayLog(date as CivilDate);
    if (!dayLog) return jsonError(404, "No day log recorded for this date");
    return NextResponse.json({ dayLog });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** PUT /api/day-logs/:date — create or fully replace this date's log. The URL date and
 * the body's `date` field must agree (SPEC.md R7: never silently reinterpret what the
 * caller is asserting). */
export async function PUT(request: NextRequest, { params }: RouteContext) {
  try {
    const { date } = await params;
    if (!isValidCivilDate(date)) return jsonError(400, "`date` must be a valid YYYY-MM-DD date");
    const body = dayLogSchema.parse(await request.json());
    if (body.date !== date) {
      return jsonError(400, "Body `date` must match the URL date");
    }
    const dayLog = await upsertDayLog(body);
    return NextResponse.json({ dayLog });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** DELETE /api/day-logs/:date — hard delete (SPEC.md's G brief: "actually drop the
 * data, not soft-delete it"). */
export async function DELETE(_request: NextRequest, { params }: RouteContext) {
  try {
    const { date } = await params;
    if (!isValidCivilDate(date)) return jsonError(400, "`date` must be a valid YYYY-MM-DD date");
    const deleted = await deleteDayLog(date as CivilDate);
    if (!deleted) return jsonError(404, "No day log recorded for this date");
    return new NextResponse(null, { status: 204 });
  } catch (err) {
    return handleUnexpected(err);
  }
}

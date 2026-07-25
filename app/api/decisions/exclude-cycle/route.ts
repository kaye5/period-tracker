import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { civilDateSchema } from "@/lib/domain/schema";
import { excludeCycle, unexcludeCycle } from "@/lib/repo/decisions";
import { handleUnexpected } from "@/app/api/_lib/http";

const postSchema = z.object({
  cycleStartDate: civilDateSchema,
  reason: z.string().min(1),
  decidedOn: civilDateSchema,
});
const deleteSchema = z.object({ cycleStartDate: civilDateSchema });

/** POST /api/decisions/exclude-cycle — marks a cycle as user-excluded. SPEC.md R7: "an
 * excluded cycle stays visible in history, marked, with the reason" — this only records
 * the reason; recomputing stats/predictions to actually exclude it is lib/engine's job,
 * driven by this same `decisions` collection on the next `computeEverything` call. */
export async function POST(request: NextRequest) {
  try {
    const body = postSchema.parse(await request.json());
    const userDecisions = await excludeCycle(body.cycleStartDate, body.reason, body.decidedOn);
    return NextResponse.json({ userDecisions });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** DELETE /api/decisions/exclude-cycle — reverses an exclusion. */
export async function DELETE(request: NextRequest) {
  try {
    const body = deleteSchema.parse(await request.json());
    const userDecisions = await unexcludeCycle(body.cycleStartDate);
    return NextResponse.json({ userDecisions });
  } catch (err) {
    return handleUnexpected(err);
  }
}

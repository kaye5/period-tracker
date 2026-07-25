import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { civilDateSchema } from "@/lib/domain/schema";
import { recordSkipPromptAnswer } from "@/lib/repo/decisions";
import { handleUnexpected } from "@/app/api/_lib/http";
import { requireApiUnlock } from "@/lib/security/guard";

const bodySchema = z.object({
  gapStartDate: civilDateSchema,
  confirmed: z.boolean(),
  inferredStartDate: civilDateSchema.optional(),
  decidedOn: civilDateSchema,
});

/** POST /api/decisions/skip-prompt — records the user's answer to a "did you miss
 * logging a period around {date}?" prompt (01-cycle-prediction.md §5.3), so it stops
 * resurfacing (SPEC.md R7: anomalies produce prompts, never mutations — this is the
 * user's *answer* to one). */
export async function POST(request: NextRequest) {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    const body = bodySchema.parse(await request.json());
    const userDecisions = await recordSkipPromptAnswer(
      body.gapStartDate,
      { confirmed: body.confirmed, inferredStartDate: body.inferredStartDate },
      body.decidedOn,
    );
    return NextResponse.json({ userDecisions });
  } catch (err) {
    return handleUnexpected(err);
  }
}

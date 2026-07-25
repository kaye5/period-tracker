import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { civilDateSchema } from "@/lib/domain/schema";
import { setHealthMessageDecision } from "@/lib/repo/decisions";
import { handleUnexpected } from "@/app/api/_lib/http";

const bodySchema = z.object({
  ruleId: z.string().min(1),
  dismissed: z.boolean().optional(),
  snoozedUntil: civilDateSchema.nullable().optional(),
  decidedOn: civilDateSchema,
});

/** POST /api/decisions/health-message — dismiss and/or snooze a health-awareness
 * message by rule id. Note: URG-01 and PMB-01 ignore snooze by design
 * (03-additional-data-and-safety.md; see docs/DECISIONS.md) — that rule lives in agent
 * D's lib/engine/health.ts, which decides whether to honor a stored decision at all;
 * this endpoint only ever records what the user asked for. */
export async function POST(request: NextRequest) {
  try {
    const body = bodySchema.parse(await request.json());
    const healthMessageDecision = await setHealthMessageDecision(
      body.ruleId,
      { dismissed: body.dismissed, snoozedUntil: body.snoozedUntil },
      body.decidedOn,
    );
    return NextResponse.json({ healthMessageDecision });
  } catch (err) {
    return handleUnexpected(err);
  }
}

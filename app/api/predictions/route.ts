import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { civilDateSchema } from "@/lib/domain/schema";
import { issuePrediction, listPredictions } from "@/lib/repo/predictions";
import { handleUnexpected } from "@/app/api/_lib/http";

const postSchema = z.object({
  issuedOn: civilDateSchema,
  predictedCenter: civilDateSchema.nullable(),
  low: civilDateSchema.nullable(),
  high: civilDateSchema.nullable(),
});

/** GET /api/predictions?resolved=true|false — persisted prediction records, for
 * performance measurement/calibration (see lib/repo/predictions.ts's header). Not the
 * live `PredictionResult` shown on the dashboard — that's app/api/compute's job. */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const resolvedParam = searchParams.get("resolved");
    const resolved = resolvedParam === "true" ? true : resolvedParam === "false" ? false : undefined;
    const predictions = await listPredictions({ resolved });
    return NextResponse.json({ predictions });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** POST /api/predictions — records that a prediction was issued, for later resolution
 * (PATCH /api/predictions/:id) once the actual period start is known. */
export async function POST(request: NextRequest) {
  try {
    const body = postSchema.parse(await request.json());
    const prediction = await issuePrediction(body);
    return NextResponse.json({ prediction }, { status: 201 });
  } catch (err) {
    return handleUnexpected(err);
  }
}

import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { civilDateSchema } from "@/lib/domain/schema";
import { resolvePrediction } from "@/lib/repo/predictions";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";

interface RouteContext {
  params: Promise<{ id: string }>;
}

const bodySchema = z.object({ actualStart: civilDateSchema });

/** PATCH /api/predictions/:id — resolves a previously issued prediction against the
 * actual observed period start; computes and stores signedError/covered (see
 * lib/repo/predictions.ts's resolvePrediction for the exact definitions). */
export async function PATCH(request: NextRequest, { params }: RouteContext) {
  try {
    const { id } = await params;
    const body = bodySchema.parse(await request.json());
    const prediction = await resolvePrediction(id, body.actualStart);
    if (!prediction) return jsonError(404, "No prediction with this id");
    return NextResponse.json({ prediction });
  } catch (err) {
    return handleUnexpected(err);
  }
}

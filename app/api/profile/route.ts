import { NextRequest, NextResponse } from "next/server";
import { getProfileOrDefault, upsertProfile } from "@/lib/repo/profile";
import { profileSchema } from "@/lib/domain/schema";
import { handleUnexpected } from "@/app/api/_lib/http";
import { requireApiUnlock } from "@/lib/security/guard";

/** GET /api/profile — the single profile document, or the conservative default (every
 * opt-in off) if onboarding hasn't run yet. */
export async function GET() {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    const profile = await getProfileOrDefault();
    return NextResponse.json({ profile });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/** PUT /api/profile — full replace (there is no partial-update route: a caller that
 * wants to change one field reads first, merges, then PUTs the whole object — same
 * reasoning as day logs, see lib/repo/dayLogs.ts). */
export async function PUT(request: NextRequest) {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    const body = profileSchema.parse(await request.json());
    const profile = await upsertProfile(body);
    return NextResponse.json({ profile });
  } catch (err) {
    return handleUnexpected(err);
  }
}

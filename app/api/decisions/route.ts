import { NextResponse } from "next/server";
import { getUserDecisions, listHealthMessageDecisions } from "@/lib/repo/decisions";
import { handleUnexpected } from "@/app/api/_lib/http";
import { requireApiUnlock } from "@/lib/security/guard";

/** GET /api/decisions — the full decisions state: skip-prompt answers, user-excluded
 * cycles, and dismissed/snoozed health messages. Writes are split across the
 * more specific routes below (skip-prompt, exclude-cycle, health-message), since each
 * has a distinct request shape. */
export async function GET() {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    const [userDecisions, healthMessageDecisions] = await Promise.all([
      getUserDecisions(),
      listHealthMessageDecisions(),
    ]);
    return NextResponse.json({ userDecisions, healthMessageDecisions });
  } catch (err) {
    return handleUnexpected(err);
  }
}

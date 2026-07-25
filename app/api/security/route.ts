import { NextResponse } from "next/server";
import { getSecurity } from "@/lib/repo/security";
import { handleUnexpected } from "@/app/api/_lib/http";

/** GET /api/security — non-sensitive lock status for the UI. Reveals only whether a PIN
 * is configured (never the hash or signing secret), so it is safe to call unauthenticated
 * from the Settings screen and the unlock page. */
export async function GET() {
  try {
    const row = await getSecurity();
    return NextResponse.json({ pinSet: Boolean(row?.pinHash) });
  } catch (err) {
    return handleUnexpected(err);
  }
}

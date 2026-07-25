import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import { handleUnexpected } from "@/app/api/_lib/http";

/** GET /api/health — a trivial DB connectivity check (runs `SELECT 1` against the
 * configured database). Useful to confirm DATABASE_URL is reachable before debugging
 * something else. This is a single-user app, not a public service — this is a local dev
 * connectivity check, not a production liveness probe. */
export async function GET() {
  try {
    const db = getDb();
    await db.execute(sql`select 1`);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return handleUnexpected(err);
  }
}

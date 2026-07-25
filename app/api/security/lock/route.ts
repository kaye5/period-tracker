import { NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/security/session";

/** POST /api/security/lock — end the current unlock session (clear the cookie). The next
 * navigation to any gated screen will require the PIN again. Harmless if already locked. */
export async function POST() {
  const res = NextResponse.json({ ok: true });
  res.cookies.delete(SESSION_COOKIE);
  return res;
}

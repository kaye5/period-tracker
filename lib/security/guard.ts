/**
 * Server-side screen-lock guard. This is the single choke point that decides whether the
 * current request is allowed past the PIN lock.
 *
 * Runs on the Node runtime (it reads the database and uses node:crypto via
 * lib/security/session.ts), so it is called from Server Components (pages) and route
 * handlers — never from Edge middleware, which could reach neither the DB nor scrypt.
 *
 * Locked ⇔ a PIN is configured AND the request has no valid unlock-session cookie. When
 * no PIN is configured the app is fully open (so a new user can reach Settings to set
 * one, and so onboarding is never blocked).
 */
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { NextResponse } from "next/server";
import { getSecurity } from "@/lib/repo/security";
import { SESSION_COOKIE, verifySessionToken } from "@/lib/security/session";

/** True when the current request must be blocked by the screen lock. */
export async function isLocked(): Promise<boolean> {
  const row = await getSecurity();
  // No PIN set (or a half-initialised row) → lock is off.
  if (!row?.pinHash || !row.sessionSecret) return false;
  const token = (await cookies()).get(SESSION_COOKIE)?.value;
  return !verifySessionToken(token, row.sessionSecret, Date.now());
}

/** Page guard: redirect to the unlock screen when locked. Call at the top of every
 * gated Server Component page. */
export async function requirePageUnlock(): Promise<void> {
  if (await isLocked()) {
    redirect("/unlock");
  }
}

/** API guard: returns a 401 Response when locked, or null when the request may proceed.
 * Usage at the top of a route handler:
 *
 *     const locked = await requireApiUnlock();
 *     if (locked) return locked;
 */
export async function requireApiUnlock(): Promise<NextResponse | null> {
  if (await isLocked()) {
    return NextResponse.json({ error: "Locked" }, { status: 401 });
  }
  return null;
}

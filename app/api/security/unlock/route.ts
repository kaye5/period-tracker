import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { getSecurity, setThrottle } from "@/lib/repo/security";
import { verifyPin } from "@/lib/security/pin";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/security/session";
import { handleUnexpected } from "@/app/api/_lib/http";

/** After this many consecutive wrong PINs, the endpoint refuses attempts for
 * `LOCKOUT_MS`. A 6-digit PIN is low-entropy, so this throttle — not the hash — is what
 * makes the lock meaningful against automated guessing. */
const MAX_ATTEMPTS = 5;
const LOCKOUT_MS = 60_000; // 1 minute

const bodySchema = z.object({ pin: z.string() });

/** POST /api/security/unlock — verify a 6-digit PIN and, on success, mint the signed
 * unlock-session cookie. Rate-limited via the `security` row's throttle counters. */
export async function POST(request: NextRequest) {
  try {
    const { pin } = bodySchema.parse(await request.json());
    const row = await getSecurity();

    // No PIN configured → nothing to unlock. Treat as a client/state error rather than
    // silently granting a session.
    if (!row?.pinHash || !row.sessionSecret) {
      return NextResponse.json({ error: "No PIN is set" }, { status: 400 });
    }

    const now = Date.now();
    if (row.lockedUntil && row.lockedUntil > now) {
      return NextResponse.json(
        { error: "Too many attempts", lockedUntil: row.lockedUntil },
        { status: 429 },
      );
    }

    if (!verifyPin(pin, row.pinHash)) {
      const attempts = row.failedAttempts + 1;
      const lockout = attempts >= MAX_ATTEMPTS;
      await setThrottle(lockout ? 0 : attempts, lockout ? now + LOCKOUT_MS : null);
      return NextResponse.json(
        lockout
          ? { error: "Too many attempts", lockedUntil: now + LOCKOUT_MS }
          : { error: "Incorrect PIN", remaining: MAX_ATTEMPTS - attempts },
        { status: 401 },
      );
    }

    // Correct: clear throttle and set the session cookie.
    if (row.failedAttempts !== 0 || row.lockedUntil !== null) {
      await setThrottle(0, null);
    }
    const res = NextResponse.json({ ok: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(row.sessionSecret, now), {
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      path: "/",
      maxAge: Math.floor(SESSION_TTL_MS / 1000),
    });
    return res;
  } catch (err) {
    return handleUnexpected(err);
  }
}

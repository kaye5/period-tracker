import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { clearPin, getSecurity, setPin } from "@/lib/repo/security";
import { hashPin, isValidPin, newSessionSecret, verifyPin } from "@/lib/security/pin";
import { createSessionToken, SESSION_COOKIE, SESSION_TTL_MS } from "@/lib/security/session";
import { handleUnexpected } from "@/app/api/_lib/http";

// This route self-protects rather than relying on the generic unlock guard: setting the
// first PIN happens while the app is still open, and changing/removing an existing PIN
// requires the current PIN in the body regardless of session state.

const setSchema = z.object({ pin: z.string(), currentPin: z.string().optional() });
const removeSchema = z.object({ currentPin: z.string() });

/** POST /api/security/pin — set the PIN (first time) or change it (requires `currentPin`).
 * On success the calling browser is also granted an unlock session, so setting a PIN
 * never immediately locks you out. */
export async function POST(request: NextRequest) {
  try {
    const { pin, currentPin } = setSchema.parse(await request.json());
    if (!isValidPin(pin)) {
      return NextResponse.json({ error: "PIN must be exactly 6 digits" }, { status: 400 });
    }

    const row = await getSecurity();
    if (row?.pinHash) {
      // Changing an existing PIN — the current one must be supplied and correct.
      if (!currentPin || !verifyPin(currentPin, row.pinHash)) {
        return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
      }
    }

    // Reuse the existing signing secret when present so other unrelated sessions survive a
    // PIN change; mint one on first setup.
    const secret = row?.sessionSecret ?? newSessionSecret();
    await setPin(hashPin(pin), secret);

    const res = NextResponse.json({ ok: true, pinSet: true });
    res.cookies.set(SESSION_COOKIE, createSessionToken(secret, Date.now()), {
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

/** DELETE /api/security/pin — turn the lock off. Requires the current PIN, rotates the
 * signing secret (invalidating every session), and clears the cookie. */
export async function DELETE(request: NextRequest) {
  try {
    const { currentPin } = removeSchema.parse(await request.json());
    const row = await getSecurity();
    if (!row?.pinHash) {
      return NextResponse.json({ error: "No PIN is set" }, { status: 400 });
    }
    if (!verifyPin(currentPin, row.pinHash)) {
      return NextResponse.json({ error: "Current PIN is incorrect" }, { status: 401 });
    }

    await clearPin(newSessionSecret());
    const res = NextResponse.json({ ok: true, pinSet: false });
    res.cookies.delete(SESSION_COOKIE);
    return res;
  } catch (err) {
    return handleUnexpected(err);
  }
}

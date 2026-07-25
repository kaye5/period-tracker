"use client";

/**
 * The full-screen unlock gate shown at /unlock when a PIN is configured and the browser
 * has no valid unlock session. Enter the 6-digit PIN → POST /api/security/unlock → on
 * success the server sets the signed session cookie and we do a full navigation to the
 * dashboard (a full load, not a client transition, so the server-side guard re-runs with
 * the new cookie).
 *
 * Honest framing (docs/PRIVACY.md): this is a screen lock, not encryption — the copy
 * makes no claim that the data itself is protected.
 */
import { useEffect, useState } from "react";
import { LockIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PinInput, PIN_LENGTH } from "@/components/security/PinInput";

type Status = "idle" | "verifying" | "error" | "locked-out";

export function UnlockScreen() {
  const [pin, setPin] = useState("");
  const [status, setStatus] = useState<Status>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [now, setNow] = useState(() => Date.now());

  // Tick once a second only while locked out. When the cooldown elapses, clear the
  // lock-out state from inside the interval callback (not a synchronous effect body).
  useEffect(() => {
    if (lockedUntil === null) return;
    const t = setInterval(() => {
      if (Date.now() >= lockedUntil) {
        setLockedUntil(null);
        setStatus("idle");
        setMessage(null);
      }
      setNow(Date.now());
    }, 1000);
    return () => clearInterval(t);
  }, [lockedUntil]);

  const cooldownLeft = lockedUntil ? Math.max(0, Math.ceil((lockedUntil - now) / 1000)) : 0;
  const isLockedOut = cooldownLeft > 0;

  async function submit(candidate: string) {
    if (candidate.length !== PIN_LENGTH || isLockedOut) return;
    setStatus("verifying");
    setMessage(null);
    try {
      const res = await fetch("/api/security/unlock", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: candidate }),
      });
      if (res.ok) {
        // Full navigation so the Server Component guard re-evaluates with the new cookie.
        window.location.assign("/");
        return;
      }
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        remaining?: number;
        lockedUntil?: number;
      };
      setPin("");
      if (res.status === 429 || typeof data.lockedUntil === "number") {
        setLockedUntil(data.lockedUntil ?? Date.now() + 60_000);
        setNow(Date.now());
        setStatus("locked-out");
        setMessage("Too many attempts. Try again in a moment.");
      } else {
        setStatus("error");
        setMessage(
          typeof data.remaining === "number"
            ? `Incorrect PIN — ${data.remaining} attempt${data.remaining === 1 ? "" : "s"} left.`
            : "Incorrect PIN.",
        );
      }
    } catch {
      setPin("");
      setStatus("error");
      setMessage("Something went wrong. Please try again.");
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center px-6 py-16">
      <div className="w-full max-w-xs text-center">
        <div className="mx-auto mb-6 flex size-14 items-center justify-center rounded-full bg-muted text-primary">
          <LockIcon aria-hidden className="size-6" />
        </div>
        <h1 className="text-xl font-semibold text-foreground">Enter your PIN</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          This app is locked. Enter your 6-digit PIN to continue.
        </p>

        <form
          className="mt-8"
          onSubmit={(e) => {
            e.preventDefault();
            void submit(pin);
          }}
        >
          <PinInput
            label="6-digit PIN"
            value={pin}
            onChange={(v) => {
              setPin(v);
              if (status === "error") {
                setStatus("idle");
                setMessage(null);
              }
            }}
            onComplete={(v) => void submit(v)}
            disabled={status === "verifying" || isLockedOut}
            autoFocus
            invalid={status === "error"}
          />

          <p
            role="status"
            aria-live="polite"
            className="mt-4 min-h-5 text-sm text-destructive"
          >
            {isLockedOut ? `Too many attempts. Try again in ${cooldownLeft}s.` : message}
          </p>

          <Button
            type="submit"
            className="mt-2 w-full"
            disabled={pin.length !== PIN_LENGTH || status === "verifying" || isLockedOut}
          >
            {status === "verifying" ? "Checking…" : "Unlock"}
          </Button>
        </form>

        <p className="mt-8 text-xs text-muted-foreground">
          A PIN keeps these screens from opening in this browser. It does not encrypt your
          data or protect the database.
        </p>
      </div>
    </main>
  );
}

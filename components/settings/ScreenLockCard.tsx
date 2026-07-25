"use client";

/**
 * Settings → Screen lock. Set, change, remove, or immediately engage the app's optional
 * 6-digit PIN screen lock. All PIN handling happens server-side via app/api/security/**;
 * this card only ever sends candidate PINs and reflects status.
 *
 * Honest copy (docs/PRIVACY.md): the lock stops the app's screens from opening in a
 * browser. It is deliberately NOT described as encrypting data or protecting the
 * database — because it does neither.
 */
import { useEffect, useState } from "react";
import { LockIcon, ShieldCheckIcon } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { PinInput, PIN_LENGTH } from "@/components/security/PinInput";

type Mode = "view" | "set" | "change" | "remove";

export function ScreenLockCard() {
  const [pinSet, setPinSet] = useState<boolean | null>(null);
  const [mode, setMode] = useState<Mode>("view");

  useEffect(() => {
    fetch("/api/security")
      .then((res) => res.json())
      .then((data: { pinSet: boolean }) => setPinSet(data.pinSet))
      .catch(() => setPinSet(false));
  }, []);

  function reset() {
    setMode("view");
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Screen lock</CardTitle>
        <CardDescription>
          Ask for a 6-digit PIN before the app&apos;s screens open in this browser. This
          doesn&apos;t encrypt your data or protect the database — it&apos;s a screen lock,
          not a vault.
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        {pinSet === null ? (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <Spinner />
            Loading…
          </div>
        ) : mode === "view" ? (
          <ViewMode pinSet={pinSet} onMode={setMode} />
        ) : mode === "set" ? (
          <SetOrChangeForm
            requireCurrent={false}
            onCancel={reset}
            onDone={() => {
              setPinSet(true);
              reset();
              toast.success("PIN lock turned on");
            }}
          />
        ) : mode === "change" ? (
          <SetOrChangeForm
            requireCurrent
            onCancel={reset}
            onDone={() => {
              reset();
              toast.success("PIN changed");
            }}
          />
        ) : (
          <RemoveForm
            onCancel={reset}
            onDone={() => {
              setPinSet(false);
              reset();
              toast.success("PIN lock turned off");
            }}
          />
        )}
      </CardContent>
    </Card>
  );
}

function ViewMode({ pinSet, onMode }: { pinSet: boolean; onMode: (m: Mode) => void }) {
  async function lockNow() {
    await fetch("/api/security/lock", { method: "POST" }).catch(() => {});
    window.location.assign("/unlock");
  }

  if (!pinSet) {
    return (
      <Button variant="outline" className="self-start" onClick={() => onMode("set")}>
        <LockIcon data-icon="inline-start" />
        Set a PIN
      </Button>
    );
  }
  return (
    <>
      <div className="flex items-center gap-2 text-sm text-foreground">
        <ShieldCheckIcon aria-hidden className="size-4 text-primary" />
        PIN lock is on.
      </div>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" onClick={() => onMode("change")}>
          Change PIN
        </Button>
        <Button variant="outline" onClick={() => onMode("remove")}>
          Turn off
        </Button>
        <Button variant="outline" onClick={() => void lockNow()}>
          <LockIcon data-icon="inline-start" />
          Lock now
        </Button>
      </div>
      <p className="text-xs text-muted-foreground">
        If you forget this PIN there is no reset link — you&apos;d need direct database
        access to clear it. Keep it somewhere safe.
      </p>
    </>
  );
}

function SetOrChangeForm({
  requireCurrent,
  onCancel,
  onDone,
}: {
  requireCurrent: boolean;
  onCancel: () => void;
  onDone: () => void;
}) {
  const [current, setCurrent] = useState("");
  const [next, setNext] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const ready =
    (!requireCurrent || current.length === PIN_LENGTH) &&
    next.length === PIN_LENGTH &&
    confirm.length === PIN_LENGTH;

  async function submit() {
    setError(null);
    if (next !== confirm) {
      setError("The two PINs don't match.");
      return;
    }
    setBusy(true);
    try {
      const res = await fetch("/api/security/pin", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pin: next, ...(requireCurrent ? { currentPin: current } : {}) }),
      });
      if (res.ok) {
        onDone();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't save the PIN.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      {requireCurrent ? (
        <PinField label="Current PIN" value={current} onChange={setCurrent} disabled={busy} autoFocus />
      ) : null}
      <PinField
        label={requireCurrent ? "New PIN" : "Choose a 6-digit PIN"}
        value={next}
        onChange={setNext}
        disabled={busy}
        autoFocus={!requireCurrent}
      />
      <PinField label="Confirm PIN" value={confirm} onChange={setConfirm} disabled={busy} />

      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}

      <div className="flex gap-2">
        <Button type="submit" disabled={!ready || busy}>
          {busy ? "Saving…" : requireCurrent ? "Change PIN" : "Turn on lock"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function RemoveForm({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [current, setCurrent] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch("/api/security/pin", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ currentPin: current }),
      });
      if (res.ok) {
        onDone();
        return;
      }
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setError(data.error ?? "Couldn't turn off the lock.");
    } catch {
      setError("Something went wrong. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <form
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <p className="text-sm text-muted-foreground">Enter your current PIN to turn the lock off.</p>
      <PinField label="Current PIN" value={current} onChange={setCurrent} disabled={busy} autoFocus />
      {error ? (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      ) : null}
      <div className="flex gap-2">
        <Button type="submit" variant="destructive" disabled={current.length !== PIN_LENGTH || busy}>
          {busy ? "Turning off…" : "Turn off lock"}
        </Button>
        <Button type="button" variant="ghost" onClick={onCancel} disabled={busy}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

/** A labelled PIN row: a small visible caption above the shared PinInput. Unmasked while
 * setting/changing so the user can see what they're choosing. */
function PinField({
  label,
  value,
  onChange,
  disabled,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="flex flex-col gap-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <PinInput
        label={label}
        value={value}
        onChange={onChange}
        disabled={disabled}
        autoFocus={autoFocus}
        mask={false}
      />
    </div>
  );
}

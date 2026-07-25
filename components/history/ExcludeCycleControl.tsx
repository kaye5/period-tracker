"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { CivilDate } from "@/lib/date/civil";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Textarea } from "@/components/ui/textarea";
import { clientToday, deleteExcludeCycle, postExcludeCycle } from "@/components/charts/api";

export interface ExcludeCycleControlProps {
  cycleStartDate: CivilDate;
  /** Whether this cycle is currently excluded (SPEC.md R7: "an excluded cycle stays
   * visible in history, marked, with the reason" — this control is how a user sets or
   * reverses that mark, never a delete). */
  excluded: boolean;
}

/**
 * "Exclude this cycle from your statistics" / "Include it again" — POSTs/DELETEs
 * `/api/decisions/exclude-cycle` and refreshes (SPEC.md §4.1). Excluding never removes
 * the cycle from the list; it only changes its status, so the reason stays visible.
 */
export function ExcludeCycleControl({ cycleStartDate, excluded }: ExcludeCycleControlProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function confirmExclude() {
    if (reason.trim().length === 0) {
      setError("Add a short reason so you remember why later.");
      return;
    }
    setBusy(true);
    setError(null);
    try {
      await postExcludeCycle({ cycleStartDate, reason: reason.trim(), decidedOn: clientToday() });
      setOpen(false);
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
    } finally {
      setBusy(false);
    }
  }

  async function unexclude() {
    setBusy(true);
    setError(null);
    try {
      await deleteExcludeCycle(cycleStartDate);
      router.refresh();
    } catch {
      setError("Couldn't save. Check your connection and try again.");
      setBusy(false);
    }
  }

  if (excluded) {
    return (
      <div className="flex flex-col gap-1">
        <Button variant="outline" disabled={busy} onClick={unexclude}>
          Include in statistics again
        </Button>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </div>
    );
  }

  return (
    <AlertDialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) {
          setReason("");
          setError(null);
        }
      }}
    >
      <AlertDialogTrigger render={<Button variant="ghost">Exclude from statistics</Button>} />
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Exclude this cycle</AlertDialogTitle>
          <AlertDialogDescription>
            This cycle stays visible in your history, marked as excluded, with the reason you give —
            it&apos;s only left out of the statistics and predictions computed from your recorded cycles.
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Field data-invalid={error ? true : undefined}>
          <FieldLabel htmlFor="exclude-reason">Reason</FieldLabel>
          <Textarea
            id="exclude-reason"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            aria-invalid={error ? true : undefined}
            placeholder="e.g. traveling, illness, this wasn't a typical cycle"
          />
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Cancel</AlertDialogCancel>
          <AlertDialogAction disabled={busy} onClick={confirmExclude}>
            Exclude
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

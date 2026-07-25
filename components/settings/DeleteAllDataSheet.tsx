"use client";

/**
 * Permanent-delete confirmation (SPEC.md's U1 brief: "permanent delete with a
 * confirmation that states plainly and specifically what will be destroyed and that it
 * cannot be undone"). Fetches the real day-log count before showing the confirmation so
 * the number isn't a guess, and requires typing a phrase before the destructive button
 * is even enabled — deliberately more friction than a single click for an action with
 * no recovery path.
 *
 * Rendered as an AlertDialog (not a plain Sheet) because it is a destructive
 * confirmation — SPEC's shadcn refactor mapping requires that distinction. Component
 * file name kept as `DeleteAllDataSheet` since nothing outside components/settings/
 * imports it and renaming buys nothing.
 */
import { useEffect, useState } from "react";
import { AlertTriangleIcon } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  DELETE_CONFIRMATION_PHRASE,
  describeDeletionScope,
  isDeletionPhraseConfirmed,
} from "@/components/settings/settingsHelpers";

const CONFIRM_TOKEN = "DELETE_ALL_DATA";

/**
 * The caller is expected to mount this component only while the dialog should be shown
 * (e.g. `{deleteOpen && <DeleteAllDataSheet ... />}`) rather than always rendering it
 * with an `open` prop — that way each open is a fresh mount with fresh state, and this
 * component never needs to reset its own state from inside an effect.
 */
export function DeleteAllDataSheet({
  hasProfile,
  onClose,
  onDeleted,
}: {
  hasProfile: boolean;
  onClose: () => void;
  onDeleted: () => void;
}) {
  const [dayLogCount, setDayLogCount] = useState<number | null>(null);
  const [typed, setTyped] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/day-logs")
      .then((res) => (res.ok ? res.json() : { dayLogs: [] }))
      .then((data: { dayLogs: unknown[] }) => setDayLogCount(data.dayLogs.length))
      .catch(() => setDayLogCount(null));
  }, []);

  async function handleDelete() {
    setDeleting(true);
    setError(null);
    try {
      const res = await fetch("/api/delete-all", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirm: CONFIRM_TOKEN }),
      });
      if (!res.ok) throw new Error("Deletion failed. Nothing was removed.");
      onDeleted();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Deletion failed. Nothing was removed.");
    } finally {
      setDeleting(false);
    }
  }

  const scope = describeDeletionScope({ dayLogCount: dayLogCount ?? 0, hasProfile });
  const confirmed = isDeletionPhraseConfirmed(typed);

  return (
    <AlertDialog
      open
      onOpenChange={(next) => {
        if (!next && !deleting) onClose();
      }}
    >
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertTriangleIcon className="mb-1 size-6 text-destructive" aria-hidden="true" />
          <AlertDialogTitle>Permanently delete everything</AlertDialogTitle>
          <AlertDialogDescription render={<div className="text-left" />}>
            <p className="mb-2 text-sm text-foreground">
              This permanently deletes, right now, with no way to get it back:
            </p>
            <ul className="mb-3 list-disc pl-5 text-sm text-foreground">
              {scope.map((line) => (
                <li key={line}>{line}</li>
              ))}
            </ul>
            <p className="text-sm font-medium text-destructive">
              This cannot be undone. There is no trash, no backup, and no recovery inside this
              app.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>

        <Field>
          <FieldLabel htmlFor="delete-confirm-input">
            Type {DELETE_CONFIRMATION_PHRASE} to confirm
          </FieldLabel>
          <Input
            id="delete-confirm-input"
            type="text"
            autoComplete="off"
            className="h-11"
            value={typed}
            onChange={(e) => setTyped(e.target.value)}
          />
        </Field>

        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}

        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Cancel</AlertDialogCancel>
          <AlertDialogAction
            variant="destructive"
            disabled={!confirmed || deleting}
            onClick={handleDelete}
          >
            {deleting ? "Deleting…" : "Delete everything permanently"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}

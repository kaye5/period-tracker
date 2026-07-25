"use client";

import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";

export interface NothingToReportButtonProps {
  onTap: () => void;
  pending: boolean;
  savedJustNow: boolean;
}

/**
 * The one-tap "nothing to report" control (SPEC.md U3 brief: "give it real
 * prominence" — it's what converts an unknown day into a true negative for the insight
 * engine, C's §E "dual missing-data robustness gate"). Deliberately the single largest,
 * highest-contrast control on the page, above every other section, and a single tap
 * saves immediately — no separate Save step, unlike the rest of the form.
 */
export function NothingToReportButton({ onTap, pending, savedJustNow }: NothingToReportButtonProps) {
  return (
    <Button
      type="button"
      variant="secondary"
      onClick={onTap}
      disabled={pending}
      className="h-14 w-full border-2 text-base"
    >
      {pending ? (
        "Saving…"
      ) : savedJustNow ? (
        <>
          Saved — nothing to report
          <Check data-icon="inline-end" aria-hidden="true" />
        </>
      ) : (
        "Nothing to report today"
      )}
    </Button>
  );
}

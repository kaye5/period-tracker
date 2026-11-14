"use client";

/**
 * "Did you miss logging a period around {date}?" (01-cycle-prediction.md §5.3 — "the
 * single highest-value affordance in the whole build"). One `SkipPromptItem` at a time
 * (`DashboardScreen` passes the earliest unanswered one); answering POSTs to the
 * already-built `/api/decisions/skip-prompt` route and refreshes the server data
 * (this agent's DATA-FLOW PATTERN: client components POST, then `router.refresh()`).
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import type { CivilDate } from "@/lib/date/civil";
import type { SkipPromptItem } from "@/lib/engine";
import { formatLongDate, civilDateParts } from "./format";
import { missedPeriodPrompt, SKIP_PROMPT_YES_LABEL, SKIP_PROMPT_NO_LABEL } from "./copy";

export interface SkipPromptBannerProps {
  item: SkipPromptItem;
  today: CivilDate;
}

export function SkipPromptBanner({ item, today }: SkipPromptBannerProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);

  async function answer(confirmed: boolean) {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/decisions/skip-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          gapStartDate: item.cycleStartDate,
          confirmed,
          inferredStartDate: confirmed ? item.prompt.suggestedDate : undefined,
          decidedOn: today,
        }),
      });
      if (!res.ok) throw new Error("failed to save answer");
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  const referenceYear = civilDateParts(today).year;
  const dateText = formatLongDate(item.prompt.suggestedDate, referenceYear);

  return (
    <section role="status" className="relative flex flex-col gap-stack stage p-card">
      <span aria-hidden className="absolute inset-y-card left-0 w-1 rounded-r-full bg-warning" />
      <p className="text-body text-card-foreground text-pretty">{missedPeriodPrompt(dateText)}</p>
      {error ? (
        <p className="text-label font-normal text-destructive">That didn&apos;t save. Please try again.</p>
      ) : null}
      <div className="flex flex-wrap gap-2 border-t border-border pt-stack">
        <Button disabled={busy} onClick={() => answer(true)}>
          {SKIP_PROMPT_YES_LABEL}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => answer(false)}>
          {SKIP_PROMPT_NO_LABEL}
        </Button>
      </div>
    </section>
  );
}

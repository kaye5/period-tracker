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
import { Card, CardContent, CardFooter } from "@/components/ui/card";
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
    <Card className="border-l-4 border-l-warning" role="status">
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-foreground">{missedPeriodPrompt(dateText)}</p>
        {error ? (
          <p className="text-sm text-destructive">That didn&apos;t save. Please try again.</p>
        ) : null}
      </CardContent>
      <CardFooter className="flex-wrap gap-2">
        <Button disabled={busy} onClick={() => answer(true)}>
          {SKIP_PROMPT_YES_LABEL}
        </Button>
        <Button variant="outline" disabled={busy} onClick={() => answer(false)}>
          {SKIP_PROMPT_NO_LABEL}
        </Button>
      </CardFooter>
    </Card>
  );
}

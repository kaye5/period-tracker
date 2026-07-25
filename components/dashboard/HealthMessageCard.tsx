"use client";

/**
 * Renders one `HealthMessage` (SPEC.md §3 / lib/engine/health.ts, agent D).
 *
 * Two visual registers, per this agent's brief:
 *   - `severity: 'seek_urgent_care'` — "visually distinct, not dismissible, rendered as
 *     the attributed quotation the engine produced." No disclosure gate, no dismiss
 *     control: the message and its source are simply shown, in a destructive `Alert` that
 *     is always visible.
 *   - everything else (`informational` / `discuss_with_clinician`) — "calm secondary
 *     cards with a 'Why am I seeing this?' disclosure (source, threshold, dismiss)."
 *     The Dismiss control only renders when `message.dismissible` is true — PMB-01 is
 *     `discuss_with_clinician` (calm-card styling) but `dismissible: false`, so the two
 *     axes (severity -> style, dismissible -> control) are independent, not implied by
 *     each other.
 *
 * `message.message` already comes verbatim from `lib/copy/health.ts` with the user's own
 * numbers filled in (SPEC.md R9) — this component never edits or paraphrases it.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, TriangleAlert } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Alert, AlertTitle, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";
import type { CivilDate } from "@/lib/date/civil";
import type { HealthMessage } from "@/lib/domain/types";
import { WHY_AM_I_SEEING_THIS_LABEL, DISMISS_LABEL } from "./copy";

export interface HealthMessageCardProps {
  message: HealthMessage;
  today: CivilDate;
}

export function HealthMessageCard({ message, today }: HealthMessageCardProps) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  async function dismiss() {
    setBusy(true);
    setError(false);
    try {
      const res = await fetch("/api/decisions/health-message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ruleId: message.ruleId, dismissed: true, decidedOn: today }),
      });
      if (!res.ok) throw new Error("failed to dismiss");
      setDismissed(true);
      router.refresh();
    } catch {
      setError(true);
      setBusy(false);
    }
  }

  // Optimistic: hide immediately on success rather than waiting on the server refresh,
  // since the refresh replaces this whole tree anyway.
  if (dismissed) return null;

  if (message.severity === "seek_urgent_care") {
    return (
      <Alert
        variant="destructive"
        className="border-2 border-destructive"
        data-health-rule={message.ruleId}
      >
        <TriangleAlert aria-hidden />
        <AlertTitle>
          <blockquote className="m-0 text-sm font-medium text-foreground">
            {message.message}
          </blockquote>
        </AlertTitle>
        <AlertDescription className="flex flex-col gap-1">
          <p>Source: {message.sourceName}.</p>
          <a
            href={message.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-fit items-center text-xs underline underline-offset-2"
          >
            Read the source
          </a>
        </AlertDescription>
      </Alert>
    );
  }

  const accentClass =
    message.severity === "discuss_with_clinician" ? "border-l-warning" : "border-l-border";

  return (
    <Card className={cn("border-l-4", accentClass)} data-health-rule={message.ruleId}>
      <CardContent className="flex flex-col gap-2">
        <p className="text-sm text-foreground">{message.message}</p>

        <Collapsible>
          <CollapsibleTrigger
            render={
              <Button
                variant="ghost"
                size="sm"
                className="group h-11 w-fit justify-start px-2 text-xs font-medium text-muted-foreground"
              />
            }
          >
            {WHY_AM_I_SEEING_THIS_LABEL}
            <ChevronDown
              aria-hidden
              data-icon="inline-end"
              className="transition-transform group-data-[panel-open]:rotate-180"
            />
          </CollapsibleTrigger>
          <CollapsibleContent className="flex flex-col gap-1 px-2 text-xs text-muted-foreground">
            <p>Source: {message.sourceName}</p>
            <p>{message.sourceThreshold}</p>
            <a
              href={message.sourceUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex min-h-11 w-fit items-center underline underline-offset-2"
            >
              Read the source
            </a>
          </CollapsibleContent>
        </Collapsible>

        {message.dismissible ? (
          <Button
            variant="ghost"
            size="sm"
            className="h-11 w-fit px-3 text-xs"
            disabled={busy}
            onClick={dismiss}
          >
            {DISMISS_LABEL}
          </Button>
        ) : null}
        {error ? (
          <p className="text-xs text-destructive">That didn&apos;t save. Please try again.</p>
        ) : null}
      </CardContent>
    </Card>
  );
}

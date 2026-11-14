"use client";

/**
 * Renders one `HealthMessage` (SPEC.md §3 / lib/engine/health.ts, agent D).
 *
 * Two visual registers, per this agent's brief:
 *   - `severity: 'seek_urgent_care'` — "visually distinct, not dismissible, rendered as
 *     the attributed quotation the engine produced." No disclosure gate, no dismiss
 *     control: the message and its source are simply shown, always visible, marked by a
 *     destructive edge and warning icon (role="alert").
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
import { Button } from "@/components/ui/button";
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
      <div role="alert" data-health-rule={message.ruleId} className="relative flex gap-3 stage p-card">
        <AccentEdge className="bg-destructive" />
        <TriangleAlert aria-hidden className="mt-0.5 size-5 shrink-0 text-destructive" />
        <div className="flex min-w-0 flex-col gap-1">
          <blockquote className="m-0 text-body font-semibold text-card-foreground text-pretty">
            {message.message}
          </blockquote>
          <p className="text-caption text-muted-foreground">Source: {message.sourceName}.</p>
          <a
            href={message.sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex min-h-11 w-fit items-center text-label text-card-foreground underline underline-offset-2"
          >
            Read the source
          </a>
        </div>
      </div>
    );
  }

  const accentClass = message.severity === "discuss_with_clinician" ? "bg-warning" : "bg-border-strong";

  return (
    <article data-health-rule={message.ruleId} className="relative flex flex-col gap-1 stage p-card">
      <AccentEdge className={accentClass} />
      <p className="text-body text-card-foreground text-pretty">{message.message}</p>

      <Collapsible>
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="group -ml-3 w-fit justify-start px-3 text-muted-foreground"
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
        <CollapsibleContent className="flex flex-col gap-1 text-caption text-muted-foreground">
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
        <Button variant="outline" className="w-fit" disabled={busy} onClick={dismiss}>
          {DISMISS_LABEL}
        </Button>
      ) : null}
      {error ? (
        <p className="text-caption text-destructive">That didn&apos;t save. Please try again.</p>
      ) : null}
    </article>
  );
}

/** Severity edge: a short bar inset from the rounded corners, so the tint marks the card
 * without washing it (the icon and wording carry the meaning, not this colour). */
function AccentEdge({ className }: { className: string }) {
  return <span aria-hidden className={cn("absolute inset-y-card left-0 w-1 rounded-r-full", className)} />;
}

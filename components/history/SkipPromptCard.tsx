"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { postSkipPromptAnswer, clientToday } from "@/components/charts/api";
import type { SkipPromptViewModel } from "@/components/history/cycleListData";

export interface SkipPromptCardProps {
  prompt: SkipPromptViewModel;
}

/**
 * "Did you miss logging a period around {date}?" (01-cycle-prediction.md §5.3 item 3 —
 * "the single highest-value affordance in the whole build"). Answering either way POSTs
 * to `/api/decisions/skip-prompt` and refreshes the server data (SPEC.md §4.1: the
 * engine recomputes everything downstream from the recorded decision, never from a
 * locally-patched value).
 */
export function SkipPromptCard({ prompt }: SkipPromptCardProps) {
  const router = useRouter();
  const [selectedDate, setSelectedDate] = useState(prompt.suggestedDate);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function answer(confirmed: boolean) {
    setBusy(true);
    setError(null);
    try {
      await postSkipPromptAnswer({
        gapStartDate: prompt.cycleStartDate,
        confirmed,
        inferredStartDate: confirmed ? selectedDate : undefined,
        decidedOn: clientToday(),
      });
      router.refresh();
    } catch {
      setError("Couldn't save your answer. Check your connection and try again.");
      setBusy(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Did you miss logging a period?</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <p className="text-sm text-foreground">{prompt.question}</p>
        {prompt.alternativeDates.length > 0 ? (
          <ToggleGroup
            aria-label="Which date"
            value={[selectedDate]}
            onValueChange={(values) => {
              const next = values[0];
              if (next) setSelectedDate(next as typeof selectedDate);
            }}
          >
            <ToggleGroupItem value={prompt.suggestedDate}>{prompt.suggestedDateText}</ToggleGroupItem>
            {prompt.alternativeDates.map((alt) => (
              <ToggleGroupItem key={alt.date} value={alt.date}>
                {alt.text}
              </ToggleGroupItem>
            ))}
          </ToggleGroup>
        ) : null}
        <div className="flex flex-wrap gap-2">
          <Button variant="default" disabled={busy} onClick={() => answer(true)}>
            Yes, around {prompt.alternativeDates.length > 0 ? "this date" : prompt.suggestedDateText}
          </Button>
          <Button variant="outline" disabled={busy} onClick={() => answer(false)}>
            No
          </Button>
        </div>
        {error ? (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}

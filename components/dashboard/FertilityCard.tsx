import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { FertilityEstimate } from "@/lib/domain/types";
import { formatDateRange } from "./format";
import { FERTILE_WINDOW_HEADLINE } from "./copy";

export interface FertilityCardProps {
  fertility: FertilityEstimate;
}

/**
 * Renders only when the caller has an `output.fertility` to pass — SPEC.md §0: "When
 * off: no fertility UI, no fertility cards..." `DashboardScreen` only mounts this
 * component when `'fertility' in output`, never on an optional-chained/possibly-absent
 * value (this agent's brief: "do not optional-chain into a disabled feature").
 *
 * `fertility.confidenceNote` and `fertility.disclaimer` are both engine-produced copy
 * (`lib/engine/fertility.ts`, agent B) — this component never rebuilds or paraphrases
 * either, and renders the disclaimer directly adjacent to the estimate (inside the same
 * card, immediately below it), never behind a link (SPEC.md §3's own comment on
 * `FertilityEstimate.disclaimer`).
 */
export function FertilityCard({ fertility }: FertilityCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{FERTILE_WINDOW_HEADLINE}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-2 text-sm text-foreground">
          <div>
            <dt className="text-muted-foreground">Fertile window</dt>
            <dd className="font-medium">
              {formatDateRange(fertility.fertileLow, fertility.fertileHigh)}
            </dd>
          </div>
          <div>
            <dt className="text-muted-foreground">Estimated ovulation</dt>
            <dd className="font-medium">
              {formatDateRange(fertility.ovulationLow, fertility.ovulationHigh)}
            </dd>
          </div>
        </dl>
        <p className="text-sm text-muted-foreground">{fertility.confidenceNote}</p>
        <p className="rounded-lg border border-border bg-muted p-3 text-xs text-muted-foreground">
          {fertility.disclaimer}
        </p>
      </CardContent>
    </Card>
  );
}

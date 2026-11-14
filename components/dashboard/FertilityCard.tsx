import type { FertilityEstimate } from "@/lib/domain/types";
import type { CyclePhase } from "@/lib/engine";
import { PHASE_DASHBOARD_NOTE, PHASE_LABELS } from "@/lib/copy/general";
import { formatDateRange } from "./format";
import { FERTILE_WINDOW_HEADLINE } from "./copy";

export interface FertilityCardProps {
  fertility: FertilityEstimate;
  /** Today's display phase (`lib/engine/fertility.ts`'s `cyclePhase`), or null when it
   * can't be classified (e.g. today falls outside the current cycle/prediction window).
   * Null renders nothing extra — the card keeps its current appearance exactly. */
  phase: CyclePhase | null;
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
export function FertilityCard({ fertility, phase }: FertilityCardProps) {
  return (
    <article className="flex flex-col gap-stack stage p-card">
      <h3 className="text-heading text-card-foreground text-balance">{FERTILE_WINDOW_HEADLINE}</h3>
      <dl className="grid gap-stack">
        <div className="flex flex-col gap-0.5">
          <dt className="text-label font-normal text-muted-foreground">Fertile window</dt>
          <dd className="text-body font-semibold text-card-foreground tabular-nums">
            {formatDateRange(fertility.fertileLow, fertility.fertileHigh)}
          </dd>
        </div>
        <div className="flex flex-col gap-0.5">
          <dt className="text-label font-normal text-muted-foreground">Estimated ovulation</dt>
          <dd className="text-body font-semibold text-card-foreground tabular-nums">
            {formatDateRange(fertility.ovulationLow, fertility.ovulationHigh)}
          </dd>
        </div>
        {phase !== null ? (
          <div className="flex flex-col gap-0.5">
            <dt className="text-label font-normal text-muted-foreground">Today</dt>
            <dd className="text-body text-card-foreground">
              {PHASE_LABELS[phase]} — {PHASE_DASHBOARD_NOTE[phase]}
            </dd>
          </div>
        ) : null}
      </dl>
      <p className="text-label font-normal text-muted-foreground text-pretty">{fertility.confidenceNote}</p>
      <p className="rounded-xl bg-muted p-3 text-caption text-muted-foreground text-pretty">{fertility.disclaimer}</p>
    </article>
  );
}

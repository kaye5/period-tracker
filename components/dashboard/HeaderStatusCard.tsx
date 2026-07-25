import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import type { HeaderStatusViewModel } from "./cardContent";

export interface HeaderStatusCardProps {
  status: HeaderStatusViewModel;
}

/**
 * The dashboard's lead card (this agent's brief: "the header status card carries the
 * confidence phrase and its reason"). `status.headline` is either a range claim
 * ("Period expected between...", SPEC.md R8/§4.3 — always a range, never a bare date) or
 * a fallback explanation when no range can be shown yet; `status.hasRange` tells the two
 * apart so only a real range gets the emphasized visual treatment.
 */
export function HeaderStatusCard({ status }: HeaderStatusCardProps) {
  return (
    <Card className="border-l-4 border-l-primary">
      <CardHeader>
        <CardTitle
          className={
            status.hasRange
              ? "text-lg font-semibold text-foreground"
              : "text-base font-medium text-muted-foreground"
          }
        >
          {status.headline}
        </CardTitle>
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        <dl className="grid gap-2 text-sm text-foreground">
          {status.cycleDayText ? (
            <div>
              <dt className="sr-only">Current cycle day</dt>
              <dd>{status.cycleDayText}</dd>
            </div>
          ) : null}
          {status.lastPeriodStartText ? (
            <div>
              <dt className="sr-only">Last period start</dt>
              <dd>{status.lastPeriodStartText}</dd>
            </div>
          ) : null}
          {status.typicalRangeText ? (
            <div>
              <dt className="sr-only">Typical cycle range</dt>
              <dd className="text-muted-foreground">{status.typicalRangeText}</dd>
            </div>
          ) : null}
        </dl>

        <div className="border-t border-border pt-3">
          <p className="text-sm font-medium text-foreground">{status.confidenceLabel}</p>
          <p className="text-sm text-muted-foreground">{status.confidenceReason}</p>
          {status.completedCyclesUsedText ? (
            <p className="mt-1 text-xs text-muted-foreground">{status.completedCyclesUsedText}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

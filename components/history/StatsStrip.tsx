import type { CycleStatistics } from "@/lib/engine/stats";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { buildHistoryStatsViewModel, statTileDisplay } from "@/components/history/historyStats";
import { pluralize } from "@/components/charts/format";

export interface StatsStripProps {
  stats: CycleStatistics;
}

interface StatTileProps {
  label: string;
  value: string;
  sub: string;
  /** Overrides the default large numeric treatment — used only by the "Variability"
   * tile, whose value is a full restated sentence (the engine's own headline) rather
   * than a bare number. */
  valueClassName?: string;
}

function StatTile({ label, value, sub, valueClassName }: StatTileProps) {
  return (
    <Card size="sm">
      <CardContent className="flex flex-col gap-1">
        <p className="text-xs text-muted-foreground">{label}</p>
        <p className={cn("font-semibold text-foreground", valueClassName ?? "text-2xl tabular-nums")}>{value}</p>
        <p className="text-xs text-muted-foreground">{sub}</p>
      </CardContent>
    </Card>
  );
}

/**
 * The History screen's at-a-glance strip (redesign spec's B1): a compact grid of stat
 * tiles restating numbers already computed by the engine (`CycleStatistics`, reached
 * through `historyStats.ts`'s pure view-model builders) — nothing here is derived or
 * recomputed. Every stat tile pairs its headline number with the low–high range and n
 * ("never a lone center", SPEC.md's U4 brief); a null stat still renders its tile, with
 * an em dash and the honest "fills in once you've recorded…" copy, so the grid's layout
 * never shifts as data arrives.
 */
export function StatsStrip({ stats }: StatsStripProps) {
  const vm = buildHistoryStatsViewModel(stats);
  const cycleLength = statTileDisplay(stats.typicalCycleLength);
  const periodDuration = statTileDisplay(stats.periodDuration, "days", "period");
  const daysWithFlowText = `${vm.flow.daysWithLoggedFlow} ${pluralize(vm.flow.daysWithLoggedFlow, "day")} with a flow level logged`;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      <StatTile
        label="Typical cycle"
        value={cycleLength ? cycleLength.value : "—"}
        sub={
          cycleLength
            ? cycleLength.sub
            : "Nothing to show yet — this fills in once you've recorded at least one completed cycle."
        }
      />
      <StatTile
        label="Period length"
        value={periodDuration ? periodDuration.value : "—"}
        sub={
          periodDuration
            ? periodDuration.sub
            : "Nothing to show yet — this fills in once you've recorded a period."
        }
      />
      <StatTile
        label="Variability"
        value={vm.variability ? vm.variability.headline : "—"}
        sub={vm.variability ? (vm.variability.bandLabel ?? " ") : "Not enough cycles recorded yet for this."}
        valueClassName={vm.variability ? "text-sm leading-snug" : "text-2xl tabular-nums"}
      />
      <StatTile label="Heavy-flow days" value={String(stats.heavyFlowDayCount)} sub={daysWithFlowText} />
    </div>
  );
}

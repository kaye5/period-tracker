import type { CycleStatistics } from "@/lib/engine/stats";
import { buildHistoryStatsViewModel, statTileDisplay } from "@/components/history/historyStats";
import { pluralize } from "@/components/charts/format";

export interface StatsStripProps {
  stats: CycleStatistics;
}

interface StatTileProps {
  label: string;
  value: string;
  sub: string;
}

function StatTile({ label, value, sub }: StatTileProps) {
  return (
    <div className="flex flex-col gap-1 stage p-4">
      <p className="text-caption text-muted-foreground">{label}</p>
      <p className="text-heading text-card-foreground tabular-nums">{value}</p>
      <p className="text-caption text-muted-foreground tabular-nums text-pretty">{sub}</p>
    </div>
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
    <div className="flex flex-col gap-stack">
      {/* Variability is the engine's own plain-sentence headline (Flo "patterns of your
       * body": one insight, one sentence), so it gets the full width instead of a tile. */}
      <div className="flex flex-col gap-1 stage p-card">
        <p className="text-caption text-muted-foreground">Variability</p>
        <p className="text-heading text-card-foreground tabular-nums text-balance">
          {vm.variability ? vm.variability.headline : "—"}
        </p>
        <p className="text-label font-normal text-muted-foreground">
          {vm.variability ? (vm.variability.bandLabel ?? " ") : "Not enough cycles recorded yet for this."}
        </p>
      </div>
      <div className="grid grid-cols-2 gap-stack sm:grid-cols-3">
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
        <div className="col-span-2 sm:col-span-1">
          <StatTile label="Heavy-flow days" value={String(stats.heavyFlowDayCount)} sub={daysWithFlowText} />
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { FileTextIcon } from "lucide-react";
import type { CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, Cycle, DayLog } from "@/lib/domain/types";
import type { CycleStatistics } from "@/lib/engine/stats";
import type { SkipPromptItem } from "@/lib/engine";
import type { PredictedVsActualLike } from "@/components/charts/transforms";
import { buildSkipPromptViewModels } from "@/components/history/cycleListData";
import { buildHistoryStatsViewModel } from "@/components/history/historyStats";
import { SkipPromptCard } from "@/components/history/SkipPromptCard";
import { StatsStrip } from "@/components/history/StatsStrip";
import { CycleList } from "@/components/history/CycleList";
import { ChartsPanel } from "@/components/history/ChartsPanel";
import { StatsDetails } from "@/components/history/StatsDetails";
import { Button } from "@/components/ui/button";

export interface HistoryScreenProps {
  cycles: readonly Cycle[];
  episodes: readonly BleedingEpisode[];
  dayLogs: readonly DayLog[];
  stats: CycleStatistics;
  skipPrompts: readonly SkipPromptItem[];
  predictedVsActual: readonly PredictedVsActualLike[];
  highlightedDates: readonly CivilDate[];
  /** Ends the in-progress cycle's bar at today (its remainder is drawn as an estimate). */
  today: CivilDate;
}

/**
 * The Insights screen, route /history (SPEC.md's U4 brief / PRD §10-11). Everything here is derived
 * server-side from one `computeEverything` call (SPEC.md §4.1) and passed down as plain
 * data — this component only lays the sections out; it recomputes nothing.
 *
 * Page order (redesign spec's "Final page order"): header -> skip prompts (actionable,
 * stays on top) -> StatsStrip (at-a-glance numbers) -> CycleList (the list itself) ->
 * ChartsPanel ("Trends") -> StatsDetails (reference tables). The page leads with "what
 * happened", quantifies it at a glance, then ends with "how it trends" plus detail.
 */
export function HistoryScreen({
  cycles,
  episodes,
  dayLogs,
  stats,
  skipPrompts,
  predictedVsActual,
  highlightedDates,
  today,
}: HistoryScreenProps) {
  const prompts = buildSkipPromptViewModels(skipPrompts);
  const vm = buildHistoryStatsViewModel(stats);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-section px-gutter py-section">
      <header className="flex items-start justify-between gap-4">
        <div className="flex flex-col gap-1">
          <h1 className="text-title text-foreground">Insights</h1>
          <p className="text-label font-normal text-muted-foreground tabular-nums">{vm.completedCycleCountText}</p>
        </div>
        {/* The Report tab left the nav (Daylight brief, "Settings"/"Insights"): reachable here. */}
        <Button variant="outline" className="rounded-full" nativeButton={false} render={<Link href="/report" />}>
          <FileTextIcon aria-hidden />
          Report
        </Button>
      </header>

      {prompts.length > 0 ? (
        <div className="flex flex-col gap-stack">
          {prompts.map((prompt) => (
            <SkipPromptCard key={prompt.cycleStartDate} prompt={prompt} />
          ))}
        </div>
      ) : null}

      <StatsStrip stats={stats} />

      <CycleList
        cycles={cycles}
        highlightedDates={highlightedDates}
        today={today}
        typicalCycleLength={stats.typicalCycleLength}
      />

      <ChartsPanel
        cycles={cycles}
        episodes={episodes}
        dayLogs={dayLogs}
        stats={stats}
        predictedVsActual={predictedVsActual}
      />

      <StatsDetails stats={stats} />
    </main>
  );
}

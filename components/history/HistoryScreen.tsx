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

export interface HistoryScreenProps {
  cycles: readonly Cycle[];
  episodes: readonly BleedingEpisode[];
  dayLogs: readonly DayLog[];
  stats: CycleStatistics;
  skipPrompts: readonly SkipPromptItem[];
  predictedVsActual: readonly PredictedVsActualLike[];
  highlightedDates: readonly CivilDate[];
}

/**
 * The History screen (SPEC.md's U4 brief / PRD §10-11). Everything here is derived
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
}: HistoryScreenProps) {
  const prompts = buildSkipPromptViewModels(skipPrompts);
  const vm = buildHistoryStatsViewModel(stats);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">History</h1>
        <p className="text-sm text-muted-foreground">{vm.completedCycleCountText}</p>
      </div>

      {prompts.length > 0 ? (
        <div className="flex flex-col gap-3">
          {prompts.map((prompt) => (
            <SkipPromptCard key={prompt.cycleStartDate} prompt={prompt} />
          ))}
        </div>
      ) : null}

      <StatsStrip stats={stats} />

      <CycleList cycles={cycles} highlightedDates={highlightedDates} />

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

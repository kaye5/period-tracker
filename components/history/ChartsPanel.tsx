import type { BleedingEpisode, Cycle, DayLog } from "@/lib/domain/types";
import type { CycleStatistics } from "@/lib/engine/stats";
import { CycleLengthChart } from "@/components/charts/CycleLengthChart";
import { PeriodDurationChart } from "@/components/charts/PeriodDurationChart";
import { FlowByPeriodDayChart } from "@/components/charts/FlowByPeriodDayChart";
import { SymptomTimelineChart } from "@/components/charts/SymptomTimelineChart";
import { PredictedVsActualChart } from "@/components/charts/PredictedVsActualChart";
import type { PredictedVsActualLike } from "@/components/charts/transforms";
import { symptomFrequencyRows } from "@/components/history/historyStats";

export interface ChartsPanelProps {
  cycles: readonly Cycle[];
  episodes: readonly BleedingEpisode[];
  dayLogs: readonly DayLog[];
  stats: CycleStatistics;
  predictedVsActual: readonly PredictedVsActualLike[];
}

/** Rows shown in the symptom timeline, most-frequently-logged first — an unbounded
 * "every symptom ever logged" row set would make the chart unreadably tall. */
const MAX_TIMELINE_SYMPTOMS = 8;

/**
 * Composes the five required charts (SPEC.md's U4 brief) from already-computed engine
 * data, under a "Trends" section heading (history redesign spec). No chart-specific
 * logic lives here — every chart shapes its own data via
 * `components/charts/transforms.ts`; this only decides which rows to hand each one and
 * the reading order: length/duration/accuracy first (most decision-relevant), then the
 * flow and symptom detail charts.
 */
export function ChartsPanel({ cycles, episodes, dayLogs, stats, predictedVsActual }: ChartsPanelProps) {
  const timelineSymptoms = symptomFrequencyRows(stats.symptomFrequency)
    .slice(0, MAX_TIMELINE_SYMPTOMS)
    .map((row) => row.symptom);

  return (
    <section className="flex flex-col gap-6">
      <h2 className="text-lg font-semibold text-foreground">Trends</h2>
      <CycleLengthChart cycles={cycles} typicalCycleLength={stats.typicalCycleLength} />
      <PeriodDurationChart episodes={episodes} periodDuration={stats.periodDuration} />
      <PredictedVsActualChart points={predictedVsActual} />
      <FlowByPeriodDayChart flowPattern={stats.flowPattern} />
      <SymptomTimelineChart dayLogs={dayLogs} symptoms={timelineSymptoms} />
    </section>
  );
}

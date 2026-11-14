import type { BleedingEpisode, Cycle, DayLog } from "@/lib/domain/types";
import type { CycleStatistics } from "@/lib/engine/stats";
import { CycleLengthChart } from "@/components/charts/CycleLengthChart";
import { PeriodDurationChart } from "@/components/charts/PeriodDurationChart";
import { FlowByPeriodDayChart } from "@/components/charts/FlowByPeriodDayChart";
import { SymptomTimelineChart } from "@/components/charts/SymptomTimelineChart";
import { PredictedVsActualChart } from "@/components/charts/PredictedVsActualChart";
import type { PredictedVsActualLike } from "@/components/charts/transforms";
import { symptomFrequencyRows } from "@/components/history/historyStats";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

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
 * flow and symptom detail charts. One chart at a time, behind Tabs (Daylight brief,
 * "Insights"); each chart keeps its own text alternative and data table.
 */
export function ChartsPanel({ cycles, episodes, dayLogs, stats, predictedVsActual }: ChartsPanelProps) {
  const timelineSymptoms = symptomFrequencyRows(stats.symptomFrequency)
    .slice(0, MAX_TIMELINE_SYMPTOMS)
    .map((row) => row.symptom);

  const tabs = [
    {
      value: "cycle-length",
      label: "Cycle length",
      chart: <CycleLengthChart cycles={cycles} typicalCycleLength={stats.typicalCycleLength} />,
    },
    {
      value: "period",
      label: "Period",
      chart: <PeriodDurationChart episodes={episodes} periodDuration={stats.periodDuration} />,
    },
    { value: "predicted", label: "Predictions", chart: <PredictedVsActualChart points={predictedVsActual} /> },
    { value: "flow", label: "Flow", chart: <FlowByPeriodDayChart flowPattern={stats.flowPattern} /> },
    {
      value: "symptoms",
      label: "Symptoms",
      chart: <SymptomTimelineChart dayLogs={dayLogs} symptoms={timelineSymptoms} />,
    },
  ];

  return (
    <section className="flex flex-col gap-stack stage p-card">
      <h2 className="text-heading text-card-foreground">Trends</h2>
      <Tabs defaultValue="cycle-length" className="gap-section">
        <TabsList
          aria-label="Charts"
          className="h-auto w-full flex-wrap justify-start gap-2 bg-transparent p-0 group-data-horizontal/tabs:h-auto"
        >
          {tabs.map((t) => (
            <TabsTrigger
              key={t.value}
              value={t.value}
              className="h-chip flex-none rounded-full border-border px-4 text-label text-muted-foreground hover:bg-muted hover:text-foreground data-active:border-primary data-active:bg-primary data-active:text-primary-foreground data-active:hover:bg-primary group-data-[variant=default]/tabs-list:data-active:shadow-none dark:text-muted-foreground dark:data-active:border-primary dark:data-active:bg-primary dark:data-active:text-primary-foreground"
            >
              {t.label}
            </TabsTrigger>
          ))}
        </TabsList>
        {tabs.map((t) => (
          <TabsContent key={t.value} value={t.value} className="min-w-0">
            {t.chart}
          </TabsContent>
        ))}
      </Tabs>
    </section>
  );
}

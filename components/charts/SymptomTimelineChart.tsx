"use client";

import { CartesianGrid, ReferenceArea, Scatter, ScatterChart, XAxis, YAxis } from "recharts";
import type { ScatterShapeProps } from "recharts";
import type { CivilDate } from "@/lib/date/civil";
import { addDays, diffDays } from "@/lib/date/civil";
import type { DayLog, SymptomId } from "@/lib/domain/types";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { buildSymptomTimelineData } from "@/components/charts/transforms";
import { formatCivilDate, formatCivilDateShort } from "@/components/charts/format";
import { symptomLabel } from "@/lib/copy/insights";

export interface SymptomTimelineChartProps {
  dayLogs: readonly DayLog[];
  /** Rows to draw, in order — the caller decides (typically the panel's most-frequent
   * symptoms first) since "every symptom that was ever logged, every day ever recorded"
   * would make the row/column count unbounded. */
  symptoms: readonly SymptomId[];
}

interface SymptomPoint {
  dayIndex: number;
  rowIndex: number;
  date: CivilDate;
  symptom: SymptomId;
}

const DAY_WIDTH = 8;
const ROW_HEIGHT = 22;
const MARGIN = { top: 10, right: 16, bottom: 24, left: 130 };

const chartConfig = {
  symptom: { label: "Symptom" },
} satisfies ChartConfig;

function SymptomDot(props: ScatterShapeProps) {
  const { cx, cy } = props;
  if (cx == null || cy == null) return null;
  return <circle cx={cx} cy={cy} r={4} fill="var(--chart-1)" />;
}

/** "Symptom timeline" (SPEC.md's U4 brief). Calendar-time rows, one per symptom, with a
 * dot on every day it was logged present; a shaded band across all rows marks recorded
 * bleeding days for context. Deliberately wide (one column per calendar day) — the U4
 * brief requires wide charts to scroll within their own container rather than the page,
 * which `ChartFrame` provides. X/Y positions are day/row indexes computed with
 * `diffDays` — never a constructed `Date` (R1). */
export function SymptomTimelineChart({ dayLogs, symptoms }: SymptomTimelineChartProps) {
  const data = buildSymptomTimelineData(dayLogs, symptoms);

  if (data.domainStart === null || data.domainEnd === null || symptoms.length === 0) {
    return (
      <ChartFrame
        title="Symptom timeline"
        summary="No symptom data logged yet."
        columns={["Date", "Symptom"]}
        rows={[]}
        emptyMessage="Symptom timeline will appear here once you've logged a symptom."
      >
        {null}
      </ChartFrame>
    );
  }

  const domainStart: CivilDate = data.domainStart;
  const domainEnd: CivilDate = data.domainEnd;
  const totalDays = diffDays(domainStart, domainEnd) + 1;
  const xForDate = (date: CivilDate) => diffDays(domainStart, date);

  const rows = data.series.flatMap((s) => s.dates.map((date) => [formatCivilDate(date), symptomLabel(s.symptom)]));

  const points: SymptomPoint[] = data.series.flatMap((s, rowIndex) =>
    s.dates.map((date) => ({ dayIndex: xForDate(date), rowIndex, date, symptom: s.symptom })),
  );

  // Month tick marks along the x-axis, one label at each calendar-month boundary crossed.
  const monthTicks: { dayIndex: number; label: string }[] = [];
  let cursorMonth = "";
  for (let i = 0; i < totalDays; i++) {
    const date = addDays(domainStart, i);
    const m = date.slice(0, 7);
    if (m !== cursorMonth) {
      cursorMonth = m;
      monthTicks.push({ dayIndex: i, label: formatCivilDateShort(date) });
    }
  }
  const monthLabelByIndex = new Map(monthTicks.map((t) => [t.dayIndex, t.label]));
  const symptomLabelByRow = symptoms.map((s) => symptomLabel(s));

  const width = MARGIN.left + MARGIN.right + totalDays * DAY_WIDTH;
  const height = MARGIN.top + MARGIN.bottom + symptoms.length * ROW_HEIGHT;

  return (
    <ChartFrame
      title="Symptom timeline"
      description="One row per symptom, across calendar time; shaded columns are recorded bleeding days."
      summary={`Timeline from ${formatCivilDate(domainStart)} to ${formatCivilDate(domainEnd)}, one row per symptom with a mark on each day it was logged. Shaded columns show recorded bleeding days.`}
      columns={["Date", "Symptom"]}
      rows={rows}
      emptyMessage="Symptom timeline will appear here once you've logged a symptom."
    >
      <div style={{ minWidth: `${width}px` }}>
        <ChartContainer config={chartConfig} className="aspect-auto w-full" style={{ height: `${height}px` }}>
          <ScatterChart margin={{ top: MARGIN.top, right: MARGIN.right, bottom: MARGIN.bottom, left: MARGIN.left }}>
            <CartesianGrid vertical={false} />
            <XAxis
              type="number"
              dataKey="dayIndex"
              domain={[0, totalDays - 1]}
              ticks={monthTicks.map((t) => t.dayIndex)}
              tickFormatter={(v: number) => monthLabelByIndex.get(v) ?? ""}
              tickLine={false}
              axisLine={false}
            />
            <YAxis
              type="number"
              dataKey="rowIndex"
              domain={[0, Math.max(symptoms.length - 1, 0)]}
              ticks={symptoms.map((_, i) => i)}
              tickFormatter={(v: number) => symptomLabelByRow[v] ?? ""}
              reversed
              width={MARGIN.left}
              tickLine={false}
              axisLine={false}
            />
            {data.periodBands.map((band, i) => (
              <ReferenceArea
                key={i}
                x1={xForDate(band.start)}
                x2={xForDate(band.end) + 1}
                fill="var(--chart-1)"
                fillOpacity={0.1}
                strokeOpacity={0}
              />
            ))}
            <ChartTooltip
              cursor={{ strokeDasharray: "3 3" }}
              content={
                <ChartTooltipContent
                  hideLabel
                  formatter={(_value, _name, item) => {
                    const d = item.payload as SymptomPoint;
                    return (
                      <div className="flex w-full flex-col gap-0.5">
                        <span className="font-medium text-foreground">{symptomLabel(d.symptom)}</span>
                        <span className="text-muted-foreground">{formatCivilDate(d.date)}</span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Scatter data={points} shape={SymptomDot} isAnimationActive={false} />
          </ScatterChart>
        </ChartContainer>
      </div>
    </ChartFrame>
  );
}

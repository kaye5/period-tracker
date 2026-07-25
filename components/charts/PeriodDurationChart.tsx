"use client";

import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import type { BarShapeProps } from "recharts";
import type { CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, StatSummary } from "@/lib/domain/types";
import { Legend } from "@/components/ui/Legend";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketPeriodDurationsByMonth } from "@/components/charts/transforms";
import { formatCivilDate, formatCivilDateShort } from "@/components/charts/format";

export interface PeriodDurationChartProps {
  episodes: readonly BleedingEpisode[];
  periodDuration?: StatSummary | null;
}

interface PeriodDurationDatum {
  startDate: CivilDate;
  label: string;
  durationDays: number;
  endInferred: boolean;
}

const chartConfig = {
  durationDays: { label: "Period duration" },
} satisfies ChartConfig;

const BAR_SLOT_WIDTH = 56;
const MIN_WIDTH = 420;

function PeriodDurationBarShape(props: BarShapeProps) {
  const { x, y, width, height, payload } = props;
  const datum = payload as PeriodDurationDatum;
  return datum.endInferred ? (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={height}
      radius={[4, 4, 0, 0]}
      fill="var(--chart-1)"
      fillOpacity={0.45}
      stroke="var(--chart-1)"
      strokeDasharray="4 2"
      strokeWidth={1.5}
    />
  ) : (
    <Rectangle x={x} y={y} width={width} height={height} radius={[4, 4, 0, 0]} fill="var(--chart-1)" fillOpacity={1} />
  );
}

/** "Period duration by month" (SPEC.md's U4 brief). One bar per bleeding episode with a
 * known duration, x = the episode's start date. An inferred end (no explicit "end"
 * boundary logged) is marked with reduced opacity plus a dashed outline — not colour
 * alone — since that duration is a guess, not a recorded fact. */
export function PeriodDurationChart({ episodes, periodDuration }: PeriodDurationChartProps) {
  const buckets = bucketPeriodDurationsByMonth(episodes);
  const points = buckets.flatMap((bucket) => bucket.points);

  const data: PeriodDurationDatum[] = points.map((p) => ({
    startDate: p.startDate,
    label: formatCivilDateShort(p.startDate),
    durationDays: p.durationDays,
    endInferred: p.endInferred,
  }));

  const rows = data.map((d) => [
    formatCivilDate(d.startDate),
    `${d.durationDays} day${d.durationDays === 1 ? "" : "s"}`,
    d.endInferred ? "End date inferred" : "Explicit start and end logged",
  ]);

  const width = Math.max(data.length * BAR_SLOT_WIDTH, MIN_WIDTH);

  return (
    <ChartFrame
      title="Period duration by month"
      description="Days per period, with your recent typical range shaded."
      summary={
        data.length > 0
          ? `Bar chart of ${data.length} recorded period durations in days, one bar per period in order of its start date.`
          : "No recorded periods yet."
      }
      columns={["Period starting", "Duration", "Note"]}
      rows={rows}
      emptyMessage="Period duration will appear here once you've recorded a period."
      legend={
        <Legend
          label="Period duration chart legend"
          items={[
            { swatchClassName: "bg-[var(--chart-1)]", label: "Explicit start and end logged" },
            {
              icon: <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px] border-2 border-dashed border-[var(--chart-1)] bg-[var(--chart-1)]/45" />,
              label: "End date not explicitly logged",
              description: "Duration is estimated from the last logged bleeding day",
            },
          ]}
        />
      }
    >
      <div style={{ minWidth: `${width}px` }}>
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={32} allowDecimals={false} />
            {periodDuration ? (
              <ReferenceArea
                y1={periodDuration.low}
                y2={periodDuration.high}
                fill="var(--chart-1)"
                fillOpacity={0.08}
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />
            ) : null}
            {periodDuration ? (
              <ReferenceLine y={periodDuration.center} stroke="var(--chart-1)" strokeDasharray="4 4" ifOverflow="extendDomain" />
            ) : null}
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload as PeriodDurationDatum | undefined;
                    return d ? formatCivilDate(d.startDate) : null;
                  }}
                  formatter={(_value, _name, item) => {
                    const d = item.payload as PeriodDurationDatum;
                    return (
                      <div className="flex w-full flex-col gap-0.5">
                        <span className="font-mono font-medium text-foreground tabular-nums">
                          {d.durationDays} day{d.durationDays === 1 ? "" : "s"}
                        </span>
                        {d.endInferred ? <span className="text-muted-foreground">End date inferred</span> : null}
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="durationDays" maxBarSize={28} shape={PeriodDurationBarShape} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </div>
    </ChartFrame>
  );
}

"use client";

import { Bar, BarChart, CartesianGrid, Rectangle, ReferenceArea, ReferenceLine, XAxis, YAxis } from "recharts";
import type { BarShapeProps } from "recharts";
import type { CivilDate } from "@/lib/date/civil";
import type { Cycle, CycleStatus, StatSummary } from "@/lib/domain/types";
import { Legend } from "@/components/ui/Legend";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { bucketCycleLengthsByMonth } from "@/components/charts/transforms";
import { formatCivilDate, formatCivilDateShort } from "@/components/charts/format";

export interface CycleLengthChartProps {
  cycles: readonly Cycle[];
  /** The engine's own typical-length summary (SPEC.md: "render all four [center, low,
   * high, n], never just the center") — drawn as a shaded reference band plus a dashed
   * centre line, never as a single line alone, so the band itself keeps the range
   * visible. */
  typicalCycleLength?: StatSummary | null;
}

const STATUS_LABEL: Record<CycleStatus, string> = {
  ok: "Recorded",
  gap_unknown: "Gap — unknown",
  skip_suspected: "Possible missed period",
  excluded_by_user: "Excluded by you",
  in_progress: "In progress",
};

interface CycleLengthDatum {
  startDate: CivilDate;
  label: string;
  lengthDays: number;
  status: CycleStatus;
  statusReason?: string;
}

const chartConfig = {
  lengthDays: { label: "Cycle length" },
} satisfies ChartConfig;

const BAR_SLOT_WIDTH = 56;
const MIN_WIDTH = 420;

/** Fill/stroke encoding for a cycle's status — never colour alone (R7): `ok` is a solid
 * rose bar, `gap_unknown`/`skip_suspected` are the same rose at reduced opacity with a
 * dashed outline, and `excluded_by_user` is an outline-only bar (no fill). */
function statusShape(status: CycleStatus) {
  switch (status) {
    case "gap_unknown":
    case "skip_suspected":
      return { fill: "var(--chart-1)", fillOpacity: 0.45, stroke: "var(--chart-1)", strokeDasharray: "4 2" };
    case "excluded_by_user":
      return { fill: "transparent", fillOpacity: 1, stroke: "var(--muted-foreground)", strokeDasharray: undefined };
    default:
      return { fill: "var(--chart-1)", fillOpacity: 1, stroke: undefined, strokeDasharray: undefined };
  }
}

function CycleLengthBarShape(props: BarShapeProps) {
  const { x, y, width, height, payload } = props;
  const datum = payload as CycleLengthDatum;
  const style = statusShape(datum.status);
  return (
    <Rectangle
      x={x}
      y={y}
      width={width}
      height={height}
      radius={[4, 4, 0, 0]}
      fill={style.fill}
      fillOpacity={style.fillOpacity}
      stroke={style.stroke}
      strokeDasharray={style.strokeDasharray}
      strokeWidth={style.stroke ? 1.5 : 0}
    />
  );
}

/** "Cycle length by month" (SPEC.md's U4 brief). One bar per cycle with a known length,
 * x = the cycle's start date; bar style (not colour alone) shows the cycle's status so
 * an excluded or gap-flagged cycle stays visibly distinct from a recorded one (R7). */
export function CycleLengthChart({ cycles, typicalCycleLength }: CycleLengthChartProps) {
  const buckets = bucketCycleLengthsByMonth(cycles);
  const points = buckets.flatMap((bucket) => bucket.points);
  const reasonByStart = new Map(cycles.map((c) => [c.startDate, c.statusReason]));

  const data: CycleLengthDatum[] = points.map((p) => ({
    startDate: p.startDate,
    label: formatCivilDateShort(p.startDate),
    lengthDays: p.lengthDays,
    status: p.status,
    statusReason: reasonByStart.get(p.startDate),
  }));

  const rows = data.map((d) => [
    formatCivilDate(d.startDate),
    `${d.lengthDays} days`,
    d.statusReason ? `${STATUS_LABEL[d.status]} — ${d.statusReason}` : STATUS_LABEL[d.status],
  ]);

  const width = Math.max(data.length * BAR_SLOT_WIDTH, MIN_WIDTH);

  return (
    <ChartFrame
      title="Cycle length by month"
      description="Days per cycle, with your recent typical range shaded."
      summary={
        data.length > 0
          ? `Bar chart of ${data.length} recorded cycle lengths in days, one bar per cycle in order of the cycle's start date.`
          : "No recorded cycles yet."
      }
      columns={["Cycle starting", "Length", "Status"]}
      rows={rows}
      emptyMessage="Cycle length will appear here once you've recorded a full cycle."
      legend={
        <Legend
          label="Cycle length chart legend"
          items={[
            { swatchClassName: "bg-[var(--chart-1)]", label: "Recorded" },
            {
              icon: <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px] border-2 border-dashed border-[var(--chart-1)] bg-[var(--chart-1)]/45" />,
              label: "Gap — unknown / possible missed period",
              description: "Dashed outline, reduced fill",
            },
            {
              icon: <span aria-hidden="true" className="inline-block h-2.5 w-2.5 rounded-[2px] border-2 border-[var(--muted-foreground)]" />,
              label: "Excluded by you",
              description: "Outline bar, no fill",
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
            {typicalCycleLength ? (
              <ReferenceArea
                y1={typicalCycleLength.low}
                y2={typicalCycleLength.high}
                fill="var(--chart-1)"
                fillOpacity={0.08}
                strokeOpacity={0}
                ifOverflow="extendDomain"
              />
            ) : null}
            {typicalCycleLength ? (
              <ReferenceLine
                y={typicalCycleLength.center}
                stroke="var(--chart-1)"
                strokeDasharray="4 4"
                ifOverflow="extendDomain"
              />
            ) : null}
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload as CycleLengthDatum | undefined;
                    return d ? formatCivilDate(d.startDate) : null;
                  }}
                  formatter={(_value, _name, item) => {
                    const d = item.payload as CycleLengthDatum;
                    return (
                      <div className="flex w-full flex-col gap-0.5">
                        <span className="font-mono font-medium text-foreground tabular-nums">{d.lengthDays} days</span>
                        <span className="text-muted-foreground">{STATUS_LABEL[d.status]}</span>
                        {d.statusReason ? <span className="text-muted-foreground">{d.statusReason}</span> : null}
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="lengthDays" maxBarSize={28} shape={CycleLengthBarShape} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </div>
    </ChartFrame>
  );
}

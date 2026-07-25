"use client";

import { Bar, BarChart, CartesianGrid, Label, Rectangle, ReferenceLine, XAxis, YAxis } from "recharts";
import type { BarShapeProps } from "recharts";
import type { CivilDate } from "@/lib/date/civil";
import { Legend } from "@/components/ui/Legend";
import { ChartFrame } from "@/components/charts/ChartFrame";
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { predictedVsActualErrorDomain, type PredictedVsActualLike } from "@/components/charts/transforms";
import { formatCivilDate, formatCivilDateShort, formatSignedDays } from "@/components/charts/format";

export interface PredictedVsActualChartProps {
  points: readonly PredictedVsActualLike[];
}

interface PredictedVsActualDatum {
  anchorStart: CivilDate;
  label: string;
  signedErrorDays: number;
  insideWindow: boolean;
}

const chartConfig = {
  signedErrorDays: { label: "Actual vs. predicted" },
} satisfies ChartConfig;

const BAR_SLOT_WIDTH = 48;
const MIN_WIDTH = 360;

/** Positive (late) bars get rounded top corners; negative (early) bars stay square —
 * "the tip of the bar", the end farthest from the zero line, is the rounded one. Colour
 * encodes whether the actual start fell inside the predicted window (rose) or outside it
 * (blue) — never the only signal, since the tooltip and data table both spell it out too. */
function PredictedVsActualBarShape(props: BarShapeProps) {
  const { x, y, width, height, payload } = props;
  const datum = payload as PredictedVsActualDatum;
  const fill = datum.insideWindow ? "var(--chart-1)" : "var(--chart-2)";
  const positive = datum.signedErrorDays >= 0;
  return <Rectangle x={x} y={y} width={width} height={height} radius={positive ? [4, 4, 0, 0] : 0} fill={fill} />;
}

/** "Predicted vs. actual period start" (SPEC.md's U4 brief). One bar per resolved
 * prediction: y = signed error in days (actual minus predicted; the zero line means
 * "exactly on time"), x = cycle in time order. */
export function PredictedVsActualChart({ points }: PredictedVsActualChartProps) {
  const [domainLow, domainHigh] = predictedVsActualErrorDomain(points);

  const data: PredictedVsActualDatum[] = points.map((p) => ({
    anchorStart: p.anchorStart,
    label: formatCivilDateShort(p.anchorStart),
    signedErrorDays: p.signedErrorDays,
    insideWindow: p.insideWindow,
  }));

  const rows = points.map((p) => [
    formatCivilDate(p.anchorStart),
    formatSignedDays(p.signedErrorDays),
    p.insideWindow ? "Inside the predicted window" : "Outside the predicted window",
  ]);

  const width = Math.max(data.length * BAR_SLOT_WIDTH, MIN_WIDTH);

  return (
    <ChartFrame
      title="Predicted vs. actual period start"
      description="How many days early or late each period actually started, versus the prediction."
      summary={
        points.length > 0
          ? `Bar chart of ${points.length} resolved predictions, showing how many days early or late each period actually started compared to the predicted range's center.`
          : "No resolved predictions yet."
      }
      columns={["Cycle starting", "Actual vs. predicted", "Window"]}
      rows={rows}
      emptyMessage="This fills in once a predicted period has come and gone."
      legend={
        <Legend
          label="Predicted vs. actual chart legend"
          items={[
            { swatchClassName: "bg-[var(--chart-1)]", label: "Inside the predicted window" },
            { swatchClassName: "bg-[var(--chart-2)]", label: "Outside the predicted window" },
          ]}
        />
      }
    >
      <div style={{ minWidth: `${width}px` }}>
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 12 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={40} domain={[domainLow, domainHigh]} allowDecimals={false}>
              <Label
                value="Days early ↔ late"
                angle={-90}
                position="insideLeft"
                style={{ fill: "var(--muted-foreground)", fontSize: 11, textAnchor: "middle" }}
              />
            </YAxis>
            <ReferenceLine y={0} stroke="var(--muted-foreground)" />
            <ChartTooltip
              cursor={false}
              content={
                <ChartTooltipContent
                  labelFormatter={(_, payload) => {
                    const d = payload?.[0]?.payload as PredictedVsActualDatum | undefined;
                    return d ? formatCivilDate(d.anchorStart) : null;
                  }}
                  formatter={(_value, _name, item) => {
                    const d = item.payload as PredictedVsActualDatum;
                    return (
                      <div className="flex w-full flex-col gap-0.5">
                        <span className="font-mono font-medium text-foreground tabular-nums">{formatSignedDays(d.signedErrorDays)}</span>
                        <span className="text-muted-foreground">
                          {d.insideWindow ? "Inside the predicted window" : "Outside the predicted window"}
                        </span>
                      </div>
                    );
                  }}
                />
              }
            />
            <Bar dataKey="signedErrorDays" maxBarSize={28} shape={PredictedVsActualBarShape} isAnimationActive={false} />
          </BarChart>
        </ChartContainer>
      </div>
    </ChartFrame>
  );
}

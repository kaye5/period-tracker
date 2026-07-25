"use client";

import { Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import type { TooltipContentProps } from "recharts";
import { ChartFrame } from "@/components/charts/ChartFrame";
import {
  ChartContainer,
  ChartLegend,
  ChartLegendContent,
  ChartTooltip,
  type ChartConfig,
} from "@/components/ui/chart";
import { buildFlowByDayPoints, FLOW_LEVELS } from "@/components/charts/transforms";
import { formatPercent } from "@/components/charts/format";
import type { FlowPatternDay } from "@/lib/engine/stats";
import type { FlowLevel } from "@/lib/domain/types";

export interface FlowByPeriodDayChartProps {
  flowPattern: readonly FlowPatternDay[];
}

const FLOW_LABEL: Record<FlowLevel, string> = {
  spotting: "Spotting",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  very_heavy: "Very heavy",
};

interface FlowByDayDatum {
  periodDay: number;
  label: string;
  loggedDayCount: number;
  counts: Record<FlowLevel, number>;
  spotting: number;
  light: number;
  medium: number;
  heavy: number;
  very_heavy: number;
}

// Sequential rose ramp (flow is ordered data, not five categorical hues — SPEC.md's
// U4 brief); tokens registered in app/globals.css as --chart-flow-1..5.
const chartConfig = {
  spotting: { label: FLOW_LABEL.spotting, color: "var(--chart-flow-1)" },
  light: { label: FLOW_LABEL.light, color: "var(--chart-flow-2)" },
  medium: { label: FLOW_LABEL.medium, color: "var(--chart-flow-3)" },
  heavy: { label: FLOW_LABEL.heavy, color: "var(--chart-flow-4)" },
  very_heavy: { label: FLOW_LABEL.very_heavy, color: "var(--chart-flow-5)" },
} satisfies ChartConfig;

const BAR_SLOT_WIDTH = 48;
const MIN_WIDTH = 360;

/**
 * "Flow by period day" (SPEC.md's U4 brief). One 100%-stacked bar per day-of-period
 * offset, showing the mix of logged flow levels that day. The stack is a sequential
 * rose ramp (light -> dark = spotting -> very heavy) since flow is ordered data, not
 * unrelated categories; a 2px gap (stroke matching the card background) separates
 * segments.
 */
export function FlowByPeriodDayChart({ flowPattern }: FlowByPeriodDayChartProps) {
  const points = buildFlowByDayPoints(flowPattern).filter((p) => p.loggedDayCount > 0);

  const data: FlowByDayDatum[] = points.map((p) => ({
    periodDay: p.periodDay,
    label: `Day ${p.periodDay}`,
    loggedDayCount: p.loggedDayCount,
    counts: p.counts,
    spotting: p.fractions.spotting,
    light: p.fractions.light,
    medium: p.fractions.medium,
    heavy: p.fractions.heavy,
    very_heavy: p.fractions.very_heavy,
  }));

  const rows = points.map((p) => [
    `Day ${p.periodDay}`,
    String(p.loggedDayCount),
    ...FLOW_LEVELS.map((level) => `${p.counts[level]} (${formatPercent(p.fractions[level])})`),
  ]);

  const width = Math.max(data.length * BAR_SLOT_WIDTH, MIN_WIDTH);

  const renderTooltip = (props: TooltipContentProps) => {
    const { active, payload } = props;
    if (!active || !payload?.length) return null;
    const datum = payload[0]?.payload as FlowByDayDatum | undefined;
    if (!datum) return null;
    return (
      <div className="grid min-w-40 gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-xs shadow-xl">
        <div className="font-medium text-foreground">
          Day {datum.periodDay} — {datum.loggedDayCount} day{datum.loggedDayCount === 1 ? "" : "s"} logged
        </div>
        <div className="grid gap-1">
          {FLOW_LEVELS.map((level) => (
            <div key={level} className="flex items-center gap-2">
              <span aria-hidden="true" className="h-2.5 w-2.5 shrink-0 rounded-[2px]" style={{ background: `var(--color-${level})` }} />
              <span className="flex-1 text-muted-foreground">{FLOW_LABEL[level]}</span>
              <span className="font-mono font-medium text-foreground tabular-nums">{datum.counts[level]}</span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <ChartFrame
      title="Flow by period day"
      description="Share of logged flow levels on each day of the period."
      summary={
        data.length > 0
          ? `Stacked bar chart showing the mix of logged flow levels on each day of the period, day 1 through day ${data[data.length - 1]?.periodDay ?? 1}.`
          : "No flow levels logged yet."
      }
      columns={["Period day", "Days logged", ...FLOW_LEVELS.map((l) => FLOW_LABEL[l])]}
      rows={rows}
      emptyMessage="Flow pattern will appear here once you've logged a flow level on a period day."
    >
      <div style={{ minWidth: `${width}px` }}>
        <ChartContainer config={chartConfig} className="aspect-auto h-56 w-full">
          <BarChart data={data} margin={{ top: 8, right: 8, bottom: 4, left: 4 }}>
            <CartesianGrid vertical={false} />
            <XAxis dataKey="label" tickLine={false} axisLine={false} />
            <YAxis tickLine={false} axisLine={false} width={40} domain={[0, 1]} tickFormatter={(v: number) => formatPercent(v)} />
            <ChartTooltip cursor={false} content={renderTooltip} />
            {FLOW_LEVELS.map((level) => (
              <Bar
                key={level}
                dataKey={level}
                name={level}
                stackId="flow"
                fill={`var(--color-${level})`}
                stroke="var(--card)"
                strokeWidth={2}
                isAnimationActive={false}
              />
            ))}
            <ChartLegend content={<ChartLegendContent />} />
          </BarChart>
        </ChartContainer>
      </div>
    </ChartFrame>
  );
}

"use client";

/**
 * Everything behind the dashboard's "more" affordance (this agent's brief: "At most
 * THREE primary cards... Everything else (period duration, flow, cycle variation,
 * symptoms, fertility, performance, health-awareness) is secondary, behind a 'more'
 * affordance"). Collapsed by default; a single disclosure trigger expands the whole
 * section rather than each card individually, since these are all "read more when
 * curious" material, not competing calls to action.
 */
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { CivilDate } from "@/lib/date/civil";
import type { CycleStatistics, HitRateSummary, PerformanceSummary } from "@/lib/engine";
import type { FertilityEstimate, HealthMessage, Insight } from "@/lib/domain/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from "@/components/ui/collapsible";
import { symptomLabel } from "@/lib/copy/insights";
import { EMPTY_STATES } from "@/lib/copy/general";
import { PrimaryCard } from "./PrimaryCard";
import { FertilityCard } from "./FertilityCard";
import { HealthMessageCard } from "./HealthMessageCard";
import { selectTopSymptoms } from "./symptomSelection";
import {
  SECTION_HEADINGS,
  SHOW_MORE_LABEL,
  SHOW_LESS_LABEL,
  periodDurationSummary,
  cycleVariationNotYet,
  symptomFrequencySummary,
  lastPredictionError,
  typicalRecentMiss,
  windowHitRateSummary,
  NOT_ENOUGH_RESOLVED_PREDICTIONS,
} from "./copy";

const MIN_CYCLES_FOR_VARIABILITY = 6;

export interface MoreSectionProps {
  today: CivilDate;
  stats: CycleStatistics;
  secondaryInsights: readonly Insight[];
  fertility?: FertilityEstimate;
  performance: PerformanceSummary;
  nonUrgentHealthMessages: readonly HealthMessage[];
}

export function MoreSection({
  today,
  stats,
  secondaryInsights,
  fertility,
  performance,
  nonUrgentHealthMessages,
}: MoreSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger
        aria-expanded={expanded}
        render={<Button variant="secondary" className="group w-full" />}
      >
        <span className="flex-1 text-center">{expanded ? SHOW_LESS_LABEL : SHOW_MORE_LABEL}</span>
        <ChevronDown
          aria-hidden
          data-icon="inline-end"
          className="transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-3 flex flex-col gap-3">
        <PeriodDurationCard stats={stats} />
        <CycleVariationCard stats={stats} />
        {stats.heavyFlowDayCount > 0 ? <FlowCard stats={stats} /> : null}
        {selectTopSymptoms(stats.symptomFrequency).length > 0 ? (
          <SymptomsCard stats={stats} />
        ) : null}
        {secondaryInsights.length > 0 ? (
          <div className="flex flex-col gap-3">
            {secondaryInsights.map((insight) => (
              <PrimaryCard
                key={insight.id}
                headline={insight.headline}
                body={insight.body}
                detail={insight.detail}
                supportingDates={insight.supportingDates}
              />
            ))}
          </div>
        ) : null}
        {fertility ? <FertilityCard fertility={fertility} /> : null}
        <PerformanceCard performance={performance} />
        {nonUrgentHealthMessages.length > 0 ? (
          <div className="flex flex-col gap-3">
            <h2 className="text-sm font-semibold text-foreground">
              {SECTION_HEADINGS.healthNotes}
            </h2>
            {nonUrgentHealthMessages.map((message) => (
              <HealthMessageCard key={message.ruleId} message={message} today={today} />
            ))}
          </div>
        ) : null}
      </CollapsibleContent>
    </Collapsible>
  );
}

function PeriodDurationCard({ stats }: { stats: CycleStatistics }) {
  const { periodDuration } = stats;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTION_HEADINGS.periodDuration}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {periodDuration !== null
            ? periodDurationSummary(periodDuration.low, periodDuration.high, periodDuration.n)
            : EMPTY_STATES.noCompletedCycles}
        </p>
      </CardContent>
    </Card>
  );
}

function CycleVariationCard({ stats }: { stats: CycleStatistics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTION_HEADINGS.cycleVariation}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          {stats.variabilityHeadline ??
            cycleVariationNotYet(stats.completedCycleCount, MIN_CYCLES_FOR_VARIABILITY)}
        </p>
      </CardContent>
    </Card>
  );
}

function FlowCard({ stats }: { stats: CycleStatistics }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTION_HEADINGS.flowPattern}</CardTitle>
      </CardHeader>
      <CardContent>
        <dl className="text-sm text-foreground">
          <dt className="text-muted-foreground">Heavy-or-higher flow days recorded</dt>
          <dd className="font-medium">{stats.heavyFlowDayCount}</dd>
        </dl>
      </CardContent>
    </Card>
  );
}

function SymptomsCard({ stats }: { stats: CycleStatistics }) {
  const top = selectTopSymptoms(stats.symptomFrequency);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTION_HEADINGS.symptoms}</CardTitle>
      </CardHeader>
      <CardContent>
        <ul className="flex flex-col gap-1">
          {top.map((row) => (
            <li key={row.symptom} className="text-sm text-muted-foreground">
              {symptomFrequencySummary(symptomLabel(row.symptom), row.occurrences, row.knownDays)}
            </li>
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

function PerformanceCard({ performance }: { performance: PerformanceSummary }) {
  const hitRate: HitRateSummary | null = performance.windowHitRate;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{SECTION_HEADINGS.performance}</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="flex flex-col gap-1 text-sm text-muted-foreground">
          {performance.lastSignedErrorDays !== null ? (
            <p>{lastPredictionError(performance.lastSignedErrorDays)}</p>
          ) : null}
          {performance.rollingMedianAbsoluteErrorDays !== null ? (
            <p>{typicalRecentMiss(performance.rollingMedianAbsoluteErrorDays)}</p>
          ) : null}
          {hitRate !== null ? <p>{windowHitRateSummary(hitRate.hits, hitRate.n)}</p> : null}
          {performance.lastSignedErrorDays === null && hitRate === null ? (
            <p>{NOT_ENOUGH_RESOLVED_PREDICTIONS}</p>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

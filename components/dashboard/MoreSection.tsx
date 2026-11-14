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
import type { CycleStatistics, CyclePhase, HitRateSummary, PerformanceSummary } from "@/lib/engine";
import type { FertilityEstimate, HealthMessage, Insight } from "@/lib/domain/types";
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
  /** Today's display phase, or null when it can't be classified. Ignored when
   * `fertility` is absent. */
  phase: CyclePhase | null;
  performance: PerformanceSummary;
  nonUrgentHealthMessages: readonly HealthMessage[];
}

export function MoreSection({
  today,
  stats,
  secondaryInsights,
  fertility,
  phase,
  performance,
  nonUrgentHealthMessages,
}: MoreSectionProps) {
  const [expanded, setExpanded] = useState(false);

  return (
    <Collapsible open={expanded} onOpenChange={setExpanded}>
      <CollapsibleTrigger
        aria-expanded={expanded}
        render={<Button variant="outline" className="group h-chip w-full rounded-full" />}
      >
        <span className="flex-1 text-center">{expanded ? SHOW_LESS_LABEL : SHOW_MORE_LABEL}</span>
        <ChevronDown
          aria-hidden
          data-icon="inline-end"
          className="transition-transform group-data-[panel-open]:rotate-180"
        />
      </CollapsibleTrigger>

      <CollapsibleContent className="mt-stack flex flex-col gap-stack">
        <PeriodDurationCard stats={stats} />
        <CycleVariationCard stats={stats} />
        {stats.heavyFlowDayCount > 0 ? <FlowCard stats={stats} /> : null}
        {selectTopSymptoms(stats.symptomFrequency).length > 0 ? (
          <SymptomsCard stats={stats} />
        ) : null}
        {secondaryInsights.length > 0 ? (
          <div className="flex flex-col gap-stack">
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
        {fertility ? <FertilityCard fertility={fertility} phase={phase} /> : null}
        <PerformanceCard performance={performance} />
        {nonUrgentHealthMessages.length > 0 ? (
          <div className="flex flex-col gap-stack">
            <h2 className="mt-2 text-label text-foreground">
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
    <InfoCard title={SECTION_HEADINGS.periodDuration}>
      <p className="text-label font-normal text-muted-foreground text-pretty">
        {periodDuration !== null
          ? periodDurationSummary(periodDuration.low, periodDuration.high, periodDuration.n)
          : EMPTY_STATES.noCompletedCycles}
      </p>
    </InfoCard>
  );
}

function CycleVariationCard({ stats }: { stats: CycleStatistics }) {
  return (
    <InfoCard title={SECTION_HEADINGS.cycleVariation}>
      <p className="text-label font-normal text-muted-foreground text-pretty">
        {stats.variabilityHeadline ??
          cycleVariationNotYet(stats.completedCycleCount, MIN_CYCLES_FOR_VARIABILITY)}
      </p>
    </InfoCard>
  );
}

function FlowCard({ stats }: { stats: CycleStatistics }) {
  return (
    <InfoCard title={SECTION_HEADINGS.flowPattern}>
      <dl className="flex flex-col gap-1">
        <dt className="text-label font-normal text-muted-foreground">Heavy-or-higher flow days recorded</dt>
        <dd className="text-heading text-card-foreground tabular-nums">{stats.heavyFlowDayCount}</dd>
      </dl>
    </InfoCard>
  );
}

function SymptomsCard({ stats }: { stats: CycleStatistics }) {
  const top = selectTopSymptoms(stats.symptomFrequency);
  return (
    <InfoCard title={SECTION_HEADINGS.symptoms}>
      <ul className="flex flex-col gap-1">
        {top.map((row) => (
          <li key={row.symptom} className="text-label font-normal text-muted-foreground">
            {symptomFrequencySummary(symptomLabel(row.symptom), row.occurrences, row.knownDays)}
          </li>
        ))}
      </ul>
    </InfoCard>
  );
}

function PerformanceCard({ performance }: { performance: PerformanceSummary }) {
  const hitRate: HitRateSummary | null = performance.windowHitRate;
  return (
    <InfoCard title={SECTION_HEADINGS.performance}>
      <div className="flex flex-col gap-1 text-label font-normal text-muted-foreground">
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
    </InfoCard>
  );
}

/** One "read more" panel: the same stage surface and heading as an insight card. */
function InfoCard({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <article className="flex flex-col gap-2 stage p-card">
      <h3 className="text-heading text-card-foreground text-balance">{title}</h3>
      {children}
    </article>
  );
}

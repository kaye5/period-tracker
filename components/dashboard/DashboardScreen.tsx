/**
 * Today (Daylight redesign). Section order, top to bottom:
 *   1. urgent (non-dismissible) health messages — never gated, regardless of data tier
 *   2. hero: date, cycle day, today's phase (when estimated), cycle strip, next-period
 *      range with its confidence — always visibly an estimate (SPEC.md §4.3/R8)
 *   3. week strip (tap a day to log it; "Calendar" opens the month view)
 *   4. quick-log card (one tap = one saved fact, with Undo)
 *   5. a missed-period prompt, if any
 *   6. data-tier notes for 0/1/2 recorded periods
 *   7. one personal-pattern insight, then "More about your cycle"
 *
 * Reads one `EngineResult` built server-side (app/loadCycleView.ts). This component
 * performs no I/O and recomputes nothing the engine owns; it selects and formats what the
 * engine produced (SPEC.md §4.1). The fertility estimate and phase are used only when the
 * feature is enabled and the engine produced them.
 */
import { addDays, diffDays, type CivilDate } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import type { EngineResult } from "@/lib/engine";
import { cyclePhase } from "@/lib/engine";
import { buildWeekStrip, dayLogLookup } from "@/components/calendar/calendarCells";
import { formatFullDayLabel } from "@/components/calendar/civilDateDisplay";
import { buildHeaderStatus, buildNextPeriodCard } from "./cardContent";
import { selectDataTier } from "./dataTier";
import { selectPersonalPatternInsight } from "./insightSelection";
import { EMPTY_TIER, ONE_CYCLE_TIER, TWO_CYCLES_TIER, completedCyclesUsed } from "./copy";
import { formatDateRange } from "./format";
import { buildCycleStrip } from "./cycleStrip";
import { quickPeriodStatus, quickSymptoms } from "@/lib/logging/quickActions";
import { EmptyStateCard } from "./EmptyStateCard";
import { SkipPromptBanner } from "./SkipPromptBanner";
import { PrimaryCard } from "./PrimaryCard";
import { HealthMessageCard } from "./HealthMessageCard";
import { MoreSection } from "./MoreSection";
import { TodayHero } from "./TodayHero";
import { WeekStrip } from "./WeekStrip";
import { QuickLogCard } from "./QuickLogCard";

/** Raw inputs the screens need beyond `EngineResult` (which does not carry raw day logs
 * or the fertility toggle). Supplied by app/loadCycleView.ts. */
export interface DashboardCalendarData {
  dayLogs: DayLog[];
  fertilityEnabled: boolean;
  weekStartsOn: 0 | 1;
  /** Resolved server-side: `stats.periodDuration` when a completed period exists, else
   * the user's own onboarding answer. Drives the "period expected to continue" days. */
  typicalPeriodDays: number | null;
}

export interface DashboardScreenProps {
  output: EngineResult;
  today: CivilDate;
  calendar: DashboardCalendarData;
}

/** Default symptoms offered on Today before the user has any history (Tier A panel,
 * docs/research/02-symptom-insights.md §E.2). */
const DEFAULT_QUICK_SYMPTOMS = ["cramps", "headache", "bloating", "fatigue"] as const;

export function DashboardScreen({ output, today, calendar }: DashboardScreenProps) {
  const tier = selectDataTier(output.cycles);
  const urgentMessages = output.healthMessages.filter((m) => m.severity === "seek_urgent_care");
  const nonUrgentMessages = output.healthMessages.filter((m) => m.severity !== "seek_urgent_care");
  const nextSkipPrompt = output.skipPrompts[0] ?? null;

  const logs = dayLogLookup(calendar.dayLogs);
  const todayLog = logs.get(today);
  const fertility = calendar.fertilityEnabled && "fertility" in output ? (output.fertility ?? null) : null;
  const current = output.cycles.find((c) => c.status === "in_progress") ?? null;
  const phase = current
    ? cyclePhase({
        date: today,
        cycleStart: current.startDate,
        predictedHigh: output.prediction.high,
        fertility,
        isBleeding: todayLog?.bleeding === "menstrual",
      })
    : null;

  const status = buildHeaderStatus({
    prediction: output.prediction,
    cycles: output.cycles,
    typicalCycleLength: output.stats.typicalCycleLength,
    today,
  });
  const nextPeriod = buildNextPeriodCard({ prediction: output.prediction, cycles: output.cycles });
  const { prediction } = output;
  const periodStatus = quickPeriodStatus(todayLog, output.cycles, today);
  const { primary: personalPattern, secondary: secondaryInsights } = selectPersonalPatternInsight(output.insights);

  const weekCells = buildWeekStrip({
    start: addDays(today, -3),
    weekStartsOn: calendar.weekStartsOn,
    today,
    dayLogByDate: logs,
    prediction,
    fertility,
    fertilityEnabled: calendar.fertilityEnabled,
    cycles: output.cycles,
    typicalPeriodDays: calendar.typicalPeriodDays,
    episodes: output.episodes,
  });

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-section px-gutter py-section">
      {urgentMessages.map((message) => (
        <HealthMessageCard key={message.ruleId} message={message} today={today} />
      ))}

      <TodayHero
        dateLabel={formatFullDayLabel(today, weekCells[3].column, calendar.weekStartsOn)}
        cycleDay={current ? diffDays(current.startDate, today) + 1 : null}
        phase={phase}
        periodToday={todayLog?.bleeding === "menstrual"}
        lastPeriodText={status.lastPeriodStartText}
        strip={buildCycleStrip({ cycles: output.cycles, prediction, fertility, today })}
        next={{
          rangeText:
            prediction.low !== null && prediction.high !== null ? formatDateRange(prediction.low, prediction.high) : null,
          fallback: status.headline,
          confidenceLabel: status.confidenceLabel,
          confidenceReason: status.confidenceReason,
          basisText: prediction.basis.usableCycles > 0 ? completedCyclesUsed(prediction.basis.usableCycles) : null,
          typicalRangeText: status.typicalRangeText,
          supportingDates: nextPeriod.supportingDates,
        }}
      />

      <WeekStrip cells={weekCells} weekStartsOn={calendar.weekStartsOn} fertilityEnabled={calendar.fertilityEnabled} />

      <QuickLogCard
        today={today}
        todayLog={todayLog}
        periodStatus={periodStatus}
        lastPeriodDayLog={periodStatus.kind === "ongoing" ? logs.get(periodStatus.lastPeriodDay) : undefined}
        symptoms={quickSymptoms(output.stats.symptomFrequency, DEFAULT_QUICK_SYMPTOMS, 4)}
      />

      {nextSkipPrompt ? <SkipPromptBanner item={nextSkipPrompt} today={today} /> : null}

      {tier === "empty" ? <EmptyStateCard heading={EMPTY_TIER.heading} body={EMPTY_TIER.body} /> : null}
      {tier === "one" ? <EmptyStateCard heading={ONE_CYCLE_TIER.heading} body={ONE_CYCLE_TIER.body} /> : null}
      {tier === "two" ? <EmptyStateCard heading={TWO_CYCLES_TIER.heading} body={TWO_CYCLES_TIER.body} /> : null}

      {tier !== "empty" ? (
        <>
          {personalPattern ? (
            <PrimaryCard
              headline={personalPattern.headline}
              body={personalPattern.body}
              detail={personalPattern.detail}
              supportingDates={personalPattern.supportingDates}
            />
          ) : null}
          <MoreSection
            today={today}
            stats={output.stats}
            secondaryInsights={secondaryInsights}
            fertility={fertility ?? undefined}
            phase={phase}
            performance={output.performance}
            nonUrgentHealthMessages={nonUrgentMessages}
          />
        </>
      ) : null}
    </main>
  );
}

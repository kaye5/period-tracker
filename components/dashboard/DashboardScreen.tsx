/**
 * The dashboard (SPEC.md's U2 brief; PRD §2/§9). Composes:
 *   - a header status card (range, cycle day, last period, typical range, confidence +
 *     reason + cycle count — never a bare date, never a percentage, SPEC.md §4.3/R8),
 *   - at most three primary cards (next period, current status, personal pattern),
 *   - everything else behind a "more" affordance,
 *   - the not-enough-data empty/early states for 0/1/2 recorded periods,
 *   - the fertility card only when `'fertility' in output` (never optional-chained into
 *     a disabled feature), and
 *   - the urgent (non-dismissible) health-awareness banner, shown regardless of tier.
 *
 * Reads one `EngineResult` (a superset of the SPEC.md §3 `EngineOutput` contract) built
 * server-side by `app/page.tsx` — this component performs no I/O and recomputes nothing;
 * it only selects and formats what the engine already produced (SPEC.md §4.1).
 */
import type { CivilDate } from "@/lib/date/civil";
import type { DayLog } from "@/lib/domain/types";
import type { EngineResult } from "@/lib/engine";
import { QuickLog } from "./QuickLog";
import {
  buildCurrentStatusCard,
  buildHeaderStatus,
  buildNextPeriodCard,
} from "./cardContent";
import { selectDataTier } from "./dataTier";
import { selectPersonalPatternInsight } from "./insightSelection";
import { EMPTY_TIER, ONE_CYCLE_TIER, TWO_CYCLES_TIER } from "./copy";
import { DashboardHeader } from "./DashboardHeader";
import { EmptyStateCard } from "./EmptyStateCard";
import { SkipPromptBanner } from "./SkipPromptBanner";
import { HeaderStatusCard } from "./HeaderStatusCard";
import { PrimaryCard } from "./PrimaryCard";
import { HealthMessageCard } from "./HealthMessageCard";
import { MoreSection } from "./MoreSection";

/** The raw inputs the embedded month calendar needs beyond `EngineResult` (which does not
 * carry raw day logs or the fertility toggle). Supplied by `app/page.tsx`, the server
 * component that already fetched them. */
export interface DashboardCalendarData {
  dayLogs: DayLog[];
  fertilityEnabled: boolean;
  weekStartsOn: 0 | 1;
}

export interface DashboardScreenProps {
  output: EngineResult;
  today: CivilDate;
  calendar: DashboardCalendarData;
}

/** The dashboard log surface: the "Log today" button + month calendar, both opening the
 * day log in a dialog (QuickLog / DayLogDialog) rather than navigating — a seamless
 * in-place logging flow. `fertility` is passed only when the feature is enabled and the
 * engine produced an estimate (never optional-chained into a disabled feature). */
function DashboardCalendar({
  output,
  today,
  calendar,
}: {
  output: EngineResult;
  today: CivilDate;
  calendar: DashboardCalendarData;
}) {
  return (
    <QuickLog
      today={today}
      weekStartsOn={calendar.weekStartsOn}
      dayLogs={calendar.dayLogs}
      prediction={output.prediction}
      fertility={
        calendar.fertilityEnabled && "fertility" in output ? output.fertility : null
      }
      fertilityEnabled={calendar.fertilityEnabled}
    />
  );
}

export function DashboardScreen({ output, today, calendar }: DashboardScreenProps) {
  const tier = selectDataTier(output.cycles);
  const urgentMessages = output.healthMessages.filter(
    (m) => m.severity === "seek_urgent_care",
  );
  const nonUrgentMessages = output.healthMessages.filter(
    (m) => m.severity !== "seek_urgent_care",
  );
  const nextSkipPrompt = output.skipPrompts[0] ?? null;

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-4 px-4 py-8">
      <DashboardHeader />

      {/* Urgent health messages are never gated behind "more" and never suppressed by
          data tier — a person with zero recorded cycles can still log a day that fires
          URG-01. */}
      {urgentMessages.map((message) => (
        <HealthMessageCard key={message.ruleId} message={message} today={today} />
      ))}

      {/* Calendar first (user-requested): it is the primary surface for seeing where you
          are in the cycle and for logging, so it leads the dashboard. Rendered once here
          for every data tier, above the status/insight cards. */}
      <DashboardCalendar output={output} today={today} calendar={calendar} />

      {nextSkipPrompt ? <SkipPromptBanner item={nextSkipPrompt} today={today} /> : null}

      {tier === "empty" ? (
        <EmptyStateCard heading={EMPTY_TIER.heading} body={EMPTY_TIER.body} />
      ) : (
        <>
          {tier === "one" ? (
            <EmptyStateCard heading={ONE_CYCLE_TIER.heading} body={ONE_CYCLE_TIER.body} />
          ) : null}
          {tier === "two" ? (
            <EmptyStateCard heading={TWO_CYCLES_TIER.heading} body={TWO_CYCLES_TIER.body} />
          ) : null}

          <HeaderStatusCard
            status={buildHeaderStatus({
              prediction: output.prediction,
              cycles: output.cycles,
              typicalCycleLength: output.stats.typicalCycleLength,
              today,
            })}
          />

          <PrimaryCardsRow output={output} today={today} />

          <MoreSection
            today={today}
            stats={output.stats}
            secondaryInsights={
              selectPersonalPatternInsight(output.insights).secondary
            }
            fertility={"fertility" in output ? output.fertility : undefined}
            performance={output.performance}
            nonUrgentHealthMessages={nonUrgentMessages}
          />
        </>
      )}
    </div>
  );
}

function PrimaryCardsRow({ output, today }: { output: EngineResult; today: CivilDate }) {
  const nextPeriod = buildNextPeriodCard({ prediction: output.prediction, cycles: output.cycles });
  const currentStatus = buildCurrentStatusCard({ cycles: output.cycles, today });
  const { primary: personalPattern } = selectPersonalPatternInsight(output.insights);

  return (
    <div className="grid gap-3 sm:grid-cols-2">
      <PrimaryCard
        headline={nextPeriod.headline}
        body={nextPeriod.body}
        supportingDates={nextPeriod.supportingDates}
      />
      {currentStatus ? (
        <PrimaryCard
          headline={currentStatus.headline}
          body={currentStatus.body}
          supportingDates={currentStatus.supportingDates}
        />
      ) : null}
      {personalPattern ? (
        <PrimaryCard
          headline={personalPattern.headline}
          body={personalPattern.body}
          detail={personalPattern.detail}
          supportingDates={personalPattern.supportingDates}
        />
      ) : null}
    </div>
  );
}

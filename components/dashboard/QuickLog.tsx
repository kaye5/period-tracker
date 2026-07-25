"use client";

/**
 * The dashboard's log surface: a prominent "Log today" button plus the month calendar.
 * Both open the app-wide day-log dialog (DayLogDialogProvider) — tapping any day opens it
 * for that day; the button opens it for today. There is no /log route; logging is always
 * an in-place modal.
 */
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/calendar";
import { civilDateParts } from "@/components/calendar/civilDateDisplay";
import { useDayLog } from "@/components/daylog/DayLogDialogProvider";
import type { CivilDate } from "@/lib/date/civil";
import type {
  DayLog,
  FertilityEstimate,
  PredictionResult,
} from "@/lib/domain/types";

export interface QuickLogProps {
  today: CivilDate;
  weekStartsOn: 0 | 1;
  dayLogs: DayLog[];
  prediction: PredictionResult | null;
  /** Matches Calendar's prop: the engine's fertility estimate is a superset of
   * FertilityEstimate; absent/undefined when the feature is off. */
  fertility?: FertilityEstimate | null;
  fertilityEnabled: boolean;
}

export function QuickLog({
  today,
  weekStartsOn,
  dayLogs,
  prediction,
  fertility,
  fertilityEnabled,
}: QuickLogProps) {
  const { open } = useDayLog();
  const { year, month } = civilDateParts(today);

  return (
    <div className="flex flex-col gap-3">
      <Button size="lg" className="w-full" onClick={() => open(today)}>
        <Plus data-icon="inline-start" aria-hidden />
        Log today
      </Button>

      <Calendar
        year={year}
        month={month}
        weekStartsOn={weekStartsOn}
        today={today}
        dayLogs={dayLogs}
        prediction={prediction}
        fertility={fertility}
        fertilityEnabled={fertilityEnabled}
        onSelectDay={open}
      />
    </div>
  );
}

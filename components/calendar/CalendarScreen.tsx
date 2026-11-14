"use client";

/**
 * The Calendar tab: the month grid on its own screen (Daylight redesign — the month
 * calendar moved off Today, which now carries a week strip). Tapping or keyboard-activating
 * any day opens the app-wide day-log sheet for that day; press-and-drag still marks a run
 * of period days.
 */
import { Calendar } from "./Calendar";
import { civilDateParts } from "./civilDateDisplay";
import { useDayLog } from "@/components/daylog/DayLogDialogProvider";
import type { CivilDate } from "@/lib/date/civil";
import type { EngineResult } from "@/lib/engine";
import type { DashboardCalendarData } from "@/components/dashboard/DashboardScreen";

export interface CalendarScreenProps {
  output: EngineResult;
  today: CivilDate;
  calendar: DashboardCalendarData;
}

export function CalendarScreen({ output, today, calendar }: CalendarScreenProps) {
  const { open } = useDayLog();
  const { year, month } = civilDateParts(today);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-section px-gutter py-section">
      <h1 className="text-title text-foreground">Calendar</h1>
      <Calendar
        year={year}
        month={month}
        weekStartsOn={calendar.weekStartsOn}
        today={today}
        dayLogs={calendar.dayLogs}
        prediction={output.prediction}
        fertility={calendar.fertilityEnabled && "fertility" in output ? output.fertility : null}
        fertilityEnabled={calendar.fertilityEnabled}
        cycles={output.cycles}
        typicalPeriodDays={calendar.typicalPeriodDays}
        episodes={output.episodes}
        onSelectDay={open}
      />
    </main>
  );
}

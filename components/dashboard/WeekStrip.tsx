"use client";

/**
 * Today's week strip: three days either side of today, each tappable to open that day's
 * log. Same per-day classification and accessible labels as the Calendar tab
 * (`buildWeekStrip`), drawn with the shared `DayMark`. A one-line key names the marks
 * that can appear, so the dashed "estimate" ring is never left to interpretation.
 */
import Link from "next/link";
import { ChevronRight, Diamond } from "lucide-react";
import type { CalendarCellData } from "@/components/calendar/calendarCells";
import { DayMark } from "@/components/calendar/DayMark";
import { weekdayNameForColumn } from "@/components/calendar/civilDateDisplay";
import { useDayLog } from "@/components/daylog/DayLogDialogProvider";
import { cn } from "@/lib/utils";

export function WeekStrip({
  cells,
  weekStartsOn,
  fertilityEnabled,
}: {
  cells: CalendarCellData[];
  weekStartsOn: 0 | 1;
  fertilityEnabled: boolean;
}) {
  const { open } = useDayLog();

  return (
    <section aria-labelledby="week-strip-title" className="flex flex-col gap-stack stage p-card">
      <div className="flex items-center justify-between">
        <h2 id="week-strip-title" className="text-label text-muted-foreground">
          This week
        </h2>
        <Link
          href="/calendar"
          className="-mr-2 inline-flex min-h-11 items-center gap-0.5 rounded-lg px-2 text-label text-foreground hover:bg-muted"
        >
          Calendar
          <ChevronRight aria-hidden className="size-4" />
        </Link>
      </div>

      <ol className="grid grid-cols-7">
        {cells.map((cell) => (
          <li key={cell.date} className="flex justify-center">
            <button
              type="button"
              aria-label={cell.accessibleLabel}
              aria-current={cell.indicators.isToday ? "date" : undefined}
              onClick={() => open(cell.date)}
              className="flex min-w-11 flex-col items-center gap-1.5 rounded-xl py-1.5 transition-colors hover:bg-muted"
            >
              <span
                aria-hidden
                className={cn(
                  "text-caption",
                  cell.indicators.isToday ? "font-bold text-foreground" : "text-muted-foreground",
                )}
              >
                {weekdayNameForColumn(cell.column, weekStartsOn, true)}
              </span>
              <DayMark indicators={cell.indicators} dayNumber={cell.dayNumber} />
            </button>
          </li>
        ))}
      </ol>

      <ul aria-label="Key" className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <KeyItem mark={<span className="size-3 rounded-full bg-phase-menstrual" />} label="Period" />
        <KeyItem
          mark={<span className="size-3 rounded-full border-2 border-dashed border-phase-menstrual" />}
          label="Estimate"
        />
        {fertilityEnabled ? (
          <>
            <KeyItem mark={<span className="h-1 w-3 rounded-full bg-phase-fertile" />} label="Fertile (est.)" />
            <KeyItem
              mark={<Diamond className="size-2.5 fill-phase-fertile text-phase-fertile" />}
              label="Ovulation (est.)"
            />
          </>
        ) : null}
        <KeyItem mark={<span className="size-2 rounded-full bg-muted-foreground" />} label="Symptoms or notes" />
      </ul>
    </section>
  );
}

function KeyItem({ mark, label }: { mark: React.ReactNode; label: string }) {
  return (
    <li className="flex items-center gap-1.5">
      <span aria-hidden className="flex w-3 items-center justify-center">
        {mark}
      </span>
      {label}
    </li>
  );
}

"use client";

/**
 * The month-grid calendar (SPEC.md U3 brief: "Month grid, drag-select for consecutive
 * period days, tap to open the day log, full legend, recorded-vs-predicted visual
 * distinction per §4.2, keyboard operation per §4.5"). Prop-driven and fetches nothing
 * for reads — the caller (a server component) hands down the day logs and the relevant
 * slice of `EngineOutput` it already computed; this component's only I/O is the
 * WRITE side of the drag-select flow (POST app/api/day-logs, then router.refresh()),
 * exactly the pattern every other interactive client component in this build follows.
 *
 * The real per-day rendering decisions live in `dayIndicators.ts` (what's true about a
 * day) and `calendarCells.ts` (assembling a month's worth of that, plus the accessible
 * label §4.2 requires) — both plain, tested functions. This file is the thin,
 * necessarily-untested-directly layer on top: grid layout, month navigation, roving
 * keyboard focus, and wiring the drag gesture to a confirmation step before it writes
 * anything.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { addDays, type CivilDate } from "@/lib/date/civil";
import type { DayLog, FertilityEstimate, PredictionResult } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Sheet,
  SheetContent,
  SheetFooter,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
import { Legend, type LegendItem } from "@/components/ui/Legend";
import { DayCell } from "./DayCell";
import { buildCalendarWeeks, dayLogLookup } from "./calendarCells";
import { civilDateParts, formatMonthYearLabel, weekdayNameForColumn } from "./civilDateDisplay";
import {
  IconCheck,
  IconDropletOutlineDashed,
  IconDropletSolid,
  IconLeaf,
  IconNoteMark,
  IconPeriodEnd,
  IconPeriodStart,
  IconSpottingMark,
  IconStar,
} from "./icons";
import { buildQuickPeriodDayLogs, formatDragRangeLabel, isDateWithinDragRange } from "./quickPeriodLog";
import { useDragSelect, type DragRange } from "./useDragSelect";

export interface CalendarProps {
  /** Initial displayed month. Navigating with the prev/next controls (or arrow-key
   * focus crossing a month boundary) only changes local UI state — it never refetches,
   * since prediction/fertility apply uniformly regardless of which month is on screen
   * and every day log the grid could possibly need is already in `dayLogs`. */
  year: number;
  month: number; // 1-indexed
  weekStartsOn: 0 | 1;
  today: CivilDate;
  dayLogs: DayLog[];
  prediction: PredictionResult | null;
  fertility?: FertilityEstimate | null;
  fertilityEnabled: boolean;
  /** Tapping/activating a day calls this. Logging is always an in-place dialog (there is
   * no /log route), so callers wire this to `useDayLog().open`. */
  onSelectDay: (date: CivilDate) => void;
}

const SWATCH_RECORDED_PERIOD = "bg-primary";
const SWATCH_RECORDED_SPOTTING = "bg-primary/60";

export function Calendar({
  year,
  month,
  weekStartsOn,
  today,
  dayLogs,
  prediction,
  fertility,
  fertilityEnabled,
  onSelectDay,
}: CalendarProps) {
  const router = useRouter();
  const [displayYear, setDisplayYear] = useState(year);
  const [displayMonth, setDisplayMonth] = useState(month);
  const [focusedDate, setFocusedDate] = useState<CivilDate>(today);
  const pendingFocusRef = useRef<CivilDate | null>(null);
  const cellRefs = useRef(new Map<CivilDate, HTMLButtonElement>());

  const [pendingRange, setPendingRange] = useState<DragRange | null>(null);
  const [committing, setCommitting] = useState(false);
  const [commitError, setCommitError] = useState<string | null>(null);

  const dayLogByDate = useMemo(() => dayLogLookup(dayLogs), [dayLogs]);

  const weeks = useMemo(
    () =>
      buildCalendarWeeks({
        year: displayYear,
        month: displayMonth,
        weekStartsOn,
        today,
        dayLogByDate,
        prediction,
        fertility,
        fertilityEnabled,
      }),
    [displayYear, displayMonth, weekStartsOn, today, dayLogByDate, prediction, fertility, fertilityEnabled],
  );

  // Keep the roving-tabindex target inside the currently-displayed grid. When a
  // keyboard move crossed a month boundary (moveFocusTo below), pendingFocusRef names
  // exactly which cell to move real DOM focus to once its <DayCell> exists.
  useEffect(() => {
    const flatCells = weeks.flat();
    const flatDates = new Set(flatCells.map((c) => c.date));
    const target = pendingFocusRef.current;
    if (target && flatDates.has(target)) {
      pendingFocusRef.current = null;
      cellRefs.current.get(target)?.focus();
      setFocusedDate(target);
      return;
    }
    setFocusedDate((prev) => {
      if (flatDates.has(prev)) return prev;
      if (flatDates.has(today)) return today;
      return flatCells[0].date;
    });
  }, [weeks, today]);

  const registerRef = useCallback((date: CivilDate, el: HTMLButtonElement | null) => {
    if (el) cellRefs.current.set(date, el);
    else cellRefs.current.delete(date);
  }, []);

  function openDay(date: CivilDate) {
    onSelectDay(date);
  }

  function moveFocusTo(date: CivilDate) {
    const inGrid = weeks.some((week) => week.some((cell) => cell.date === date));
    if (inGrid) {
      setFocusedDate(date);
      cellRefs.current.get(date)?.focus();
      return;
    }
    const { year: y, month: m } = civilDateParts(date);
    pendingFocusRef.current = date;
    setDisplayYear(y);
    setDisplayMonth(m);
  }

  function handleKeyNavigate(date: CivilDate, key: string) {
    if (key === "Enter" || key === " ") {
      openDay(date);
      return;
    }
    if (key === "Home" || key === "End") {
      const row = weeks.find((week) => week.some((cell) => cell.date === date));
      if (!row) return;
      moveFocusTo(key === "Home" ? row[0].date : row[row.length - 1].date);
      return;
    }
    const delta =
      key === "ArrowLeft" ? -1 : key === "ArrowRight" ? 1 : key === "ArrowUp" ? -7 : key === "ArrowDown" ? 7 : 0;
    if (delta === 0) return;
    moveFocusTo(addDays(date, delta));
  }

  function shiftMonth(delta: number) {
    const zeroBased = displayMonth - 1 + delta;
    const newYear = displayYear + Math.floor(zeroBased / 12);
    const newMonth = ((zeroBased % 12) + 12) % 12 + 1;
    setDisplayYear(newYear);
    setDisplayMonth(newMonth);
  }

  function goToday() {
    const { year: y, month: m } = civilDateParts(today);
    setDisplayYear(y);
    setDisplayMonth(m);
  }

  // --- drag-select -> quick period log -------------------------------------------
  const drag = useDragSelect();

  useEffect(() => {
    // Attached once, unconditionally (see useDragSelect.ts's own doc comment): reading
    // drag.resolve() here rather than relying on ordering against the hook's internal
    // document listener is what makes a plain tap-and-release reliably fall through to
    // the cell's own onClick instead of ever being mistaken for a one-day drag.
    function onPointerUp() {
      const range = drag.resolve();
      if (range) setPendingRange(range);
    }
    document.addEventListener("pointerup", onPointerUp);
    return () => document.removeEventListener("pointerup", onPointerUp);
  }, [drag]);

  const highlightRange = drag.previewRange ?? pendingRange;

  async function handleConfirmRange() {
    if (!pendingRange) return;
    setCommitting(true);
    setCommitError(null);
    try {
      const payloads = buildQuickPeriodDayLogs(pendingRange, today, dayLogByDate);
      for (const payload of payloads) {
        const res = await fetch("/api/day-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        });
        if (!res.ok) throw new Error("Could not save these days. Please try again.");
      }
      setPendingRange(null);
      router.refresh();
    } catch (err) {
      setCommitError(err instanceof Error ? err.message : "Could not save these days.");
    } finally {
      setCommitting(false);
    }
  }

  function handleCancelRange() {
    if (committing) return;
    setPendingRange(null);
    setCommitError(null);
  }

  const columns = [0, 1, 2, 3, 4, 5, 6];

  return (
    <div className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <div className="flex flex-col items-center">
          <h2 className="text-base font-semibold text-foreground" aria-live="polite">
            {formatMonthYearLabel(displayYear, displayMonth)}
          </h2>
          <button
            type="button"
            onClick={goToday}
            className="text-xs font-medium text-primary underline underline-offset-2 hover:no-underline"
          >
            Today
          </button>
        </div>
        <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
          <ChevronRight aria-hidden="true" />
        </Button>
      </div>

      <div
        role="grid"
        aria-label={`Calendar, ${formatMonthYearLabel(displayYear, displayMonth)}`}
        className="flex flex-col gap-2.5"
      >
        <div role="row" className="mb-1 grid grid-cols-7 gap-1">
          {columns.map((col) => (
            <div
              key={col}
              role="columnheader"
              className="flex h-6 items-center justify-center text-xs font-medium text-muted-foreground"
            >
              {weekdayNameForColumn(col, weekStartsOn, true)}
            </div>
          ))}
        </div>

        {weeks.map((week, weekIndex) => (
          <div role="row" key={weekIndex} className="grid grid-cols-7 place-items-center gap-1">
            {week.map((cell) => (
              <DayCell
                key={cell.date}
                date={cell.date}
                dayNumber={cell.dayNumber}
                inCurrentMonth={cell.inCurrentMonth}
                indicators={cell.indicators}
                accessibleLabel={cell.accessibleLabel}
                isFocusTarget={cell.date === focusedDate}
                isPendingSelection={isDateWithinDragRange(cell.date, highlightRange)}
                onActivate={openDay}
                onFocused={setFocusedDate}
                onKeyNavigate={handleKeyNavigate}
                onPointerDownCell={drag.beginAt}
                registerRef={registerRef}
              />
            ))}
          </div>
        ))}
      </div>

      <p className="text-xs text-muted-foreground">
        Press and drag across days to mark several as a period at once.
      </p>

      <CalendarLegend fertilityEnabled={fertilityEnabled} fertility={fertility} />

      <Sheet
        open={pendingRange != null}
        onOpenChange={(open) => {
          if (!open) handleCancelRange();
        }}
      >
        <SheetContent side="bottom">
          <SheetHeader>
            <SheetTitle>Confirm period days</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-2 px-4">
            <p className="text-sm text-foreground">{pendingRange ? formatDragRangeLabel(pendingRange) : ""}</p>
            {commitError ? (
              <Alert variant="destructive">
                <AlertDescription>{commitError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <SheetFooter className="flex-row justify-end gap-2">
            <Button variant="ghost" onClick={handleCancelRange} disabled={committing}>
              Cancel
            </Button>
            <Button variant="default" onClick={handleConfirmRange} disabled={committing}>
              {committing ? "Saving…" : "Mark as period"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** Only reference for what every glyph/fill on the grid means (SPEC.md §4.2: colour
 * never carries meaning alone, so the legend pairs a swatch with the same icon and text
 * fragment `describeDayIndicators` puts in each cell's accessible name). Fertility rows
 * only render when enabled, and the calendar-estimate disclaimer sits directly beneath
 * them — never behind a link (SPEC.md: fertility UI "always with its disclaimer
 * adjacent"). */
function CalendarLegend({
  fertilityEnabled,
  fertility,
}: {
  fertilityEnabled: boolean;
  fertility: FertilityEstimate | null | undefined;
}) {
  const items: LegendItem[] = [
    {
      icon: <span aria-hidden className="inline-block size-3 rounded-full ring-2 ring-today" />,
      label: "Today",
    },
    {
      swatchClassName: SWATCH_RECORDED_PERIOD,
      icon: <IconDropletSolid className="h-3 w-3 text-primary-foreground" />,
      label: "Period recorded",
    },
    {
      icon: <IconPeriodStart className="h-3 w-3 text-primary" />,
      label: "Period — first day",
      description: "The start of a period run.",
    },
    {
      icon: <IconPeriodEnd className="h-3 w-3 text-primary" />,
      label: "Period — last day",
      description: "The end of a period run. Mark this in the day log to close the period.",
    },
    {
      swatchClassName: SWATCH_RECORDED_SPOTTING,
      icon: <IconSpottingMark className="h-3 w-3" />,
      label: "Spotting recorded",
      description: "Tracked separately — never counted as the start of a period.",
    },
    {
      icon: <IconDropletOutlineDashed className="h-3 w-3 text-primary" />,
      label: "Predicted period range",
      description: "An estimate, shown with a dashed outline and no fill.",
    },
  ];

  if (fertilityEnabled) {
    items.push(
      {
        icon: <IconLeaf className="h-3 w-3 text-chart-3" />,
        label: "Estimated fertile window",
      },
      {
        icon: <IconStar className="h-3 w-3 text-chart-3" />,
        label: "Estimated ovulation range",
      },
    );
  }

  items.push(
    {
      icon: <IconNoteMark className="h-2.5 w-2.5" />,
      label: "Symptoms or notes logged",
    },
    {
      icon: <IconCheck className="h-2.5 w-2.5" />,
      label: "Nothing to report logged",
    },
  );

  return (
    <div className="flex flex-col gap-2">
      {/* The legend is reference info, so it collapses to keep the calendar uncluttered
          (starts minimised). The fertility disclaimer is deliberately kept OUTSIDE the
          collapsible — SPEC.md requires it to stay adjacent to the fertile-window markers,
          never hidden behind a toggle. */}
      <Collapsible className="rounded-xl border border-border bg-muted/50">
        <CollapsibleTrigger
          render={
            <Button
              variant="ghost"
              className="group h-11 w-full justify-between rounded-xl px-4 text-sm font-medium text-foreground hover:bg-transparent"
            />
          }
        >
          Calendar legend
          <ChevronDown
            aria-hidden
            data-icon="inline-end"
            className="text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="px-4 pb-4">
          <Legend label="Calendar legend" items={items} />
        </CollapsibleContent>
      </Collapsible>
      {fertilityEnabled && fertility ? (
        <p className="rounded-xl border border-border bg-muted/50 p-3 text-xs text-muted-foreground">
          {fertility.disclaimer}
        </p>
      ) : null}
    </div>
  );
}

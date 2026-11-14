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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode, type Ref } from "react";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useIsPresent, type Variants } from "motion/react";
import { Check, ChevronLeft, ChevronRight, Diamond } from "lucide-react";
import { addDays, type CivilDate } from "@/lib/date/civil";
import type {
  BleedingEpisode,
  Cycle,
  DayLog,
  FertilityEstimate,
  PredictionResult,
} from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Alert, AlertDescription } from "@/components/ui/alert";
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
  /** Engine cycles (most-recent-first, `EngineOutput.cycles`) — only used to locate
   * which cycle's start date a day falls in, for the estimated phase in each day's
   * accessible label (no longer drawn on the grid; phase lives on Today's cycle strip). */
  cycles?: Cycle[];
  /** `EngineOutput.stats.periodDuration` — the user's own typical period length. Drives
   * the "period expected to continue" days on an ongoing period. */
  typicalPeriodDays?: number | null;
  /** `EngineOutput.episodes` — authority for period start/end badges. */
  episodes?: BleedingEpisode[];
  /** Tapping/activating a day calls this. Logging is always an in-place dialog (there is
   * no /log route), so callers wire this to `useDayLog().open`. */
  onSelectDay: (date: CivilDate) => void;
}

export function Calendar({
  year,
  month,
  weekStartsOn,
  today,
  dayLogs,
  prediction,
  fertility,
  fertilityEnabled,
  cycles,
  typicalPeriodDays,
  episodes,
  onSelectDay,
}: CalendarProps) {
  const router = useRouter();
  const [displayYear, setDisplayYear] = useState(year);
  const [displayMonth, setDisplayMonth] = useState(month);
  /** Sign of the last month change (-1 back, 1 forward): which way the grid slides. */
  const [direction, setDirection] = useState(0);
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
        cycles,
        typicalPeriodDays,
        episodes,
      }),
    [displayYear, displayMonth, weekStartsOn, today, dayLogByDate, prediction, fertility, fertilityEnabled, cycles, typicalPeriodDays, episodes],
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

  // During the month slide the outgoing and incoming grids are both mounted and can share
  // dates (leading/trailing days), so a cell only unregisters itself if it is still the
  // registered element — the outgoing grid unmounting must not drop the incoming cell.
  const registerRef = useCallback((date: CivilDate, el: HTMLButtonElement) => {
    cellRefs.current.set(date, el);
    return () => {
      if (cellRefs.current.get(date) === el) cellRefs.current.delete(date);
    };
  }, []);

  function showMonth(y: number, m: number) {
    setDirection(Math.sign(y * 12 + m - (displayYear * 12 + displayMonth)));
    setDisplayYear(y);
    setDisplayMonth(m);
  }

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
    showMonth(y, m);
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
    showMonth(newYear, newMonth);
  }

  function goToday() {
    const { year: y, month: m } = civilDateParts(today);
    showMonth(y, m);
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
    <div className="stage flex flex-col gap-stack p-card">
      {/* One row: the arrows, the month label and "Today". "Today" stays ENABLED on
          today's own month: `goToday` is idempotent there, and disabling it dropped
          keyboard focus to <body> the instant it was activated (Base UI renders a real
          `disabled` attribute, removing the focused element from the tab order), besides
          hiding the control's existence from anyone tabbing the header on the current
          month. */}
      <div className="-mx-2 flex items-center justify-between gap-1">
        <Button
          variant="ghost"
          size="icon"
          className="rounded-full"
          aria-label="Previous month"
          onClick={() => shiftMonth(-1)}
        >
          <ChevronLeft aria-hidden="true" className="size-5" />
        </Button>
        <h2 className="text-heading text-foreground tabular-nums" aria-live="polite">
          {formatMonthYearLabel(displayYear, displayMonth)}
        </h2>
        <div className="flex items-center gap-1">
          <Button variant="ghost" className="rounded-full px-3 text-label" onClick={goToday}>
            Today
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="rounded-full"
            aria-label="Next month"
            onClick={() => shiftMonth(1)}
          >
            <ChevronRight aria-hidden="true" className="size-5" />
          </Button>
        </div>
      </div>

      {/* Touch: the grid supports drag-selection (DayCell's onPointerDown), so native
          text selection must not compete with it. On iOS Safari and Android Chrome a
          drag across day numbers otherwise starts a text selection, and an iOS long
          press raises the callout/magnifier. `select-none` emits both the -webkit- and
          unprefixed user-select; `touch-callout` is iOS-only; `touch-action-manipulation`
          drops the 300ms double-tap-zoom delay on taps. DayCell is a raw <button>, so it
          does NOT inherit the `select-none` that components/ui/button.tsx carries.
          `relative` anchors the outgoing month while it slides out (popLayout). */}
      <div
        role="grid"
        aria-label={`Calendar, ${formatMonthYearLabel(displayYear, displayMonth)}`}
        className="relative -mx-2 flex touch-manipulation flex-col gap-1 select-none [-webkit-touch-callout:none]"
      >
        <div role="row" className="grid grid-cols-7">
          {columns.map((col) => (
            <div
              key={col}
              role="columnheader"
              className="flex h-6 items-center justify-center text-caption text-muted-foreground"
            >
              {weekdayNameForColumn(col, weekStartsOn, true)}
            </div>
          ))}
        </div>

        <AnimatePresence mode="popLayout" initial={false} custom={direction}>
          <MonthRows key={`${displayYear}-${displayMonth}`} direction={direction}>
            {weeks.map((week, weekIndex) => (
              <div role="row" key={weekIndex} className="grid grid-cols-7 place-items-center">
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
          </MonthRows>
        </AnimatePresence>
      </div>

      <CalendarLegend fertilityEnabled={fertilityEnabled} />

      <p className="text-caption text-muted-foreground">Drag across several days to mark a period.</p>

      {fertilityEnabled && fertility ? (
        <p className="rounded-xl bg-muted px-3 py-2.5 text-caption text-muted-foreground">{fertility.disclaimer}</p>
      ) : null}

      <Sheet
        open={pendingRange != null}
        onOpenChange={(open) => {
          if (!open) handleCancelRange();
        }}
      >
        <SheetContent
          side="bottom"
          className="mx-auto w-full max-w-lg gap-stack rounded-t-stage px-gutter pt-section pb-section shadow-float"
        >
          <SheetHeader className="p-0 pr-12">
            <SheetTitle className="text-heading">Confirm period days</SheetTitle>
          </SheetHeader>
          <div className="flex flex-col gap-stack">
            <p className="text-body text-foreground">{pendingRange ? formatDragRangeLabel(pendingRange) : ""}</p>
            {commitError ? (
              <Alert variant="destructive">
                <AlertDescription>{commitError}</AlertDescription>
              </Alert>
            ) : null}
          </div>
          <SheetFooter className="mt-2 flex-row justify-end gap-2 p-0">
            <Button variant="ghost" className="rounded-full px-5" onClick={handleCancelRange} disabled={committing}>
              Cancel
            </Button>
            <Button className="rounded-full px-5" onClick={handleConfirmRange} disabled={committing}>
              {committing ? "Saving…" : "Mark as period"}
            </Button>
          </SheetFooter>
        </SheetContent>
      </Sheet>
    </div>
  );
}

/** The month change slides the grid ~16px in the direction of travel with a fade (brief
 * §4: orientation). MotionConfig reducedMotion="user" (global) drops the slide. */
const slide: Variants = {
  enter: (direction: number) => ({ x: direction * 16, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction: number) => ({ x: direction * -16, opacity: 0 }),
};

/** One month's rows. While it slides out it is `inert`, so the outgoing copy can neither
 * take a tap nor be reached by keyboard or assistive tech. */
function MonthRows({
  direction,
  children,
  ref,
}: {
  direction: number;
  children: ReactNode;
  ref?: Ref<HTMLDivElement>;
}) {
  const isPresent = useIsPresent();
  return (
    <motion.div
      ref={ref}
      role="rowgroup"
      custom={direction}
      variants={slide}
      initial="enter"
      animate="center"
      exit="exit"
      transition={{ duration: 0.2, ease: "easeOut" }}
      inert={!isPresent}
      className="flex flex-col gap-1"
    >
      {children}
    </motion.div>
  );
}

/** Mini versions of the marks `DayMark` draws (the same shapes as Today's week-strip key),
 * so the key shows what is actually on the grid. Every estimate says so in words. */
const mark = {
  period: <span className="size-3 rounded-full bg-phase-menstrual" />,
  spotting: (
    <span className="flex size-3 items-center justify-center rounded-full border-2 border-phase-menstrual">
      <span className="size-0.5 rounded-full bg-phase-menstrual" />
    </span>
  ),
  predicted: <span className="size-3 rounded-full border-2 border-dashed border-phase-menstrual" />,
  expected: <span className="size-3 rounded-full border-2 border-dotted border-phase-menstrual" />,
  fertile: <span className="h-1 w-3 rounded-full bg-phase-fertile" />,
  ovulation: <Diamond className="size-2.5 fill-phase-fertile text-phase-fertile" />,
  today: <span className="size-2 rounded-full ring-2 ring-today ring-offset-1 ring-offset-card" />,
  notes: <span className="size-2 rounded-full bg-muted-foreground" />,
  nothing: <Check className="size-3 text-muted-foreground" strokeWidth={3} />,
};

/** Always-visible key for every mark the grid can draw (SPEC.md §4.2: the shape and a word
 * for each, never colour alone). Fertility marks appear only when the feature is on. */
function CalendarLegend({ fertilityEnabled }: { fertilityEnabled: boolean }) {
  const items: LegendItem[] = [
    { icon: mark.period, label: "Period" },
    { icon: mark.spotting, label: "Spotting" },
    { icon: mark.predicted, label: "Next period (estimate)" },
    { icon: mark.expected, label: "Period continuing (estimate)" },
    ...(fertilityEnabled
      ? [
          { icon: mark.fertile, label: "Fertile window (estimate)" },
          { icon: mark.ovulation, label: "Ovulation (estimate)" },
        ]
      : []),
    { icon: mark.today, label: "Today" },
    { icon: mark.notes, label: "Symptoms or notes" },
    { icon: mark.nothing, label: "Nothing to report" },
  ];
  return <Legend inline label="Calendar key" items={items} />;
}

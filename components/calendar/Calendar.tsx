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
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
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
  IconFollicularUnderline,
  IconLutealUnderline,
  IconNoteMark,
  IconPeriodContinues,
  IconPeriodEnd,
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
  /** Engine cycles (most-recent-first, `EngineOutput.cycles`) — only used to locate
   * which cycle's start date a day falls in, for the estimated-phase underline. Optional;
   * omitted just means no phase shading is shown. */
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
      {/* One row, not two: the month label and "Today" sit on the same line as the arrows.
          "Today" was a 16px-tall underlined text link — below SPEC.md §4.5's 44px minimum
          target — and is now a real button. It stays ENABLED on today's own month:
          `goToday` is idempotent there, and disabling it dropped keyboard focus to
          <body> the instant it was activated (Base UI renders a real `disabled`
          attribute, removing the focused element from the tab order), besides hiding the
          control's existence from anyone tabbing the header on the current month. */}
      <div className="flex items-center justify-between gap-1">
        <Button variant="ghost" size="icon" aria-label="Previous month" onClick={() => shiftMonth(-1)}>
          <ChevronLeft aria-hidden="true" />
        </Button>
        <h2 className="text-base font-semibold text-foreground" aria-live="polite">
          {formatMonthYearLabel(displayYear, displayMonth)}
        </h2>
        <div className="flex items-center gap-0.5">
          <Button variant="ghost" className="px-3" onClick={goToday}>
            Today
          </Button>
          <Button variant="ghost" size="icon" aria-label="Next month" onClick={() => shiftMonth(1)}>
            <ChevronRight aria-hidden="true" />
          </Button>
        </div>
      </div>

      {/* Touch: the grid supports drag-selection (DayCell's onPointerDown), so native
          text selection must not compete with it. On iOS Safari and Android Chrome a
          drag across day numbers otherwise starts a text selection, and an iOS long
          press raises the callout/magnifier. `select-none` emits both the -webkit- and
          unprefixed user-select; `touch-callout` is iOS-only; `touch-action-manipulation`
          drops the 300ms double-tap-zoom delay on taps. DayCell is a raw <button>, so it
          does NOT inherit the `select-none` that components/ui/button.tsx carries. */}
      <div
        role="grid"
        aria-label={`Calendar, ${formatMonthYearLabel(displayYear, displayMonth)}`}
        className="flex touch-manipulation flex-col gap-2.5 select-none [-webkit-touch-callout:none]"
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

      <p className="text-xs text-muted-foreground">Drag across several days to mark a period.</p>

      <CalendarLegend
        fertilityEnabled={fertilityEnabled}
        fertility={fertility}
        hasCycles={(cycles?.length ?? 0) > 0}
      />

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

/** A miniature of a real day cell — same fill, same outline style, same glyph — so a
 * legend row shows what is actually on the grid instead of an abstract colour swatch. */
function CellSample({ className, children }: { className?: string; children?: ReactNode }) {
  return (
    <span
      aria-hidden="true"
      className={`flex size-4 shrink-0 items-center justify-center rounded-full ${className ?? ""}`}
    >
      {children}
    </span>
  );
}

/** The only reference for what every glyph/fill on the grid means (SPEC.md §4.2: colour
 * never carries meaning alone, so each row pairs the cell's own appearance with the same
 * text fragment `describeDayIndicators` puts in the accessible name).
 *
 * Grouped into short sections with the shared fact in the heading ("Expected — outlined,
 * never filled"), which is what let most of the paragraph-long per-row descriptions go:
 * this was one flat list of thirteen rows, i.e. a reference manual rather than a legend.
 * Merged rows cover markers that only ever make sense as a pair (the two phase
 * underlines; the two day-log marks). Fertility rows still only render when the feature
 * is enabled, and the estimate disclaimer stays OUTSIDE the collapsible, adjacent to them
 * — never behind a toggle. */
function CalendarLegend({
  fertilityEnabled,
  fertility,
  hasCycles,
}: {
  fertilityEnabled: boolean;
  fertility: FertilityEstimate | null | undefined;
  /** Whether the grid was given cycles — phase markers cannot render without them. */
  hasCycles: boolean;
}) {
  const sections: { title: string; items: LegendItem[] }[] = [
    {
      title: "Recorded — solid fill",
      items: [
        {
          icon: (
            <CellSample className="bg-primary">
              <IconDropletSolid className="size-2.5 text-primary-foreground" />
            </CellSample>
          ),
          label: "Period",
        },
        {
          icon: (
            <CellSample className="bg-primary/60">
              <IconSpottingMark className="size-2.5 text-primary-foreground" />
            </CellSample>
          ),
          label: "Spotting",
          description: "Never counted as the start of a period.",
        },
        {
          icon: <IconPeriodEnd className="size-3 text-primary" />,
          label: "Last day of a period",
          description: "Mark it in the day log to close the period.",
        },
      ],
    },
    {
      title: "Expected — outlined, never filled",
      items: [
        {
          icon: (
            <CellSample className="border border-dashed border-primary">
              <IconDropletOutlineDashed className="size-2.5 text-primary" />
            </CellSample>
          ),
          label: "Next period, predicted",
          description: "Dashed. The dates it could start between are on the next-period card.",
        },
        {
          icon: (
            <CellSample className="border border-dotted border-primary">
              <IconPeriodContinues className="size-2.5 text-primary" />
            </CellSample>
          ),
          label: "This period, expected to continue",
          description: "Dotted, and only as long as your own typical period.",
        },
      ],
    },
  ];

  if (fertilityEnabled) {
    sections.push({
      title: "Estimated",
      items: [
        {
          icon: <CellSample className="border-2 border-dashed border-chart-3" />,
          label: "Fertile window",
        },
        { icon: <IconStar className="size-3 text-chart-3" />, label: "Ovulation" },
        // The phase row needs `cycles` as well: without them every day's phase is null,
        // and a legend must never advertise a marker that cannot appear on the grid.
        ...(hasCycles
          ? [
              {
                icon: (
                  <>
                    <IconFollicularUnderline className="size-3 text-chart-4" />
                    <IconLutealUnderline className="size-3 text-chart-5" />
                  </>
                ),
                label: "Phase, underlined",
                description: "Dashed before ovulation (follicular), solid after (luteal).",
              },
            ]
          : []),
      ],
    });
  }

  sections.push({
    title: "Other marks",
    items: [
      { icon: <CellSample className="ring-2 ring-today" />, label: "Today" },
      {
        icon: (
          <>
            <IconNoteMark className="size-3 text-muted-foreground" />
            <IconCheck className="size-3 text-muted-foreground" />
          </>
        ),
        label: "Symptoms or notes logged, or nothing to report",
      },
    ],
  });

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
          What the marks mean
          <ChevronDown
            aria-hidden
            data-icon="inline-end"
            className="text-muted-foreground transition-transform group-data-[panel-open]:rotate-180"
          />
        </CollapsibleTrigger>
        <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4">
          {sections.map((section) => (
            <div key={section.title} className="flex flex-col gap-2">
              {/* A real heading, and the list below deliberately has NO aria-label: the
                  heading already names it, and doing both made every section announce
                  its title twice. */}
              <h3 className="text-xs font-semibold text-muted-foreground">{section.title}</h3>
              <Legend items={section.items} />
            </div>
          ))}
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

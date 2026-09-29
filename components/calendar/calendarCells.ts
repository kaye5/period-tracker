/**
 * Assembles one month's worth of calendar cell data from `lib/date/civil.ts`'s
 * `monthGrid` plus this directory's `computeDayIndicators`/`describeDayIndicators`.
 * Kept free of React (SPEC.md R10 / this codebase's convention of factoring real logic
 * into testable helpers) so Calendar.tsx itself only has to map this output onto
 * `<DayCell>` — everything about *what* a day should show, including the accessible
 * text label SPEC.md §4.2 requires, is decided here and is directly testable.
 */
import { addDays, monthGrid, type CivilDate } from "@/lib/date/civil";
import type {
  BleedingEpisode,
  Cycle,
  DayLog,
  FertilityEstimate,
  PredictionResult,
} from "@/lib/domain/types";
import { civilDateParts, formatFullDayLabel } from "./civilDateDisplay";
import {
  computeDayIndicators,
  describeDayIndicators,
  expectedPeriodRange,
  predictedPeriodRange,
  type DayIndicators,
} from "./dayIndicators";

export interface CalendarCellData {
  date: CivilDate;
  dayNumber: number;
  /** 0..6 within its week row, per `weekStartsOn`. */
  column: number;
  inCurrentMonth: boolean;
  indicators: DayIndicators;
  /** SPEC.md §4.2: "a text label in the accessible name" — every cell has one,
   * including days with nothing recorded or predicted ("no records"), so a screen
   * reader user is never left with silence where a sighted user sees a blank day. */
  accessibleLabel: string;
}

/** `dayLogs` array -> lookup by date, the shape `buildCalendarWeeks` and the
 * drag-select quick-log flow both want. A plain function (not a hook) so it's just as
 * usable from a test as from a component. */
export function dayLogLookup(dayLogs: readonly DayLog[]): Map<CivilDate, DayLog> {
  const map = new Map<CivilDate, DayLog>();
  for (const log of dayLogs) map.set(log.date, log);
  return map;
}

export interface BuildCalendarWeeksInput {
  year: number;
  month: number; // 1-indexed
  weekStartsOn: 0 | 1;
  today: CivilDate;
  dayLogByDate: ReadonlyMap<CivilDate, DayLog>;
  prediction: PredictionResult | null | undefined;
  fertility: FertilityEstimate | null | undefined;
  fertilityEnabled: boolean;
  /** Engine cycles (most-recent-first) — only used to find which cycle's start date a
   * given day falls in, for phase display. Optional; omitted means no phase shading. */
  cycles?: readonly Cycle[];
  /** The user's typical period length, used to show an ongoing period's expected
   * remaining days instead of closing it early. Omitted means no expectation shown. */
  typicalPeriodDays?: number | null;
  /** `EngineOutput.episodes` — authority for period start/end badges. */
  episodes?: readonly BleedingEpisode[];
}

export function buildCalendarWeeks(input: BuildCalendarWeeksInput): CalendarCellData[][] {
  const { year, month, weekStartsOn, today, dayLogByDate, prediction, fertility, fertilityEnabled, cycles, typicalPeriodDays, episodes } = input;
  const weeks = monthGrid(year, month, weekStartsOn);
  const expectedPeriod = expectedPeriodRange(cycles ?? [], typicalPeriodDays, today);
  // The predicted period on the grid is the predicted BLEEDING SPAN, never
  // `prediction.low..high` (that band is start-date uncertainty and dashed half the
  // month) — see `predictedPeriodRange`.
  const predictedPeriod = predictedPeriodRange(prediction, typicalPeriodDays, today);

  return weeks.map((week) =>
    week.map((date, column) => {
      const { day, month: dateMonth } = civilDateParts(date);
      // Neighbours are looked up from the full day-log map (not just the visible month),
      // so a period run that crosses a month boundary still gets its start/end right.
      const indicators = computeDayIndicators({
        date,
        today,
        dayLog: dayLogByDate.get(date) ?? null,
        previousBleeding: dayLogByDate.get(addDays(date, -1))?.bleeding ?? "none",
        // NO `?? "none"` fallback: undefined means "that day has no log", which is not
        // the same as "logged as not bleeding" and must not close the period.
        nextBleeding: dayLogByDate.get(addDays(date, 1))?.bleeding,
        prediction,
        fertility,
        fertilityEnabled,
        cycles,
        expectedPeriod,
        predictedPeriod,
        episodes,
      });
      const fragments = describeDayIndicators(indicators);
      const accessibleLabel = `${formatFullDayLabel(date, column, weekStartsOn)}. ${fragments.join(", ")}.`;

      return {
        date,
        dayNumber: day,
        column,
        inCurrentMonth: dateMonth === month,
        indicators,
        accessibleLabel,
      };
    }),
  );
}

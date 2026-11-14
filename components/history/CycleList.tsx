import type { CivilDate } from "@/lib/date/civil";
import type { Cycle, StatSummary } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { pluralize } from "@/components/charts/format";
import { applyDateFilter, buildCycleRowViewModels, type CycleRowViewModel } from "@/components/history/cycleListData";
import { cycleBarDays, cycleBarScale, toPct, type CycleBarDays } from "@/components/history/cycleBar";
import { EditPeriodSheet } from "@/components/history/EditPeriodSheet";
import { ExcludeCycleControl } from "@/components/history/ExcludeCycleControl";

export interface CycleListProps {
  cycles: readonly Cycle[];
  highlightedDates: readonly CivilDate[];
  today: CivilDate;
  /** The engine's typical cycle length — its centre is the bars' "Avg" marker. */
  typicalCycleLength: StatSummary | null;
}

// Status is always spelled out in the badge text; the badge shape is a second,
// non-colour cue (dashed = uncertain, outline = set aside by you).
const STATUS_BADGE_CLASS: Record<Cycle["status"], string> = {
  ok: "border-border text-muted-foreground",
  gap_unknown: "bg-warning text-warning-foreground",
  skip_suspected: "bg-warning text-warning-foreground",
  excluded_by_user: "border-dashed border-border-strong text-muted-foreground",
  in_progress: "border-dashed border-border-strong text-card-foreground",
};

/**
 * One cycle as a horizontal bar (Flo cycle-length pattern): length proportional to the
 * cycle, the period part in the period colour, the rest neutral. Status never rests on
 * colour: gap / possible-missed cycles are hatched with a dashed edge, an excluded cycle
 * is an empty outline, and the in-progress cycle stops at today with its remaining days
 * up to the typical length hatched as an estimate. Decorative — the row's text carries
 * the same dates, length and status.
 */
function CycleBar({
  status,
  bar,
  scale,
  avgPct,
}: {
  status: Cycle["status"];
  bar: CycleBarDays;
  scale: number;
  avgPct: number | null;
}) {
  const total = bar.days + bar.estimateDays;
  const uncertain = status === "gap_unknown" || status === "skip_suspected";
  const excluded = status === "excluded_by_user";
  return (
    <div aria-hidden className="relative h-5">
      <div
        className={cn(
          "absolute inset-y-1 left-0 flex overflow-hidden rounded-full",
          uncertain && "outline-1 outline-offset-1 outline-dashed outline-foreground",
          excluded && "border border-border-strong",
        )}
        style={{ width: `${toPct(total, scale)}%` }}
      >
        <span
          className={cn("h-full", excluded ? "bg-muted" : "bg-phase-menstrual")}
          style={{ width: `${toPct(bar.periodDays, total)}%` }}
        />
        <span
          className={cn("h-full", excluded ? "bg-transparent" : "bg-border-strong", uncertain && "hatch-estimate")}
          style={{ width: `${toPct(bar.days - bar.periodDays, total)}%` }}
        />
        {bar.estimateDays > 0 ? (
          <span className="h-full flex-1 bg-border-strong hatch-estimate opacity-60" />
        ) : null}
      </div>
      {avgPct !== null ? (
        <span className="absolute inset-y-0 w-0.5 -translate-x-1/2 rounded-full bg-foreground" style={{ left: `${avgPct}%` }} />
      ) : null}
    </div>
  );
}

function CycleRow({
  row,
  bar,
  scale,
  avgPct,
}: {
  row: CycleRowViewModel;
  bar: CycleBarDays;
  scale: number;
  avgPct: number | null;
}) {
  const { cycle } = row;
  const excluded = cycle.status === "excluded_by_user";
  return (
    <li
      className={cn(
        "flex flex-col gap-2 py-4",
        row.isHighlighted && "-mx-3 rounded-xl bg-muted px-3 ring-1 ring-border-strong",
      )}
    >
      <div className={cn("flex flex-wrap items-baseline justify-between gap-x-3 gap-y-0.5", excluded && "opacity-70")}>
        <p className="text-label text-card-foreground tabular-nums">{row.dateRangeText}</p>
        <p className="text-label font-normal text-muted-foreground tabular-nums">{row.lengthText}</p>
      </div>
      <CycleBar status={cycle.status} bar={bar} scale={scale} avgPct={avgPct} />
      <div className="flex flex-col items-start gap-1">
        <Badge variant="outline" className={cn("h-6 text-caption", STATUS_BADGE_CLASS[cycle.status])}>
          {row.statusLabel}
        </Badge>
        {/* The engine's own statusReason, restated verbatim — stays visible even for
         * excluded/anomalous rows, never dropped (SPEC.md R7). */}
        {row.statusReason ? (
          <p className="text-caption text-muted-foreground tabular-nums text-pretty">{row.statusReason}</p>
        ) : null}
      </div>
      <div className="-mx-3 flex flex-wrap gap-1">
        <EditPeriodSheet episode={cycle.episode} />
        {cycle.status !== "in_progress" ? (
          <ExcludeCycleControl cycleStartDate={cycle.startDate} excluded={cycle.status === "excluded_by_user"} />
        ) : null}
      </div>
    </li>
  );
}

/**
 * The cycle history list (SPEC.md's U4 brief: "Cycles the engine marked gap_unknown /
 * skip_suspected / excluded appear in the list WITH their statusReason — never silently
 * dropped"). Honors the `?dates=` highlight/filter contract documented in
 * `components/dashboard/links.ts`'s `historyHref`. Each row is a per-cycle bar on one
 * shared scale with the typical length marked (Daylight brief, "Insights").
 */
export function CycleList({ cycles, highlightedDates, today, typicalCycleLength }: CycleListProps) {
  const allRows = buildCycleRowViewModels(cycles, highlightedDates);
  const { rows, filtered } = applyDateFilter(allRows, highlightedDates);

  if (rows.length === 0) {
    return (
      <section className="flex flex-col gap-2 stage p-card">
        <h2 className="text-heading text-card-foreground">Your cycles</h2>
        <p className="text-label font-normal text-muted-foreground">
          Your cycle history will appear here once you&apos;ve recorded a period.
        </p>
      </section>
    );
  }

  const typical = typicalCycleLength?.center ?? null;
  const bars = rows.map((row) => cycleBarDays(row.cycle, today, typical));
  const scale = cycleBarScale(bars, typical);
  const avgPct = typical !== null ? toPct(typical, scale) : null;
  const hasEstimate = bars.some((b) => b.estimateDays > 0);

  return (
    <section className="flex flex-col gap-stack stage p-card">
      <div className="flex flex-col gap-1">
        <h2 className="text-heading text-card-foreground">Your cycles</h2>
        <p className="text-label font-normal text-muted-foreground tabular-nums">
          {rows.length} {pluralize(rows.length, "cycle")} recorded
        </p>
      </div>

      <ul aria-label="Bar key" className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-4 rounded-full bg-phase-menstrual" />
          Period
        </li>
        <li className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-4 rounded-full bg-border-strong" />
          Rest of cycle
        </li>
        {typical !== null ? (
          <li className="flex items-center gap-1.5 tabular-nums">
            <span aria-hidden className="h-3.5 w-0.5 rounded-full bg-foreground" />
            Avg {Math.round(typical)} days
          </li>
        ) : null}
        {hasEstimate ? (
          <li className="flex items-center gap-1.5">
            <span aria-hidden className="h-2.5 w-4 rounded-full bg-border-strong opacity-60 hatch-estimate" />
            Estimate
          </li>
        ) : null}
      </ul>

      {filtered ? (
        <p className="text-label font-normal text-muted-foreground">
          Showing only the cycle(s) linked from elsewhere in the app.{" "}
          <a href="/history" className="font-medium text-foreground underline underline-offset-4">
            Show all cycles
          </a>
        </p>
      ) : null}

      <div>
        {avgPct !== null ? (
          <div aria-hidden className="relative h-5 text-caption text-muted-foreground tabular-nums">
            <span
              className="absolute bottom-0 whitespace-nowrap"
              style={{ left: `${avgPct}%`, transform: `translateX(-${avgPct}%)` }}
            >
              Avg
            </span>
          </div>
        ) : null}
        <ul className="divide-y divide-border">
          {rows.map((row, i) => (
            <CycleRow key={row.key} row={row} bar={bars[i]} scale={scale} avgPct={avgPct} />
          ))}
        </ul>
      </div>
    </section>
  );
}

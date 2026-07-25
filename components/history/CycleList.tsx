import type { CivilDate } from "@/lib/date/civil";
import type { Cycle } from "@/lib/domain/types";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { pluralize } from "@/components/charts/format";
import { applyDateFilter, buildCycleRowViewModels, type CycleRowViewModel } from "@/components/history/cycleListData";
import { EditPeriodSheet } from "@/components/history/EditPeriodSheet";
import { ExcludeCycleControl } from "@/components/history/ExcludeCycleControl";

export interface CycleListProps {
  cycles: readonly Cycle[];
  highlightedDates: readonly CivilDate[];
}

const STATUS_BADGE_CLASS: Record<Cycle["status"], string> = {
  ok: "bg-secondary text-secondary-foreground",
  gap_unknown: "bg-warning text-warning-foreground",
  skip_suspected: "bg-warning text-warning-foreground",
  excluded_by_user: "bg-secondary text-muted-foreground",
  in_progress: "bg-secondary text-secondary-foreground",
};

function CycleRow({ row }: { row: CycleRowViewModel }) {
  const { cycle } = row;
  const excluded = cycle.status === "excluded_by_user";
  return (
    <li
      className={cn(
        "flex flex-wrap items-center justify-between gap-3 py-3",
        row.isHighlighted && "-mx-3 rounded-lg bg-primary/5 px-3 ring-1 ring-primary/40",
      )}
    >
      <div className={cn("flex flex-col gap-0.5", excluded && "opacity-70")}>
        <p className="text-sm font-medium text-foreground">{row.dateRangeText}</p>
        <p className="text-sm text-muted-foreground">{row.lengthText}</p>
        {/* The engine's own statusReason, restated verbatim — stays visible even for
         * excluded/anomalous rows, never dropped (SPEC.md R7). */}
        {row.statusReason ? <p className="text-xs text-muted-foreground">{row.statusReason}</p> : null}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Badge className={STATUS_BADGE_CLASS[cycle.status]}>{row.statusLabel}</Badge>
        <div className="flex flex-wrap gap-1">
          <EditPeriodSheet episode={cycle.episode} />
          {cycle.status !== "in_progress" ? (
            <ExcludeCycleControl cycleStartDate={cycle.startDate} excluded={cycle.status === "excluded_by_user"} />
          ) : null}
        </div>
      </div>
    </li>
  );
}

/**
 * The cycle history list (SPEC.md's U4 brief: "Cycles the engine marked gap_unknown /
 * skip_suspected / excluded appear in the list WITH their statusReason — never silently
 * dropped"). Honors the `?dates=` highlight/filter contract documented in
 * `components/dashboard/links.ts`'s `historyHref`. Redesigned per the History-page
 * spec's B2: one Card with a divide-y row list instead of a card per cycle.
 */
export function CycleList({ cycles, highlightedDates }: CycleListProps) {
  const allRows = buildCycleRowViewModels(cycles, highlightedDates);
  const { rows, filtered } = applyDateFilter(allRows, highlightedDates);

  if (rows.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your cycles</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Your cycle history will appear here once you&apos;ve recorded a period.
          </p>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your cycles</CardTitle>
        <CardDescription>
          {rows.length} {pluralize(rows.length, "cycle")} recorded
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {filtered ? (
          <p className="text-sm text-muted-foreground">
            Showing only the cycle(s) linked from elsewhere in the app.{" "}
            <a href="/history" className="font-medium text-primary underline">
              Show all cycles
            </a>
          </p>
        ) : null}
        <ul className="divide-y divide-border">
          {rows.map((row) => (
            <CycleRow key={row.key} row={row} />
          ))}
        </ul>
      </CardContent>
    </Card>
  );
}

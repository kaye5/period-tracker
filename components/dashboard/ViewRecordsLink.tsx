"use client";

import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { CivilDate } from "@/lib/date/civil";
import { useDayLog } from "@/components/daylog/DayLogDialogProvider";
import { cn } from "@/lib/utils";
import { historyHref } from "./links";
import { VIEW_RECORDS_LABEL } from "./copy";

/**
 * "View the records behind this" — every claim that rests on recorded days carries one (an
 * insight without visible supporting records fails the PRD's acceptance criteria). A
 * single supporting date opens that day's log in the app-wide sheet; several dates go to
 * the history list scoped to them. Renders nothing when there is no evidence to show.
 */
export function ViewRecordsLink({
  supportingDates,
  className,
}: {
  supportingDates: readonly CivilDate[];
  className?: string;
}) {
  const { open } = useDayLog();
  if (supportingDates.length === 0) return null;
  const classes = cn("h-11 px-0 text-label", className);

  return supportingDates.length === 1 ? (
    <Button variant="link" className={classes} onClick={() => open(supportingDates[0])}>
      {VIEW_RECORDS_LABEL}
    </Button>
  ) : (
    <Button variant="link" className={classes} nativeButton={false} render={<Link href={historyHref(supportingDates)} />}>
      {VIEW_RECORDS_LABEL}
    </Button>
  );
}

"use client";

import Link from "next/link";
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import type { CivilDate } from "@/lib/date/civil";
import { historyHref } from "./links";
import { VIEW_RECORDS_LABEL } from "./copy";
import { useDayLog } from "@/components/daylog/DayLogDialogProvider";

export interface PrimaryCardProps {
  headline: string;
  body: string;
  /** Extra supporting detail (e.g. `Insight.detail`'s counts). Omitted for the two
   * prediction-derived cards, which fold everything into `body`. */
  detail?: string;
  supportingDates: readonly CivilDate[];
}

/**
 * One of the dashboard's "at most three primary cards" (next period / current status /
 * personal pattern). Every card that claims evidence carries a "view the records behind
 * this" control (never shown without it — an insight without visible supporting records
 * fails the PRD's acceptance criteria). A single supporting date opens that day's log in
 * the app-wide dialog; several dates go to the history list scoped to them.
 */
export function PrimaryCard({ headline, body, detail, supportingDates }: PrimaryCardProps) {
  const { open } = useDayLog();
  const singleDate = supportingDates.length === 1 ? supportingDates[0] : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle>{headline}</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-1">
        <p className="text-sm text-muted-foreground">{body}</p>
        {detail ? <p className="text-sm text-muted-foreground">{detail}</p> : null}
      </CardContent>
      {supportingDates.length > 0 ? (
        <CardFooter>
          {singleDate ? (
            <Button
              variant="link"
              className="h-11 px-0 text-sm"
              onClick={() => open(singleDate)}
            >
              {VIEW_RECORDS_LABEL}
            </Button>
          ) : (
            <Button
              variant="link"
              className="h-11 px-0 text-sm"
              render={<Link href={historyHref(supportingDates)} />}
            >
              {VIEW_RECORDS_LABEL}
            </Button>
          )}
        </CardFooter>
      ) : null}
    </Card>
  );
}

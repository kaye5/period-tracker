import type { CivilDate } from "@/lib/date/civil";
import { ViewRecordsLink } from "./ViewRecordsLink";

export interface PrimaryCardProps {
  headline: string;
  body: string;
  /** Extra supporting detail (e.g. `Insight.detail`'s counts). */
  detail?: string;
  supportingDates: readonly CivilDate[];
}

/**
 * An insight on Today (and in "More about your cycle"): a plain-sentence headline, its
 * explanation and counts, and the "view the records behind this" control — never shown
 * without it when the claim rests on recorded days.
 */
export function PrimaryCard({ headline, body, detail, supportingDates }: PrimaryCardProps) {
  return (
    <article className="flex flex-col gap-2 stage p-card">
      <h3 className="text-heading text-card-foreground text-balance">{headline}</h3>
      <p className="text-label font-normal text-muted-foreground text-pretty">{body}</p>
      {detail ? <p className="text-label font-normal whitespace-pre-line text-muted-foreground">{detail}</p> : null}
      <ViewRecordsLink supportingDates={supportingDates} className="self-start" />
    </article>
  );
}

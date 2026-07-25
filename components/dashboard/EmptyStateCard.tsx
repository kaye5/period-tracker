import { Empty, EmptyHeader, EmptyTitle, EmptyDescription } from "@/components/ui/empty";

export interface EmptyStateCardProps {
  heading: string;
  body: string;
}

/** Renders one of `./copy.ts`'s `EMPTY_TIER` / `ONE_CYCLE_TIER` / `TWO_CYCLES_TIER`
 * objects (this agent's brief: "honest empty/early states for 0, 1, and 2 completed
 * cycles"). A plain presentational wrapper — the wording itself is entirely
 * `./copy.ts`'s, never invented here. */
export function EmptyStateCard({ heading, body }: EmptyStateCardProps) {
  return (
    <Empty className="items-start rounded-xl border border-dashed border-primary/40 bg-muted/40 p-4 text-left">
      <EmptyHeader className="items-start gap-1 text-left">
        <EmptyTitle className="text-base font-semibold text-foreground">{heading}</EmptyTitle>
        <EmptyDescription>{body}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

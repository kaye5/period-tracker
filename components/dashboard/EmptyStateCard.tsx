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
    <Empty className="items-start gap-0 stage p-card text-left">
      <EmptyHeader className="max-w-none items-start gap-1 text-left">
        <EmptyTitle className="text-heading text-foreground">{heading}</EmptyTitle>
        <EmptyDescription className="text-pretty">{body}</EmptyDescription>
      </EmptyHeader>
    </Empty>
  );
}

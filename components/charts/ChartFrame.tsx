import type { ReactNode } from "react";
import { ChevronDownIcon, ChevronUpIcon } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";

export interface ChartFrameProps {
  title: string;
  /** Optional one-line reading hint shown under the title (SPEC: "add optional
   * description line (CardDescription) for the reading hint"). Purely presentational —
   * never a substitute for `summary`. */
  description?: string;
  /** One-sentence description read by the chart's `role="img"` label — SPEC.md §4.5's
   * "text alternative ... for screen readers" requirement, satisfied independently of
   * the data table below. */
  summary: string;
  /** The chart body — a Recharts `ChartContainer` tree (SPEC.md §0 superseding note:
   * shadcn/ui chart + recharts). */
  children: ReactNode;
  /** Column headers for the accessible data-table alternative. */
  columns: string[];
  /** Table rows, same column order as `columns`. */
  rows: (string | number)[][];
  emptyMessage?: string;
  /** Optional legend, rendered inside the card between the plot and the data-table
   * disclosure — and only when there is data, so an empty state never shows a legend
   * for marks that aren't drawn. */
  legend?: ReactNode;
}

/**
 * Shared chart shell for every chart in `components/charts/`: a horizontally-scrolling
 * container so a wide chart scrolls within itself rather than the page body (SPEC.md's
 * U4 brief: "Wide charts scroll inside their own container; the page body never scrolls
 * horizontally"), plus a disclosed `<table>` that is always the *same data* as the
 * chart — the "text alternative or data table for screen readers" every chart needs.
 * Using a real, always-in-the-DOM table (rather than visually-hidden text) means sighted
 * keyboard/low-vision users get the same alternative as screen-reader users.
 */
export function ChartFrame({ title, description, summary, children, columns, rows, emptyMessage, legend }: ChartFrameProps) {
  const hasData = rows.length > 0;
  if (!hasData) {
    return (
      <figure className="m-0 flex flex-col gap-2">
        <figcaption className="text-sm font-medium text-foreground">{title}</figcaption>
        <p className="text-sm text-muted-foreground">{emptyMessage ?? "Nothing to show yet."}</p>
      </figure>
    );
  }
  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-2">
        <div role="img" aria-label={summary} className="overflow-x-auto">
          {children}
        </div>
        {legend}
        <Collapsible>
          <CollapsibleTrigger className="group/chart-trigger flex items-center gap-1 py-1 text-left text-sm text-muted-foreground outline-none hover:text-foreground focus-visible:text-foreground">
            View as data table
            <ChevronDownIcon className="size-3.5 shrink-0 group-aria-expanded/chart-trigger:hidden" />
            <ChevronUpIcon className="hidden size-3.5 shrink-0 group-aria-expanded/chart-trigger:inline" />
          </CollapsibleTrigger>
          <CollapsibleContent>
            <div className="overflow-x-auto pt-2">
              <table className="w-full min-w-max border-collapse text-left text-xs">
                <caption className="sr-only">{title}</caption>
                <thead>
                  <tr>
                    {columns.map((col) => (
                      <th key={col} scope="col" className="border-b border-border px-2 py-1 font-medium text-foreground">
                        {col}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, i) => (
                    <tr key={i}>
                      {row.map((cell, j) => (
                        <td key={j} className="border-b border-border px-2 py-1 text-foreground">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  );
}

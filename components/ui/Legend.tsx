import type { ReactNode } from "react";
import { cn } from "@/lib/utils";

export interface LegendItem {
  /** Decorative swatch (a small coloured shape). Always paired with `icon` and/or
   * `label` by the caller — SPEC.md §4.2: colour alone never carries meaning. */
  swatchClassName?: string;
  /** A non-colour indicator (glyph, pattern) shown alongside the swatch. */
  icon?: ReactNode;
  label: string;
  description?: string;
}

export interface LegendProps {
  items: LegendItem[];
  /** Accessible name for the list, e.g. "Calendar legend". Omit when a visible heading
   * immediately precedes the list and already names it — passing it anyway makes a
   * screen reader announce the same words twice, once for the heading and once for the
   * list. */
  label?: string;
  /** Compact key: items wrap on one line at caption size (descriptions still render,
   * after the label). Default is a stacked list. */
  inline?: boolean;
}

/**
 * Primitive legend: a labelled list of {swatch, icon, label} entries. Generic on
 * purpose — calendar-specific colours/icons (recorded vs predicted days, flow levels)
 * are supplied by the caller, not hard-coded here.
 */
export function Legend({ items, label, inline = false }: LegendProps) {
  return (
    <ul
      aria-label={label}
      className={cn(
        inline
          ? "flex flex-wrap gap-x-4 gap-y-2 text-caption text-muted-foreground"
          : "flex flex-col gap-2 text-label font-normal text-foreground",
      )}
    >
      {items.map((item, index) => (
        <li key={index} className={cn("flex gap-2", inline ? "items-center gap-1.5" : "items-start")}>
          <span
            className={cn(
              "flex min-w-3 shrink-0 items-center justify-center gap-1",
              inline ? "h-3" : "mt-0.5 h-4 min-w-4",
            )}
          >
            {item.swatchClassName ? (
              <span aria-hidden="true" className={cn("inline-block size-3 rounded-sm", item.swatchClassName)} />
            ) : null}
            {/* `gap-1` on the inner span too: a row may pass two glyphs in a fragment,
                and those land inside THIS span, where the outer gap cannot reach them —
                they rendered flush and read as one marker. */}
            {item.icon ? (
              <span aria-hidden="true" className="flex items-center gap-1">
                {item.icon}
              </span>
            ) : null}
          </span>
          <span>
            <span className={inline ? undefined : "font-medium"}>{item.label}</span>
            {item.description ? (
              <span className={cn("text-muted-foreground", inline ? "ml-1" : "block")}>{item.description}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

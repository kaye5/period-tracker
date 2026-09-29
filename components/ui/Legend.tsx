import type { ReactNode } from "react";

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
}

/**
 * Primitive legend: a labelled list of {swatch, icon, label} entries. Generic on
 * purpose — calendar-specific colours/icons (recorded vs predicted days, flow levels)
 * are supplied by components/calendar/ (agent U3), not hard-coded here.
 */
export function Legend({ items, label }: LegendProps) {
  return (
    <ul aria-label={label} className="flex flex-col gap-2">
      {items.map((item, index) => (
        <li key={index} className="flex items-start gap-2 text-sm text-foreground">
          <span className="mt-0.5 flex h-4 min-w-4 shrink-0 items-center justify-center gap-1">
            {item.swatchClassName ? (
              <span
                aria-hidden="true"
                className={["inline-block h-3 w-3 rounded-full", item.swatchClassName].join(" ")}
              />
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
            <span className="font-medium">{item.label}</span>
            {item.description ? (
              <span className="block text-muted-foreground">{item.description}</span>
            ) : null}
          </span>
        </li>
      ))}
    </ul>
  );
}

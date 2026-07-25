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
  /** Accessible name for the list, e.g. "Calendar legend". */
  label: string;
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
          <span className="mt-0.5 flex h-4 w-4 shrink-0 items-center justify-center">
            {item.swatchClassName ? (
              <span
                aria-hidden="true"
                className={["inline-block h-3 w-3 rounded-full", item.swatchClassName].join(" ")}
              />
            ) : null}
            {item.icon ? (
              <span aria-hidden="true" className="flex items-center">
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

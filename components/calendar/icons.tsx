/**
 * Small decorative SVG glyphs for the calendar. Every one of these is `aria-hidden` —
 * SPEC.md §4.2 requires a *text label in the accessible name* to carry meaning; these
 * icons are the accompanying non-colour visual cue for sighted users, never the sole
 * carrier (that job belongs to `describeDayIndicators` in dayIndicators.ts, consumed as
 * the day cell's aria-label).
 */
import type { SVGProps } from "react";

type IconProps = SVGProps<SVGSVGElement>;

/** Solid droplet — recorded menstrual bleeding. */
export function IconDropletSolid({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <path
        d="M12 2C12 2 5 11.2 5 15.5 5 19.6 8.1 22 12 22s7-2.4 7-6.5C19 11.2 12 2 12 2Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** A right-pointing triangle — the FIRST day of a recorded period run (a "start" cue,
 * like a play/begin marker). Distinct silhouette from the end square below so start vs.
 * end is never a position- or colour-only distinction. */
export function IconPeriodStart({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <path d="M7 4 L19 12 L7 20 Z" fill="currentColor" />
    </svg>
  );
}

/** A filled square — the LAST day of a recorded period run (an "end"/stop cue). */
export function IconPeriodEnd({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <rect x="5" y="5" width="14" height="14" rx="2" fill="currentColor" />
    </svg>
  );
}

/** Dashed, unfilled droplet outline — predicted period, never a solid fill (SPEC.md
 * §4.2: "predicted days use a dashed outline with NO fill"). */
export function IconDropletOutlineDashed({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <path
        d="M12 2C12 2 5 11.2 5 15.5 5 19.6 8.1 22 12 22s7-2.4 7-6.5C19 11.2 12 2 12 2Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeDasharray="2.5 2"
      />
    </svg>
  );
}

/** A small filled ring with a hollow centre — recorded spotting. Deliberately a
 * different silhouette from the droplet (not just a smaller/lighter version of it), so
 * spotting vs. a period is never a colour-only or size-only distinction. */
export function IconSpottingMark({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <circle cx="12" cy="12" r="6" fill="none" stroke="currentColor" strokeWidth="3" />
    </svg>
  );
}

/** Leaf — estimated fertile window. */
export function IconLeaf({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <path
        d="M20 4C10 4 4 10 4 19c9 0 15-6 15-15Z"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.75"
        strokeDasharray="2.5 2"
      />
      <path d="M6.5 17.5 18 6" stroke="currentColor" strokeWidth="1.5" strokeDasharray="1.5 1.5" />
    </svg>
  );
}

/** Star — estimated ovulation range. */
export function IconStar({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <path
        d="M12 3.5 14.2 9.3 20.5 9.8 15.7 13.8 17.2 20 12 16.6 6.8 20 8.3 13.8 3.5 9.8 9.8 9.3Z"
        fill="currentColor"
      />
    </svg>
  );
}

/** Small filled square — a day has symptoms, mood, pain, or notes recorded. Distinct
 * silhouette from every bleeding glyph on purpose. */
export function IconNoteMark({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <rect x="8" y="8" width="8" height="8" rx="1.5" fill="currentColor" />
    </svg>
  );
}

/** Checkmark — a "nothing to report" true-negative entry. */
export function IconCheck({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <path
        d="M4 12.5 9.5 18 20 6"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.25"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

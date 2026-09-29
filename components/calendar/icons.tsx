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

/** A filled square — the LAST day of a recorded period run (an "end"/stop cue). The
 * only period-boundary glyph: the first day of a run needs no badge, since it is simply
 * the first filled cell. */
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

/** Double chevron — "the period is expected to CONTINUE here". Deliberately NOT another
 * droplet: this used to reuse `IconDropletOutlineDashed`, which made an expected
 * continuation of the period you are having indistinguishable from a prediction of the
 * next period a month away. Stroke-only (no fill, §4.2), so it never reads as one of the
 * solid recorded-day glyphs. */
export function IconPeriodContinues({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <path
        d="M5 5 L12 12 L5 19 M13 5 L20 12 L13 19"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.75"
        strokeLinecap="round"
        strokeLinejoin="round"
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

/** Three ruled lines — a day has symptoms, mood, pain, or notes recorded. Was an 8x8
 * square inside a 24-unit box, which rendered as a ~3px dot and shared its silhouette
 * with `IconPeriodEnd`; ruled lines fill the glyph box and read as "written down" at the
 * 12px this is actually drawn at. */
export function IconNoteMark({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      {/* Two rules, not three, at stroke 2.5 with 6.5 units of clear space between them:
          three 3-wide strokes across 24 units left barely a stroke-width of gap, so at the
          12px this is actually drawn the lines merged into a solid block indistinguishable
          from the square period-end badge. A backing plate keeps it legible where it
          overlaps the today ring or the dashed fertile ring. */}
      <circle cx="12" cy="12" r="11" fill="var(--card)" />
      <path
        d="M6 9.5h12M6 16h7"
        fill="none"
        stroke="currentColor"
        strokeWidth="2.5"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Dashed underline swatch — estimated follicular phase. Mirrors the dashed bar
 * `DayCell` draws along a follicular day's bottom edge, so the legend glyph matches
 * what's actually on the grid. */
export function IconFollicularUnderline({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <line
        x1="2"
        y1="18"
        x2="22"
        y2="18"
        stroke="currentColor"
        strokeWidth="3"
        strokeDasharray="8 4"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Solid underline swatch — estimated luteal phase. Distinct line STYLE (solid vs.
 * dashed), not just colour, from `IconFollicularUnderline` (SPEC.md §4.2). */
export function IconLutealUnderline({ className, ...rest }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true" focusable="false" {...rest}>
      <line x1="2" y1="18" x2="22" y2="18" stroke="currentColor" strokeWidth="3" strokeLinecap="round" />
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

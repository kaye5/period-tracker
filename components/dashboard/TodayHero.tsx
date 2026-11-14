/**
 * Today's hero: the date, the cycle day, today's phase (only when the engine estimates
 * one), the cycle strip, and the next-period range. Every prediction here is visibly an
 * estimate — an "Estimate" badge with a dashed edge, the confidence label and its reason,
 * and hatching on the predicted part of the strip — and the range is always a range,
 * never a single date (SPEC.md R8/§4.3).
 */
import type { CivilDate } from "@/lib/date/civil";
import type { CyclePhase } from "@/lib/engine";
import { PHASE_LABELS } from "@/lib/copy/general";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { CycleStripData, StripDayKind } from "./cycleStrip";
import { CrossfadeText } from "./CrossfadeText";
import { ViewRecordsLink } from "./ViewRecordsLink";

export interface TodayHeroProps {
  /** "Saturday, November 14, 2026". */
  dateLabel: string;
  /** 1-based day of the in-progress cycle; null before any period is recorded. */
  cycleDay: number | null;
  phase: CyclePhase | null;
  /** Today is recorded as a period day (shown even when no phase estimate exists). */
  periodToday: boolean;
  lastPeriodText: string | null;
  strip: CycleStripData | null;
  next: {
    /** "November 26 – December 2", or null when no range can be shown yet. */
    rangeText: string | null;
    /** Why there is no range (only used when `rangeText` is null). */
    fallback: string;
    confidenceLabel: string;
    confidenceReason: string;
    basisText: string | null;
    typicalRangeText: string | null;
    supportingDates: readonly CivilDate[];
  };
}

const PHASE_PILL: Record<CyclePhase, string> = {
  menstrual: "bg-phase-menstrual text-phase-menstrual-foreground",
  follicular: "bg-phase-follicular-wash text-phase-follicular-wash-foreground",
  ovulatory: "bg-phase-fertile-wash text-phase-fertile-wash-foreground",
  luteal: "bg-phase-luteal-wash text-phase-luteal-wash-foreground",
};

// The strip is a thin bar, so phases use their mark colours (half-strength for the two
// long phases) rather than the pale washes, which vanish against a dark card.
const STRIP_FILL: Record<StripDayKind, string> = {
  menstrual: "bg-phase-menstrual",
  follicular: "bg-phase-follicular/50",
  ovulatory: "bg-phase-fertile",
  luteal: "bg-phase-luteal/50",
  unknown: "bg-muted",
};

export function TodayHero({ dateLabel, cycleDay, phase, periodToday, lastPeriodText, strip, next }: TodayHeroProps) {
  const pill = phase ?? (periodToday ? "menstrual" : null);

  return (
    <section aria-labelledby="today-title" className="flex flex-col gap-section">
      <header className="flex flex-col gap-1">
        <h1 id="today-title" className="sr-only">
          Today
        </h1>
        <p className="text-label text-muted-foreground">{dateLabel}</p>
      </header>

      {cycleDay !== null ? (
        <div className="flex flex-wrap items-end justify-between gap-x-4 gap-y-3">
          <div className="flex flex-col gap-1">
            <p className="text-label text-muted-foreground">Cycle day</p>
            <p className="text-display text-foreground tabular-nums">
              <CrossfadeText text={String(cycleDay)} />
            </p>
            {lastPeriodText ? <p className="text-caption text-muted-foreground">{lastPeriodText}</p> : null}
          </div>
          {pill ? (
            <p className={cn("flex items-center gap-1.5 rounded-full px-3 py-1.5 text-label", PHASE_PILL[pill])}>
              {phase ? PHASE_LABELS[phase] : "Period day"}
              {phase && phase !== "menstrual" ? <span className="font-normal opacity-80">· estimated</span> : null}
            </p>
          ) : null}
        </div>
      ) : null}

      {strip ? <CycleStrip strip={strip} /> : null}

      <div className="flex flex-col gap-1.5 stage p-card">
        <div className="flex items-center gap-2">
          <h2 className="text-label text-muted-foreground">Next period</h2>
          {next.rangeText ? (
            <Badge variant="outline" className="border-dashed border-border-strong text-caption">
              Estimate
            </Badge>
          ) : null}
        </div>
        {next.rangeText ? (
          <p className="text-heading text-card-foreground tabular-nums text-balance">{next.rangeText}</p>
        ) : (
          <p className="text-body text-muted-foreground text-pretty">{next.fallback}</p>
        )}
        <p className="mt-1 text-label text-card-foreground">{next.confidenceLabel}</p>
        <p className="text-caption text-muted-foreground text-pretty">
          {next.confidenceReason}
          {next.basisText ? ` ${next.basisText}` : ""}
        </p>
        {next.typicalRangeText ? (
          <p className="text-caption text-muted-foreground text-pretty">{next.typicalRangeText}</p>
        ) : null}
        <ViewRecordsLink supportingDates={next.supportingDates} className="self-start" />
      </div>
    </section>
  );
}

const LEGEND: { kind: Exclude<StripDayKind, "unknown">; label: string }[] = [
  { kind: "menstrual", label: "Period" },
  { kind: "follicular", label: PHASE_LABELS.follicular },
  { kind: "ovulatory", label: PHASE_LABELS.ovulatory },
  { kind: "luteal", label: PHASE_LABELS.luteal },
];

function CycleStrip({ strip }: { strip: CycleStripData }) {
  const { days, todayIndex } = strip;
  const present = new Set(days.map((d) => d.kind));
  const todayLeft = `${((todayIndex + 0.5) / days.length) * 100}%`;
  const phasesShown = present.has("follicular") || present.has("luteal") || present.has("ovulatory");

  return (
    <figure className="flex flex-col gap-2">
      <div
        role="img"
        aria-label={`Cycle day ${todayIndex + 1} of an estimated ${days.length}-day cycle. Days after today are estimates.`}
        className="relative pt-3"
      >
        <span
          aria-hidden
          className="absolute top-0 h-2.5 w-0.5 -translate-x-1/2 rounded-full bg-foreground"
          style={{ left: todayLeft }}
        />
        <div aria-hidden className="flex h-3 gap-px overflow-hidden rounded-full">
          {days.map((d) => (
            <span key={d.date} className={cn("flex-1", STRIP_FILL[d.kind], d.future && "hatch-estimate")} />
          ))}
        </div>
      </div>
      <figcaption className="flex flex-col gap-2">
        <span className="flex justify-between text-caption text-muted-foreground">
          <span>Day 1</span>
          <span>Next period (est.)</span>
        </span>
        {phasesShown ? (
          <ul aria-label="Phases" className="flex flex-wrap gap-x-4 gap-y-1 text-caption text-muted-foreground">
            {LEGEND.filter((l) => present.has(l.kind)).map((l) => (
              <li key={l.kind} className="flex items-center gap-1.5">
                <span aria-hidden className={cn("size-3 rounded-sm", STRIP_FILL[l.kind])} />
                {l.label}
              </li>
            ))}
          </ul>
        ) : null}
      </figcaption>
    </figure>
  );
}

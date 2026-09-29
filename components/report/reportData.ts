/**
 * Pure data shaping for the Report screen's printable document (SPEC.md's U4 brief:
 * "Include period start/end, cycle lengths, durations, flow, pain severity, symptoms,
 * unexpected bleeding, medications/contraception when selected, notes, and
 * pregnancy/ovulation-test results when selected"). Every row here is built from data
 * this agent's `app/report/page.tsx` already fetched server-side — nothing is
 * recomputed, and nothing is fetched from within this module.
 *
 * "Unexpected bleeding" is deliberately always included, independent of the
 * sexual-activity toggle: it's one specific value of `DayLog.bleedingContext`
 * ("unexpected"), not the "postcoital"/"intermenstrual" detail the sexual-activity
 * toggle exists to gate. This is a distinction only the printable report (this module)
 * can make — the CSV export API scrubs the whole `bleedingContext` field at once (see
 * `components/report/reportSelection.ts`'s docstring).
 */
import { compare, type CivilDate } from "@/lib/date/civil";
import { PERIOD_DURATION_IN_PROGRESS, PERIOD_END_UNKNOWN } from "@/lib/copy/general";
import type {
  BleedingContext,
  BleedingEpisode,
  Cycle,
  CycleStatus,
  DayLog,
  PainSeverity,
  PainSite,
  Profile,
} from "@/lib/domain/types";
import { symptomLabel } from "@/lib/copy/insights";
import { formatCivilDate } from "@/components/charts/format";
import type { ReportRange } from "@/components/report/reportRange";
import type { ReportSelection } from "@/components/report/reportSelection";

// ============================================================================
// Small label maps — structural restatements of the recorded value, not a claim about
// the user's body (SPEC.md R9 governs claims; these are the same kind of plain,
// non-diagnostic nouns `lib/domain/types.ts` itself uses for PainSite/BleedingContext).
// ============================================================================

const PAIN_SEVERITY_LABEL: Record<PainSeverity, string> = {
  none: "None",
  mild: "Mild",
  moderate: "Moderate",
  severe: "Severe",
};

const PAIN_SITE_LABEL: Record<PainSite, string> = {
  lower_abdomen: "lower abdomen",
  back: "back",
  legs: "legs",
  pelvis: "pelvis",
  head: "head",
  other: "other",
};

const BLEEDING_CONTEXT_LABEL: Record<BleedingContext, string> = {
  period: "Period",
  intermenstrual: "Between periods",
  postcoital: "After sex",
  unexpected: "Unexpected",
};

const CYCLE_STATUS_LABEL: Record<CycleStatus, string> = {
  ok: "Recorded",
  gap_unknown: "Gap — unknown",
  skip_suspected: "Possible missed period",
  excluded_by_user: "Excluded by user",
  in_progress: "In progress",
};

function withinRange(date: CivilDate, range: ReportRange): boolean {
  return compare(date, range.from) >= 0 && compare(date, range.to) <= 0;
}

/** True if `[start, end]` overlaps `range` at all (an episode that started before the
 * range but ended inside it, or vice versa, still belongs in the report). */
function overlapsRange(start: CivilDate, end: CivilDate, range: ReportRange): boolean {
  return compare(start, range.to) <= 0 && compare(end, range.from) >= 0;
}

// ============================================================================
// Periods (start/end/duration/flow)
// ============================================================================

export interface ReportPeriodRow {
  startDate: CivilDate;
  startText: string;
  endText: string;
  durationText: string;
  flowLevelsText: string;
  endInferred: boolean;
}

function flowLevelsForEpisode(episode: BleedingEpisode, dayLogsByDate: ReadonlyMap<CivilDate, DayLog>): string {
  const levels = new Set<string>();
  for (const date of [...episode.menstrualDays, ...episode.spottingDays]) {
    const flow = dayLogsByDate.get(date)?.flow;
    if (flow) levels.add(flow);
  }
  return levels.size === 0 ? "Not recorded" : [...levels].join(", ");
}

export function buildPeriodRows(
  episodes: readonly BleedingEpisode[],
  dayLogsByDate: ReadonlyMap<CivilDate, DayLog>,
  range: ReportRange,
): ReportPeriodRow[] {
  return episodes
    .filter((e) => overlapsRange(e.startDate, e.endDate ?? e.startDate, range))
    .slice()
    .sort((a, b) => compare(a.startDate, b.startDate))
    .map((e) => {
      // An inferred end (the system's 2-day-no-bleeding-logged rule) is a best guess,
      // not something the user asserted with an explicit "last day" tap — it must
      // never be presented identically to a user-declared end date (SPEC.md R9-style
      // discipline: don't overclaim). `e.endDate === null` means genuinely open (no
      // guess at all); that case uses PERIOD_END_UNKNOWN instead of a fabricated date.
      const inferredSuffix = e.endDate !== null && e.endInferred ? " (estimated)" : "";
      return {
        startDate: e.startDate,
        startText: formatCivilDate(e.startDate),
        endText: e.endDate === null ? PERIOD_END_UNKNOWN : `${formatCivilDate(e.endDate)}${inferredSuffix}`,
        durationText:
          e.durationDays === null
            ? PERIOD_DURATION_IN_PROGRESS
            : `${e.durationDays} day${e.durationDays === 1 ? "" : "s"}${inferredSuffix}`,
        flowLevelsText: flowLevelsForEpisode(e, dayLogsByDate),
        endInferred: e.endInferred,
      };
    });
}

// ============================================================================
// Cycle lengths
// ============================================================================

export interface ReportCycleRow {
  startDate: CivilDate;
  startText: string;
  lengthText: string;
  statusLabel: string;
}

export function buildCycleRows(cycles: readonly Cycle[], range: ReportRange): ReportCycleRow[] {
  return cycles
    .filter((c) => withinRange(c.startDate, range))
    .slice()
    .sort((a, b) => compare(a.startDate, b.startDate))
    .map((c) => ({
      startDate: c.startDate,
      startText: formatCivilDate(c.startDate),
      lengthText: c.lengthDays === null ? "Not yet known" : `${c.lengthDays} days`,
      statusLabel: CYCLE_STATUS_LABEL[c.status],
    }));
}

// ============================================================================
// Pain
// ============================================================================

export interface ReportPainRow {
  date: CivilDate;
  dateText: string;
  severityLabel: string;
  sitesText: string | null;
}

export function buildPainRows(dayLogs: readonly DayLog[], range: ReportRange): ReportPainRow[] {
  return dayLogs
    .filter((l) => withinRange(l.date, range) && l.pain.severity !== "none")
    .slice()
    .sort((a, b) => compare(a.date, b.date))
    .map((l) => ({
      date: l.date,
      dateText: formatCivilDate(l.date),
      severityLabel: PAIN_SEVERITY_LABEL[l.pain.severity],
      sitesText: l.pain.sites && l.pain.sites.length > 0 ? l.pain.sites.map((s) => PAIN_SITE_LABEL[s]).join(", ") : null,
    }));
}

// ============================================================================
// Symptoms
// ============================================================================

export interface ReportSymptomRow {
  date: CivilDate;
  dateText: string;
  symptomsText: string;
}

export function buildSymptomRows(dayLogs: readonly DayLog[], range: ReportRange): ReportSymptomRow[] {
  return dayLogs
    .filter((l) => withinRange(l.date, range) && l.symptoms.length > 0)
    .slice()
    .sort((a, b) => compare(a.date, b.date))
    .map((l) => ({
      date: l.date,
      dateText: formatCivilDate(l.date),
      symptomsText: l.symptoms.map(symptomLabel).join(", "),
    }));
}

// ============================================================================
// Bleeding context — unexpected bleeding (always included) and sexual-activity-adjacent
// context (postcoital / intermenstrual — gated behind the sexual-activity toggle)
// ============================================================================

export interface ReportBleedingContextRow {
  date: CivilDate;
  dateText: string;
  contextLabel: string;
}

export function buildUnexpectedBleedingRows(dayLogs: readonly DayLog[], range: ReportRange): ReportBleedingContextRow[] {
  return dayLogs
    .filter((l) => withinRange(l.date, range) && l.bleedingContext === "unexpected")
    .slice()
    .sort((a, b) => compare(a.date, b.date))
    .map((l) => ({ date: l.date, dateText: formatCivilDate(l.date), contextLabel: BLEEDING_CONTEXT_LABEL.unexpected }));
}

export function buildSexualActivityContextRows(dayLogs: readonly DayLog[], range: ReportRange): ReportBleedingContextRow[] {
  return dayLogs
    .filter(
      (l): l is DayLog & { bleedingContext: "postcoital" | "intermenstrual" } =>
        withinRange(l.date, range) && (l.bleedingContext === "postcoital" || l.bleedingContext === "intermenstrual"),
    )
    .slice()
    .sort((a, b) => compare(a.date, b.date))
    .map((l) => ({ date: l.date, dateText: formatCivilDate(l.date), contextLabel: BLEEDING_CONTEXT_LABEL[l.bleedingContext] }));
}

// ============================================================================
// Notes
// ============================================================================

export interface ReportNoteRow {
  date: CivilDate;
  dateText: string;
  note: string;
}

export function buildNoteRows(dayLogs: readonly DayLog[], range: ReportRange): ReportNoteRow[] {
  return dayLogs
    .filter((l): l is DayLog & { notes: string } => withinRange(l.date, range) && !!l.notes && l.notes.trim().length > 0)
    .slice()
    .sort((a, b) => compare(a.date, b.date))
    .map((l) => ({ date: l.date, dateText: formatCivilDate(l.date), note: l.notes }));
}

// ============================================================================
// Fertility / ovulation-test observations (gated)
// ============================================================================

export interface ReportFertilityRow {
  date: CivilDate;
  dateText: string;
  detailsText: string;
}

export function buildFertilityRows(dayLogs: readonly DayLog[], range: ReportRange): ReportFertilityRow[] {
  return dayLogs
    .filter((l): l is DayLog & { fertility: NonNullable<DayLog["fertility"]> } => withinRange(l.date, range) && !!l.fertility)
    .slice()
    .sort((a, b) => compare(a.date, b.date))
    .map((l) => {
      const f = l.fertility;
      const parts: string[] = [];
      if (f.cervicalMucus) parts.push(`Cervical mucus: ${f.cervicalMucus}`);
      if (f.ovulationPain) parts.push("Ovulation pain noted");
      if (f.bbtCelsius !== undefined) parts.push(`BBT: ${f.bbtCelsius}°C`);
      if (f.opkResult) parts.push(`Ovulation test: ${f.opkResult}`);
      return { date: l.date, dateText: formatCivilDate(l.date), detailsText: parts.length > 0 ? parts.join("; ") : "No detail recorded" };
    });
}

// ============================================================================
// Medications/contraception and pregnancy/life-stage (profile-level, gated)
// ============================================================================

const HORMONAL_METHOD_LABEL: Record<string, string> = {
  combined_pill: "Combined pill",
  progestin_only_pill: "Progestin-only pill",
  patch: "Patch",
  ring: "Ring",
  hormonal_iud: "Hormonal IUD",
  implant: "Implant",
  injection: "Injection",
};

/** Lines describing medications/contraception in effect, from `Profile.state` — this is
 * point-in-time profile state, not a per-day log, so it's presented as a short summary
 * rather than a dated row list. Empty when nothing is set, so the caller can render an
 * honest "none recorded" message instead of an empty table. */
export function buildMedicationsAndContraceptionLines(profile: Profile): string[] {
  const lines: string[] = [];
  const { hormonalMethod, copperIudInsertedOn, stoppedHormonalOn } = profile.state;
  if (hormonalMethod) {
    lines.push(`${HORMONAL_METHOD_LABEL[hormonalMethod.kind] ?? hormonalMethod.kind}, started ${formatCivilDate(hormonalMethod.startedOn)}`);
  }
  if (copperIudInsertedOn) lines.push(`Copper IUD, inserted ${formatCivilDate(copperIudInsertedOn)}`);
  if (stoppedHormonalOn) lines.push(`Stopped a hormonal method on ${formatCivilDate(stoppedHormonalOn)}`);
  return lines;
}

/** Lines describing pregnancy/life-stage state, from `Profile.state`. */
export function buildPregnancyAndLifeStageLines(profile: Profile): string[] {
  const lines: string[] = [];
  const s = profile.state;
  if (s.pregnant) lines.push("Currently pregnant" + (s.deliveryDate ? `, expected/delivery date ${formatCivilDate(s.deliveryDate)}` : ""));
  if (s.breastfeeding) lines.push("Currently breastfeeding");
  if (s.perimenopauseSelfDeclared) lines.push("Self-reported perimenopause");
  if (s.menopauseSelfDeclared) lines.push("Self-reported menopause");
  if (s.knownIrregular) lines.push("Self-reported history of variable cycle timing");
  return lines;
}

// ============================================================================
// Top-level aggregator
// ============================================================================

export interface ReportData {
  range: ReportRange;
  periods: ReportPeriodRow[];
  cycles: ReportCycleRow[];
  pain: ReportPainRow[];
  symptoms: ReportSymptomRow[];
  unexpectedBleeding: ReportBleedingContextRow[];
  sexualActivityContext: ReportBleedingContextRow[] | null;
  notes: ReportNoteRow[];
  fertility: ReportFertilityRow[] | null;
  medicationsAndContraception: string[] | null;
  pregnancyAndLifeStage: string[] | null;
}

export interface BuildReportDataInput {
  range: ReportRange;
  dayLogs: readonly DayLog[];
  cycles: readonly Cycle[];
  episodes: readonly BleedingEpisode[];
  profile: Profile;
  selection: ReportSelection;
}

/** Assembles every section of the printable report. A gated section is `null` (not an
 * empty array) when its toggle is off, so the rendering layer can tell "excluded by
 * choice" apart from "included, nothing recorded". */
export function buildReportData(input: BuildReportDataInput): ReportData {
  const { range, dayLogs, cycles, episodes, profile, selection } = input;
  const dayLogsByDate = new Map(dayLogs.map((l) => [l.date, l] as const));

  return {
    range,
    periods: buildPeriodRows(episodes, dayLogsByDate, range),
    cycles: buildCycleRows(cycles, range),
    pain: buildPainRows(dayLogs, range),
    symptoms: buildSymptomRows(dayLogs, range),
    unexpectedBleeding: buildUnexpectedBleedingRows(dayLogs, range),
    sexualActivityContext: selection.includeSexualActivity ? buildSexualActivityContextRows(dayLogs, range) : null,
    notes: buildNoteRows(dayLogs, range),
    fertility: selection.includeFertilityObservations ? buildFertilityRows(dayLogs, range) : null,
    medicationsAndContraception: selection.includeMedicationsAndContraception
      ? buildMedicationsAndContraceptionLines(profile)
      : null,
    pregnancyAndLifeStage: selection.includePregnancyAndLifeStage ? buildPregnancyAndLifeStageLines(profile) : null,
  };
}

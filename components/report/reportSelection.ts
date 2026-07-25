/**
 * Pure selective-inclusion logic for the Report screen (SPEC.md's U4 brief: "Selective
 * export: sexual-activity and fertility data default to EXCLUDED — user must opt in to
 * include them").
 *
 * The underlying data model has no dedicated "sexual activity" or "medications" field —
 * see `app/api/export/route.ts`'s own comment on `scrubDayLog`. This module's four
 * toggles map onto what's actually available:
 *   - `includeSexualActivity`   -> `DayLog.bleedingContext` (period/intermenstrual/
 *     postcoital/unexpected) as a whole, matching the export API's own all-or-nothing
 *     scrub (see this agent's final report for why a finer split isn't possible without
 *     an app/api/export change, which is G-owned).
 *   - `includeFertilityObservations` -> `DayLog.fertility` (cervical mucus, BBT,
 *     ovulation-test result) — forced off entirely when
 *     `profile.settings.fertilityEnabled` is false (SPEC.md §0: "no fertility columns
 *     in exports" when the feature itself is off), never a user choice at that point.
 *   - `includeMedicationsAndContraception` / `includePregnancyAndLifeStage` ->
 *     `Profile.state` (hormonal method, IUD, pregnancy, breastfeeding). Both require the
 *     export API's `includeProfile=true`, but only the printable HTML report (this
 *     agent's own rendering, not the CSV) can act on the two independently, since the
 *     CSV endpoint has no per-field profile control.
 */
import type { ReportRange } from "@/components/report/reportRange";

export interface ReportSelection {
  includeSexualActivity: boolean;
  includeFertilityObservations: boolean;
  includeMedicationsAndContraception: boolean;
  includePregnancyAndLifeStage: boolean;
}

/** [choice] Sexual activity and fertility observations default OFF per SPEC.md's
 * explicit instruction. Medications/contraception and pregnancy/life-stage default ON:
 * SPEC.md only says "when selected" for these (optional, not "default excluded"), and a
 * clinician-facing report benefits from carrying this context unless the user opts it
 * out — the opposite privacy posture from the two fields SPEC.md singles out. */
export const DEFAULT_REPORT_SELECTION: ReportSelection = {
  includeSexualActivity: false,
  includeFertilityObservations: false,
  includeMedicationsAndContraception: true,
  includePregnancyAndLifeStage: true,
};

/** Forces fertility observations off when the feature itself is disabled in settings —
 * never a user choice at that point (SPEC.md §0). Applied to every selection right
 * before it's used, so a stale toggle value (e.g. left over from when fertility was
 * enabled) can never leak a fertility column into an export. */
export function effectiveSelection(selection: ReportSelection, fertilityEnabled: boolean): ReportSelection {
  return fertilityEnabled ? selection : { ...selection, includeFertilityObservations: false };
}

/** Whether the CSV/JSON export's `includeProfile` flag should be set — true whenever
 * either profile-backed toggle is on (the export API has no finer split; see the
 * module docstring). */
export function needsProfileInExport(selection: ReportSelection): boolean {
  return selection.includeMedicationsAndContraception || selection.includePregnancyAndLifeStage;
}

/** Builds the query string for `GET /api/export` (already built, G-owned) from a
 * resolved range and selection. `format` is `"csv"` for the download button; `"json"`
 * is available for completeness (e.g. a future "copy as JSON" affordance) even though
 * this screen's own printable report renders from data it fetched itself rather than
 * from this endpoint. */
export function buildExportQuery(
  range: ReportRange,
  selection: ReportSelection,
  format: "csv" | "json" = "csv",
): string {
  const params = new URLSearchParams();
  params.set("from", range.from);
  params.set("to", range.to);
  params.set("format", format);
  params.set("includeFertility", String(selection.includeFertilityObservations));
  params.set("includeSexualActivity", String(selection.includeSexualActivity));
  if (format === "json" && needsProfileInExport(selection)) {
    params.set("includeProfile", "true");
  }
  return `/api/export?${params.toString()}`;
}

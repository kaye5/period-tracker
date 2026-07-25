/**
 * Pure mapping between the domain `DayLog` shape (lib/domain/types.ts) and the
 * relational row shapes for `day_logs` + its four child tables (docs/DB-MIGRATION.md
 * §3.1–3.2). No database, no I/O — every function here is a plain data transform, unit
 * tested exhaustively with no DB (docs/DB-MIGRATION.md §4.1).
 *
 * `DayLogRow` is derived from the Drizzle table definition (`typeof dayLogs.$inferSelect`)
 * via a **type-only** import, so this file has zero runtime dependency on lib/db — the
 * import is erased at compile time.
 *
 * Rules encoded here (docs/DB-MIGRATION.md §3, SPEC.md R1):
 * - CivilDate stays a "YYYY-MM-DD" string end to end; never touches `Date`.
 * - Optional booleans (doubleProtection, nightChange, leakThrough, painkillerDidNotHelp,
 *   nothingToReport) map SQL `null -> undefined`, never `false` — done via `??`, which
 *   only substitutes on `null`/`undefined`, so a real `false` survives unchanged.
 * - `fertility` is reconstructed only when at least one `fertility_*` column is non-null;
 *   `fertility: {}` and `undefined` are equivalent for this app, so an all-null fertility
 *   set collapses to `undefined`.
 * - `symptoms` is a required array per the domain type: always `[]`, never `undefined`.
 * - `pain.sites` / `pain.interferedWith` / `mood` are optional arrays: omitted
 *   (`undefined`), not `[]`, when there are no corresponding child rows. This means the
 *   domain-level distinction between "explicitly logged as empty" and "never touched" is
 *   not representable in the relational schema (there is no on-disk difference between a
 *   day log saved with `sites: []` and one saved with `sites` absent) — both round-trip
 *   to `undefined`. That is a deliberate, documented lossy boundary, not a bug.
 * - `fastestProductChangeHours` / `fertility.bbtCelsius` are numbers in the domain but
 *   `decimal` columns default to Drizzle's string mode, so they are stringified on the
 *   way in and `Number(...)`-parsed on the way out.
 * - Validation happens at both boundaries via `dayLogSchema`, exactly as the pre-migration
 *   repo validated on write (`upsertDayLog`) and on read (`toDayLog`) — `toRows` validates
 *   the incoming `DayLog`, `fromRows` validates the reconstructed one.
 */
import type { DayLog, Interference, MoodId, PainSite, SymptomId } from "@/lib/domain/types";
import { dayLogSchema } from "@/lib/domain/schema";
import type { dayLogs } from "@/lib/db";

/** The `day_logs` parent-table row shape, as Drizzle infers it from the schema. */
export type DayLogRow = typeof dayLogs.$inferSelect;

/** The four child-table value sets for one day log, keyed the way the child tables are. */
export interface DayLogChildValues {
  symptoms: SymptomId[];
  moods: MoodId[];
  painSites: PainSite[];
  interference: Interference[];
}

export interface DayLogRows {
  row: DayLogRow;
  symptoms: SymptomId[];
  moods: MoodId[];
  painSites: PainSite[];
  interference: Interference[];
}

/** Domain `DayLog` -> relational row + child value arrays. Validates `log` against
 * `dayLogSchema` first (matches the old repo's write-boundary validation), so an invalid
 * `DayLog` throws here rather than reaching the database. */
export function toRows(log: DayLog): DayLogRows {
  const validated = dayLogSchema.parse(log);

  const row: DayLogRow = {
    date: validated.date,
    bleeding: validated.bleeding,
    flow: validated.flow ?? null,
    bleedingContext: validated.bleedingContext ?? null,
    periodBoundary: validated.periodBoundary ?? null,
    clots: validated.clots ?? null,
    productChanges: validated.productChanges ?? null,
    fastestProductChangeHours:
      validated.fastestProductChangeHours != null ? String(validated.fastestProductChangeHours) : null,
    doubleProtection: validated.doubleProtection ?? null,
    nightChange: validated.nightChange ?? null,
    leakThrough: validated.leakThrough ?? null,
    painSeverity: validated.pain.severity,
    painkillerDidNotHelp: validated.pain.painkillerDidNotHelp ?? null,
    nothingToReport: validated.nothingToReport ?? null,
    notes: validated.notes ?? null,
    loggedAt: validated.loggedAt,
    fertilityCervicalMucus: validated.fertility?.cervicalMucus ?? null,
    fertilityOvulationPain: validated.fertility?.ovulationPain ?? null,
    fertilityBbtCelsius:
      validated.fertility?.bbtCelsius != null ? String(validated.fertility.bbtCelsius) : null,
    fertilityOpkResult: validated.fertility?.opkResult ?? null,
  };

  return {
    row,
    symptoms: validated.symptoms,
    moods: validated.mood ?? [],
    painSites: validated.pain.sites ?? [],
    interference: validated.pain.interferedWith ?? [],
  };
}

/** Relational row + child value arrays -> domain `DayLog`. Validates the reconstructed
 * object against `dayLogSchema` (matches the old repo's read-boundary validation, e.g.
 * surviving a row written by an older/looser shape without crashing). */
export function fromRows(row: DayLogRow, children: DayLogChildValues): DayLog {
  const hasFertility =
    row.fertilityCervicalMucus != null ||
    row.fertilityOvulationPain != null ||
    row.fertilityBbtCelsius != null ||
    row.fertilityOpkResult != null;

  const candidate = {
    date: row.date,
    bleeding: row.bleeding,
    flow: row.flow ?? undefined,
    bleedingContext: row.bleedingContext ?? undefined,
    periodBoundary: row.periodBoundary ?? undefined,
    clots: row.clots ?? undefined,
    productChanges: row.productChanges ?? undefined,
    fastestProductChangeHours:
      row.fastestProductChangeHours != null ? Number(row.fastestProductChangeHours) : undefined,
    doubleProtection: row.doubleProtection ?? undefined,
    nightChange: row.nightChange ?? undefined,
    leakThrough: row.leakThrough ?? undefined,
    pain: {
      severity: row.painSeverity,
      sites: children.painSites.length > 0 ? children.painSites : undefined,
      interferedWith: children.interference.length > 0 ? children.interference : undefined,
      painkillerDidNotHelp: row.painkillerDidNotHelp ?? undefined,
    },
    symptoms: children.symptoms,
    nothingToReport: row.nothingToReport ?? undefined,
    mood: children.moods.length > 0 ? children.moods : undefined,
    notes: row.notes ?? undefined,
    fertility: hasFertility
      ? {
          cervicalMucus: row.fertilityCervicalMucus ?? undefined,
          ovulationPain: row.fertilityOvulationPain ?? undefined,
          bbtCelsius: row.fertilityBbtCelsius != null ? Number(row.fertilityBbtCelsius) : undefined,
          opkResult: row.fertilityOpkResult ?? undefined,
        }
      : undefined,
    loggedAt: row.loggedAt,
  };

  return dayLogSchema.parse(candidate);
}

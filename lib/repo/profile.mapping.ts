/**
 * Pure mapping between the flattened `profile` row (lib/db/schema.ts, DB-MIGRATION.md
 * §3.3 — one singleton row, `id = 1`) and the domain `Profile` shape
 * (lib/domain/types.ts). No I/O, no validation side effects — `toRow`/`fromRow` are
 * plain data transforms, unit-tested with plain objects and no database
 * (DB-MIGRATION.md §4.1). Boundary validation (profileSchema.parse) stays in
 * lib/repo/profile.ts, same as every other repo file.
 *
 * `state.hormonalMethod` is reconstructed only when `stateHormonalMethodKind` is
 * non-null (DB-MIGRATION.md §3.3): `toRow` always writes `stateHormonalMethodKind` and
 * `stateHormonalMethodStartedOn` together (both null, or both non-null) from the
 * presence/absence of `state.hormonalMethod`, so `fromRow` can safely assume the started-
 * on column is non-null whenever the kind column is.
 */
import type { CivilDate } from "@/lib/date/civil";
import type { Profile } from "@/lib/domain/types";
import type { profile as profileTable } from "@/lib/db/schema";

/** The fixed id of the single profile row (DB-MIGRATION.md §3.3: "PK `id TINYINT` fixed
 * at 1"). */
export const PROFILE_ID = 1;

export type ProfileRow = typeof profileTable.$inferSelect;

export function toRow(p: Profile): ProfileRow {
  return {
    id: PROFILE_ID,
    birthYear: p.birthYear ?? null,
    menarcheYear: p.menarcheYear ?? null,
    reportedTypicalCycleLength: p.reportedTypicalCycleLength ?? null,
    reportedTypicalPeriodDays: p.reportedTypicalPeriodDays ?? null,
    reportedRegularity: p.reportedRegularity ?? null,

    statePregnant: p.state.pregnant,
    stateDeliveryDate: p.state.deliveryDate ?? null,
    stateBreastfeeding: p.state.breastfeeding,
    stateHormonalMethodKind: p.state.hormonalMethod?.kind ?? null,
    stateHormonalMethodStartedOn: p.state.hormonalMethod?.startedOn ?? null,
    stateCopperIudInsertedOn: p.state.copperIudInsertedOn ?? null,
    stateStoppedHormonalOn: p.state.stoppedHormonalOn ?? null,
    statePerimenopauseSelfDeclared: p.state.perimenopauseSelfDeclared,
    stateMenopauseSelfDeclared: p.state.menopauseSelfDeclared,
    stateKnownIrregular: p.state.knownIrregular,
    statePreferNotToSay: p.state.preferNotToSay,

    settingsFertilityEnabled: p.settings.fertilityEnabled,
    settingsTierCSymptomsEnabled: p.settings.tierCSymptomsEnabled,
    settingsHealthAwarenessEnabled: p.settings.healthAwarenessEnabled,
    settingsLocale: p.settings.locale,
    notifPeriodReminder: p.settings.notifications.periodReminder,
    notifFertileReminder: p.settings.notifications.fertileReminder,
    notifSymptomReminder: p.settings.notifications.symptomReminder,
    notifMedicationReminder: p.settings.notifications.medicationReminder,
    notifLoggingReminder: p.settings.notifications.loggingReminder,
    notifHealthAwareness: p.settings.notifications.healthAwareness,
    notifPrivateWording: p.settings.notifications.privateWording,
  };
}

export function fromRow(row: ProfileRow): Profile {
  return {
    birthYear: row.birthYear ?? undefined,
    menarcheYear: row.menarcheYear ?? undefined,
    reportedTypicalCycleLength: row.reportedTypicalCycleLength ?? undefined,
    reportedTypicalPeriodDays: row.reportedTypicalPeriodDays ?? undefined,
    reportedRegularity: row.reportedRegularity ?? undefined,
    state: {
      pregnant: row.statePregnant,
      deliveryDate: (row.stateDeliveryDate as CivilDate | null) ?? undefined,
      breastfeeding: row.stateBreastfeeding,
      hormonalMethod: row.stateHormonalMethodKind
        ? {
            kind: row.stateHormonalMethodKind,
            // Non-null whenever stateHormonalMethodKind is non-null — see toRow above.
            startedOn: row.stateHormonalMethodStartedOn as CivilDate,
          }
        : undefined,
      copperIudInsertedOn: (row.stateCopperIudInsertedOn as CivilDate | null) ?? undefined,
      stoppedHormonalOn: (row.stateStoppedHormonalOn as CivilDate | null) ?? undefined,
      perimenopauseSelfDeclared: row.statePerimenopauseSelfDeclared,
      menopauseSelfDeclared: row.stateMenopauseSelfDeclared,
      knownIrregular: row.stateKnownIrregular,
      preferNotToSay: row.statePreferNotToSay,
    },
    settings: {
      fertilityEnabled: row.settingsFertilityEnabled,
      tierCSymptomsEnabled: row.settingsTierCSymptomsEnabled,
      healthAwarenessEnabled: row.settingsHealthAwarenessEnabled,
      notifications: {
        periodReminder: row.notifPeriodReminder,
        fertileReminder: row.notifFertileReminder,
        symptomReminder: row.notifSymptomReminder,
        medicationReminder: row.notifMedicationReminder,
        loggingReminder: row.notifLoggingReminder,
        healthAwareness: row.notifHealthAwareness,
        privateWording: row.notifPrivateWording,
      },
      locale: row.settingsLocale,
    },
  };
}

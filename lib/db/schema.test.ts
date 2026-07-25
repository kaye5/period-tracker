/**
 * Lightweight schema smoke test — no database needed. Asserts the schema module
 * imports cleanly and that each expected table export exists with its key columns, per
 * docs/DB-MIGRATION.md §3. The heavy round-trip verification (actually writing/reading
 * rows against real MySQL) is the integration agent's job.
 */
import { describe, expect, it } from "vitest";
import { getTableColumns, getTableName } from "drizzle-orm";
import * as schema from "@/lib/db/schema";

describe("lib/db/schema", () => {
  it("exports a table object for every relational table in DB-MIGRATION.md §3", () => {
    const expectedTables: Record<string, string> = {
      dayLogs: "day_logs",
      dayLogSymptoms: "day_log_symptoms",
      dayLogMoods: "day_log_moods",
      dayLogPainSites: "day_log_pain_sites",
      dayLogPainInterference: "day_log_pain_interference",
      profile: "profile",
      predictions: "predictions",
      excludedCycles: "excluded_cycles",
      skipPromptDecisions: "skip_prompt_decisions",
      healthMessageDecisions: "health_message_decisions",
      calibration: "calibration",
      calibrationCoverage: "calibration_coverage",
    };

    for (const [exportName, tableName] of Object.entries(expectedTables)) {
      const table = (schema as Record<string, unknown>)[exportName];
      expect(table, `schema.${exportName} should be exported`).toBeDefined();
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      expect(getTableName(table as any)).toBe(tableName);
    }
  });

  it("day_logs has its parent-table columns, including the flattened fertility fields", () => {
    const columns = getTableColumns(schema.dayLogs);
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        "date",
        "bleeding",
        "flow",
        "bleedingContext",
        "periodBoundary",
        "clots",
        "productChanges",
        "fastestProductChangeHours",
        "doubleProtection",
        "nightChange",
        "leakThrough",
        "painSeverity",
        "painkillerDidNotHelp",
        "nothingToReport",
        "notes",
        "loggedAt",
        "fertilityCervicalMucus",
        "fertilityOvulationPain",
        "fertilityBbtCelsius",
        "fertilityOpkResult",
      ]),
    );
    expect(columns.date.primary).toBe(true);
    expect(columns.bleeding.notNull).toBe(true);
    expect(columns.painSeverity.notNull).toBe(true);
    expect(columns.flow.notNull).toBe(false);
  });

  it("day_log child tables have a composite (date, value) primary key column set", () => {
    expect(Object.keys(getTableColumns(schema.dayLogSymptoms))).toEqual(["date", "symptom"]);
    expect(Object.keys(getTableColumns(schema.dayLogMoods))).toEqual(["date", "mood"]);
    expect(Object.keys(getTableColumns(schema.dayLogPainSites))).toEqual(["date", "site"]);
    expect(Object.keys(getTableColumns(schema.dayLogPainInterference))).toEqual([
      "date",
      "interference",
    ]);
  });

  it("profile is a singleton keyed by id, with state_/settings_/notif_ columns present", () => {
    const columns = getTableColumns(schema.profile);
    expect(columns.id.primary).toBe(true);
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        "statePregnant",
        "stateBreastfeeding",
        "stateHormonalMethodKind",
        "stateHormonalMethodStartedOn",
        "statePerimenopauseSelfDeclared",
        "stateMenopauseSelfDeclared",
        "stateKnownIrregular",
        "statePreferNotToSay",
        "settingsFertilityEnabled",
        "settingsTierCSymptomsEnabled",
        "settingsHealthAwarenessEnabled",
        "settingsLocale",
        "notifPeriodReminder",
        "notifFertileReminder",
        "notifSymptomReminder",
        "notifMedicationReminder",
        "notifLoggingReminder",
        "notifHealthAwareness",
        "notifPrivateWording",
      ]),
    );
    // Defaults must match DEFAULT_PROFILE (lib/repo/profile.ts): only privateWording
    // defaults true among the notification booleans.
    expect(columns.notifPrivateWording.default).toBe(true);
    expect(columns.notifPeriodReminder.default).toBe(false);
    expect(columns.notifFertileReminder.default).toBe(false);
    expect(columns.notifSymptomReminder.default).toBe(false);
    expect(columns.notifMedicationReminder.default).toBe(false);
    expect(columns.notifLoggingReminder.default).toBe(false);
    expect(columns.notifHealthAwareness.default).toBe(false);
    expect(columns.settingsFertilityEnabled.default).toBe(false);
    expect(columns.settingsTierCSymptomsEnabled.default).toBe(false);
    expect(columns.settingsHealthAwarenessEnabled.default).toBe(true);
    expect(columns.settingsLocale.default).toBe("en-US");
  });

  it("predictions has an auto-increment bigint id and the issued_on index target column", () => {
    const columns = getTableColumns(schema.predictions);
    expect(columns.id.primary).toBe(true);
    expect((columns.id as unknown as { autoIncrement: boolean }).autoIncrement).toBe(true);
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining([
        "issuedOn",
        "predictedCenter",
        "predictedLow",
        "predictedHigh",
        "resolvedActualStart",
        "signedError",
        "covered",
      ]),
    );
  });

  it("excluded_cycles and skip_prompt_decisions have their documented columns", () => {
    expect(Object.keys(getTableColumns(schema.excludedCycles))).toEqual(
      expect.arrayContaining(["cycleStartDate", "reason", "decidedOn"]),
    );
    expect(getTableColumns(schema.excludedCycles).cycleStartDate.primary).toBe(true);

    expect(Object.keys(getTableColumns(schema.skipPromptDecisions))).toEqual(
      expect.arrayContaining(["gapStartDate", "confirmed", "inferredStartDate", "decidedOn"]),
    );
    expect(getTableColumns(schema.skipPromptDecisions).gapStartDate.primary).toBe(true);
  });

  it("health_message_decisions maps every field of healthMessageDecisionSchema", () => {
    const columns = getTableColumns(schema.healthMessageDecisions);
    expect(Object.keys(columns)).toEqual(
      expect.arrayContaining(["ruleId", "dismissed", "snoozedUntil", "decidedOn"]),
    );
    expect(columns.ruleId.primary).toBe(true);
  });

  it("calibration is a singleton and calibration_coverage is keyed by position", () => {
    const calColumns = getTableColumns(schema.calibration);
    expect(calColumns.id.primary).toBe(true);
    expect(calColumns.cumulativeAdjustment.default).toBe(1.0);

    const coverageColumns = getTableColumns(schema.calibrationCoverage);
    expect(coverageColumns.position.primary).toBe(true);
    expect(coverageColumns.covered.notNull).toBe(true);
  });
});

/**
 * Drizzle mysql table definitions — the relational schema for this app (DEC-011).
 * Transcribed from docs/DB-MIGRATION.md §3, which is authoritative for every table and
 * column name here; do not rename or add a column without updating that doc first.
 *
 * Single user — no `user_id` anywhere (docs/DB-MIGRATION.md §3). CivilDate columns are
 * `char(10)` ("YYYY-MM-DD"), never `date`/`datetime`, to preserve the branded-string
 * contract (SPEC.md R1) with no timezone coercion. Booleans are nullable exactly where
 * the domain field is optional; the repo-layer mapping functions convert SQL
 * `null -> undefined` (never `false`) for those. Closed string unions use `mysqlEnum`;
 * the repo boundary still validates with the existing zod schemas in lib/domain/schema.ts.
 *
 * `drizzle-kit generate` (via drizzle.config.ts, which points at this file) is the only
 * thing allowed to turn this into migration SQL — see docs/DB-MIGRATION.md §1.
 */
import {
  bigint,
  boolean,
  char,
  decimal,
  double,
  index,
  int,
  mysqlEnum,
  mysqlTable,
  primaryKey,
  text,
  tinyint,
  varchar,
} from "drizzle-orm/mysql-core";

// ============================================================================
// day_logs (parent; sole recorded truth) — DB-MIGRATION.md §3.1
// ============================================================================

export const dayLogs = mysqlTable("day_logs", {
  date: char("date", { length: 10 }).primaryKey(),
  bleeding: mysqlEnum("bleeding", ["none", "spotting", "menstrual"]).notNull(),
  flow: mysqlEnum("flow", ["spotting", "light", "medium", "heavy", "very_heavy"]),
  bleedingContext: mysqlEnum("bleeding_context", [
    "period",
    "intermenstrual",
    "postcoital",
    "unexpected",
  ]),
  periodBoundary: mysqlEnum("period_boundary", ["start", "end"]),
  clots: mysqlEnum("clots", ["none", "small", "ge_2_5cm"]),
  productChanges: int("product_changes"),
  fastestProductChangeHours: decimal("fastest_product_change_hours", {
    precision: 2,
    scale: 1,
  }),
  doubleProtection: boolean("double_protection"),
  nightChange: boolean("night_change"),
  leakThrough: boolean("leak_through"),
  painSeverity: mysqlEnum("pain_severity", ["none", "mild", "moderate", "severe"]).notNull(),
  painkillerDidNotHelp: boolean("painkiller_did_not_help"),
  nothingToReport: boolean("nothing_to_report"),
  notes: text("notes"),
  loggedAt: char("logged_at", { length: 10 }).notNull(),
  // Fertility (inline, nullable — reconstruct the `fertility` object only if at least
  // one of these four is non-null; `fertility: {}` and `undefined` are equivalent).
  fertilityCervicalMucus: mysqlEnum("fertility_cervical_mucus", [
    "dry",
    "sticky",
    "creamy",
    "watery",
    "egg_white",
  ]),
  fertilityOvulationPain: boolean("fertility_ovulation_pain"),
  fertilityBbtCelsius: decimal("fertility_bbt_celsius", { precision: 4, scale: 2 }),
  fertilityOpkResult: mysqlEnum("fertility_opk_result", ["negative", "positive"]),
});

// ---------------------------------------------------------------------------
// Child tables of day_logs — set semantics, no order column (DB-MIGRATION.md §3.2).
// Composite PK (date, value); FK date -> day_logs.date ON DELETE CASCADE. Repos must
// also delete child rows explicitly inside the write transaction (belt-and-suspenders —
// some TiDB configs don't enforce FK cascade).
// ---------------------------------------------------------------------------

export const dayLogSymptoms = mysqlTable(
  "day_log_symptoms",
  {
    date: char("date", { length: 10 })
      .notNull()
      .references(() => dayLogs.date, { onDelete: "cascade" }),
    symptom: mysqlEnum("symptom", [
      "cramps",
      "breast_tenderness",
      "bloating",
      "headache",
      "fatigue",
      "cravings",
      "gi_change",
      "acne",
      "irritability",
      "low_mood",
      "anxiety",
      "emotional_sensitivity",
      "sleep_change",
      "exercise_change",
      "focus_change",
      "libido_change",
    ]).notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.symptom] })],
);

export const dayLogMoods = mysqlTable(
  "day_log_moods",
  {
    date: char("date", { length: 10 })
      .notNull()
      .references(() => dayLogs.date, { onDelete: "cascade" }),
    mood: mysqlEnum("mood", [
      "calm",
      "happy",
      "energetic",
      "irritable",
      "sad",
      "anxious",
      "sensitive",
      "low",
    ]).notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.mood] })],
);

export const dayLogPainSites = mysqlTable(
  "day_log_pain_sites",
  {
    date: char("date", { length: 10 })
      .notNull()
      .references(() => dayLogs.date, { onDelete: "cascade" }),
    site: mysqlEnum("site", ["lower_abdomen", "back", "legs", "pelvis", "head", "other"]).notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.site] })],
);

export const dayLogPainInterference = mysqlTable(
  "day_log_pain_interference",
  {
    date: char("date", { length: 10 })
      .notNull()
      .references(() => dayLogs.date, { onDelete: "cascade" }),
    interference: mysqlEnum("interference", [
      "work_or_school",
      "sleep",
      "exercise",
      "social",
      "household",
    ]).notNull(),
  },
  (table) => [primaryKey({ columns: [table.date, table.interference] })],
);

// ============================================================================
// profile (singleton) — DB-MIGRATION.md §3.3. Defaults must match DEFAULT_PROFILE in
// lib/repo/profile.ts.
// ============================================================================

export const profile = mysqlTable("profile", {
  id: tinyint("id").primaryKey(),
  birthYear: int("birth_year"),
  menarcheYear: int("menarche_year"),
  reportedTypicalCycleLength: int("reported_typical_cycle_length"),
  reportedTypicalPeriodDays: int("reported_typical_period_days"),
  reportedRegularity: mysqlEnum("reported_regularity", ["consistent", "variable", "unknown"]),
  // State (flattened, prefix state_)
  statePregnant: boolean("state_pregnant").notNull(),
  stateDeliveryDate: char("state_delivery_date", { length: 10 }),
  stateBreastfeeding: boolean("state_breastfeeding").notNull(),
  stateHormonalMethodKind: mysqlEnum("state_hormonal_method_kind", [
    "combined_pill",
    "progestin_only_pill",
    "patch",
    "ring",
    "hormonal_iud",
    "implant",
    "injection",
  ]),
  stateHormonalMethodStartedOn: char("state_hormonal_method_started_on", { length: 10 }),
  stateCopperIudInsertedOn: char("state_copper_iud_inserted_on", { length: 10 }),
  stateStoppedHormonalOn: char("state_stopped_hormonal_on", { length: 10 }),
  statePerimenopauseSelfDeclared: boolean("state_perimenopause_self_declared").notNull(),
  stateMenopauseSelfDeclared: boolean("state_menopause_self_declared").notNull(),
  stateKnownIrregular: boolean("state_known_irregular").notNull(),
  statePreferNotToSay: boolean("state_prefer_not_to_say").notNull(),
  // Settings (prefix settings_ / notif_)
  settingsFertilityEnabled: boolean("settings_fertility_enabled").notNull().default(false),
  settingsTierCSymptomsEnabled: boolean("settings_tier_c_symptoms_enabled")
    .notNull()
    .default(false),
  settingsHealthAwarenessEnabled: boolean("settings_health_awareness_enabled")
    .notNull()
    .default(true),
  settingsLocale: mysqlEnum("settings_locale", ["en-US", "en-GB"]).notNull().default("en-US"),
  notifPeriodReminder: boolean("notif_period_reminder").notNull().default(false),
  notifFertileReminder: boolean("notif_fertile_reminder").notNull().default(false),
  notifSymptomReminder: boolean("notif_symptom_reminder").notNull().default(false),
  notifMedicationReminder: boolean("notif_medication_reminder").notNull().default(false),
  notifLoggingReminder: boolean("notif_logging_reminder").notNull().default(false),
  notifHealthAwareness: boolean("notif_health_awareness").notNull().default(false),
  notifPrivateWording: boolean("notif_private_wording").notNull().default(true),
});

// ============================================================================
// predictions — DB-MIGRATION.md §3.4
// ============================================================================

export const predictions = mysqlTable(
  "predictions",
  {
    id: bigint("id", { mode: "number", unsigned: true }).autoincrement().primaryKey(),
    issuedOn: char("issued_on", { length: 10 }).notNull(),
    predictedCenter: char("predicted_center", { length: 10 }),
    predictedLow: char("predicted_low", { length: 10 }),
    predictedHigh: char("predicted_high", { length: 10 }),
    resolvedActualStart: char("resolved_actual_start", { length: 10 }),
    signedError: int("signed_error"),
    covered: boolean("covered"),
  },
  (table) => [index("predictions_issued_on_idx").on(table.issuedOn)],
);

// ============================================================================
// excluded_cycles — DB-MIGRATION.md §3.5 (from UserDecisions.excludedCycles)
// ============================================================================

export const excludedCycles = mysqlTable("excluded_cycles", {
  cycleStartDate: char("cycle_start_date", { length: 10 }).primaryKey(),
  reason: text("reason").notNull(),
  decidedOn: char("decided_on", { length: 10 }).notNull(),
});

// ============================================================================
// skip_prompt_decisions — DB-MIGRATION.md §3.6 (from UserDecisions.skipPrompts)
// ============================================================================

export const skipPromptDecisions = mysqlTable("skip_prompt_decisions", {
  gapStartDate: char("gap_start_date", { length: 10 }).primaryKey(),
  confirmed: boolean("confirmed").notNull(),
  inferredStartDate: char("inferred_start_date", { length: 10 }),
  decidedOn: char("decided_on", { length: 10 }).notNull(),
});

// ============================================================================
// health_message_decisions — DB-MIGRATION.md §3.7. Every field of
// healthMessageDecisionSchema (lib/repo/decisions.ts): ruleId, dismissed, snoozedUntil,
// decidedOn.
// ============================================================================

export const healthMessageDecisions = mysqlTable("health_message_decisions", {
  ruleId: varchar("rule_id", { length: 16 }).primaryKey(),
  dismissed: boolean("dismissed").notNull(),
  snoozedUntil: char("snoozed_until", { length: 10 }),
  decidedOn: char("decided_on", { length: 10 }).notNull(),
});

// ============================================================================
// calibration (singleton) + calibration_coverage — DB-MIGRATION.md §3.8. Defaults must
// match DEFAULT_CALIBRATION_STATE in lib/repo/calibration.ts.
// ============================================================================

export const calibration = mysqlTable("calibration", {
  id: tinyint("id").primaryKey(),
  cumulativeAdjustment: double("cumulative_adjustment").notNull().default(1.0),
});

/** The ordered `recentCoverage` array, 0-based, most recent last. Rewriting calibration
 * replaces all coverage rows in one transaction. */
export const calibrationCoverage = mysqlTable("calibration_coverage", {
  position: int("position").primaryKey(),
  covered: boolean("covered").notNull(),
});

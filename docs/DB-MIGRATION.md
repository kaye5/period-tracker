# Data-layer migration contract — MongoDB → relational (MySQL / TiDB via Drizzle)

**Authoritative for this migration.** Read fully before touching code. Where it conflicts
with older docs (SPEC.md §2's Mongo collection list, DEC-001/DEC-009), THIS wins for the
data layer; everything else in SPEC.md still holds.

## 0. What is and is not changing

**Changing:** only `lib/db/**`, `lib/repo/**`, `scripts/seed.ts`, env, `package.json`,
and docs. That is the entire blast radius — verified: nothing under `app/**`,
`components/**`, `lib/engine/**`, or `lib/domain/**` imports `mongodb` or
`lib/db/collections`. The engine, API routes, UI, and their ~739 tests must remain
untouched and still pass.

**NOT changing:** every domain type in `lib/domain/types.ts`; every repo function's
**domain-facing signature and return type**; the API route contracts; the engine. This is
a storage swap, not a feature change. Do **not** add fields (e.g. the previously-flagged
`anchorStart` on predictions stays a separate follow-up), rename domain types, or alter
behaviour.

**The seam:** every `lib/repo/*.ts` function currently takes an optional trailing
`col?: MinimalCollection<T>` used only by tests. Replace that param with an optional
trailing `tx?: Db` (a Drizzle database/transaction handle), defaulting to the shared
client. Callers that omit it (all of `app/**`) are unaffected. Keep the public names and
domain types byte-identical.

## 1. ORM, driver, tooling (DEC-011)

- `drizzle-orm` (runtime), `mysql2` (runtime driver), `drizzle-kit` (dev) — added.
- `mongodb` — removed from dependencies and from every import.
- Dialect **mysql**, which is wire-compatible with TiDB (MySQL protocol). The same code
  serves local MySQL, MySQL, and TiDB (incl. TiDB Cloud). The only difference is
  `DATABASE_URL` and TLS.
- **Migrations are ORM-generated only.** Run `drizzle-kit generate` to emit SQL into
  `./drizzle`. Never hand-author or hand-edit a migration SQL file. A reviewer verifies
  the generated SQL matches the schema and carries drizzle's own metadata (`drizzle/meta`).
- `drizzle.config.ts`: `{ dialect: 'mysql', schema: './lib/db/schema.ts', out: './drizzle',
  dbCredentials: { url: process.env.DATABASE_URL } }`.

## 2. Environment

`.env.local` (gitignored) needs **one** variable, plus one optional:

```
DATABASE_URL="mysql://user:password@host:3306/period_tracker"
# DATABASE_SSL=true   # set for TiDB Cloud / any host requiring TLS (port is usually 4000 for TiDB)
```

The client enables `mysql2` TLS when `DATABASE_SSL` is truthy (TiDB Cloud requires it).
For the local Docker MySQL, leave it unset. `.env.example` documents both. Remove all
`MONGODB_URI` / `MONGO_*` variables.

## 3. The relational schema

All tables InnoDB, `utf8mb4`. **Single user — no `user_id` anywhere.** CivilDate columns
are `CHAR(10)` (`"YYYY-MM-DD"`), never `DATE`/`DATETIME`, to preserve the branded-string
contract (SPEC R1) with no timezone coercion. Booleans are Drizzle `boolean()`
(TINYINT(1)); **nullable** where the domain field is optional, and the mapping converts
SQL `null → undefined` (NOT `false`) for optional booleans. Closed string unions use
`mysqlEnum`; the repo boundary still validates with the existing zod schemas.

### 3.1 `day_logs` (parent; sole recorded truth)
PK `date CHAR(10)`. Columns (snake_case): `bleeding` enum(none,spotting,menstrual) NOT
NULL; `flow` enum(spotting,light,medium,heavy,very_heavy) NULL; `bleeding_context`
enum(period,intermenstrual,postcoital,unexpected) NULL; `period_boundary` enum(start,end)
NULL; `clots` enum(none,small,ge_2_5cm) NULL; `product_changes` int NULL;
`fastest_product_change_hours` decimal(2,1) NULL; `double_protection` bool NULL;
`night_change` bool NULL; `leak_through` bool NULL; `pain_severity`
enum(none,mild,moderate,severe) NOT NULL; `painkiller_did_not_help` bool NULL;
`nothing_to_report` bool NULL; `notes` text NULL; `logged_at CHAR(10)` NOT NULL.
Fertility (inline, nullable — reconstruct the `fertility` object ONLY if at least one is
non-null; `fertility: {}` and `undefined` are equivalent for this app):
`fertility_cervical_mucus` enum(dry,sticky,creamy,watery,egg_white) NULL;
`fertility_ovulation_pain` bool NULL; `fertility_bbt_celsius` decimal(4,2) NULL;
`fertility_opk_result` enum(negative,positive) NULL.

### 3.2 Child tables of `day_logs` (set semantics, no order column)
Each: FK `date CHAR(10)` → `day_logs.date` **ON DELETE CASCADE**, composite PK `(date, value)`.
- `day_log_symptoms(date, symptom)` — symptom is the 16-value `SymptomId` set.
- `day_log_moods(date, mood)` — 8-value `MoodId` set.
- `day_log_pain_sites(date, site)` — 6-value `PainSite` set.
- `day_log_pain_interference(date, interference)` — 5-value `Interference` set.

Also delete children explicitly inside the write transaction (belt-and-suspenders — some
TiDB configs don't enforce FK cascade). Upserting a day log is one transaction: upsert
parent, then replace child rows.

### 3.3 `profile` (singleton)
PK `id TINYINT` fixed at 1. Scalars: `birth_year` int NULL, `menarche_year` int NULL,
`reported_typical_cycle_length` int NULL, `reported_typical_period_days` int NULL,
`reported_regularity` enum(consistent,variable,unknown) NULL. State (flattened, prefix
`state_`): `pregnant` bool NOT NULL, `delivery_date` CHAR(10) NULL, `breastfeeding` bool
NOT NULL, `hormonal_method_kind` enum(combined_pill,progestin_only_pill,patch,ring,
hormonal_iud,implant,injection) NULL, `hormonal_method_started_on` CHAR(10) NULL (the
`hormonalMethod` object is reconstructed only when kind is non-null),
`copper_iud_inserted_on` CHAR(10) NULL, `stopped_hormonal_on` CHAR(10) NULL,
`perimenopause_self_declared` bool NOT NULL, `menopause_self_declared` bool NOT NULL,
`known_irregular` bool NOT NULL, `prefer_not_to_say` bool NOT NULL. Settings (prefix
`settings_`/`notif_`): `settings_fertility_enabled` bool NOT NULL DEFAULT false,
`settings_tier_c_symptoms_enabled` bool NOT NULL DEFAULT false,
`settings_health_awareness_enabled` bool NOT NULL DEFAULT true, `settings_locale`
enum('en-US','en-GB') NOT NULL DEFAULT 'en-US', and seven notification booleans
`notif_period_reminder`, `notif_fertile_reminder`, `notif_symptom_reminder`,
`notif_medication_reminder`, `notif_logging_reminder`, `notif_health_awareness`,
`notif_private_wording` (DEFAULT true). Defaults must match `DEFAULT_PROFILE` in
`lib/repo/profile.ts`.

### 3.4 `predictions`
PK `id BIGINT AUTO_INCREMENT`. Columns: `issued_on CHAR(10)` NOT NULL, `predicted_center
CHAR(10)` NULL, `predicted_low CHAR(10)` NULL, `predicted_high CHAR(10)` NULL,
`resolved_actual_start CHAR(10)` NULL, `signed_error int` NULL, `covered bool` NULL. Index
on `issued_on`. Preserve `predictionRecordSchema` and `PredictionRecord` exactly, including
`id: string` (stringify the numeric id). Keep `listPredictions` ordering by `issued_on` asc.

### 3.5 `excluded_cycles` (from `UserDecisions.excludedCycles`)
PK `cycle_start_date CHAR(10)`; `reason text` NOT NULL; `decided_on CHAR(10)` NOT NULL.

### 3.6 `skip_prompt_decisions` (from `UserDecisions.skipPrompts`)
PK `gap_start_date CHAR(10)`; `confirmed bool` NOT NULL; `inferred_start_date CHAR(10)`
NULL; `decided_on CHAR(10)` NOT NULL.

### 3.7 `health_message_decisions`
PK `rule_id VARCHAR(16)`. Map every field of the existing `healthMessageDecisionSchema`
(read `lib/repo/decisions.ts`) to a column, CHAR(10) for any date field. Do not drop or
rename a field.

### 3.8 `calibration` (singleton) + `calibration_coverage`
`calibration`: PK `id TINYINT` = 1; `cumulative_adjustment double` NOT NULL DEFAULT 1.0.
`calibration_coverage`: `position int` PK (0-based, most recent last), `covered bool` NOT
NULL — the ordered `recentCoverage` array. Rewriting calibration replaces all coverage
rows in one transaction. Defaults must match `DEFAULT_CALIBRATION_STATE`.

## 4. Testing strategy (keeps `pnpm test` green with no DB)

1. **Pure mapping functions** per repo: `lib/repo/<x>.mapping.ts` with `toRows(domain)` →
   `{ row, childRows... }` and `fromRows({ row, childRows... })` → domain. These hold ALL
   field-fidelity logic (null↔undefined, fertility/hormonalMethod reconstruct-if-any,
   boolean nullability, enum round-trip). Unit-test them exhaustively with NO database —
   this is the primary deterministic coverage and replaces the old `FakeCollection` tests.
2. **Integration tests** (`lib/repo/__integration__/*.itest.ts`, owned by the seed/test-infra
   agent) exercise real Drizzle queries against MySQL. They **skip when `DATABASE_URL` is
   unset** (so offline `pnpm test` stays green) and run for real in the integration phase
   against the Docker MySQL. `vitest.config.ts` includes `.itest.ts`.
3. Do not weaken or delete a research-invariant/engine test. None of those are in scope.

## 5. Definition of done (per agent)
`pnpm exec tsc --noEmit` clean for your files; `pnpm exec vitest run` your tests pass;
`pnpm exec eslint <your files>` clean; you touched only files you own; migrations were
produced by `drizzle-kit generate`, never hand-written. Report: files written, tests and
what they cover, any mapping decision you made, and anything you could not implement 1:1.

## 6. Ownership
- **SCHEMA agent:** `package.json` (deps+scripts), `drizzle.config.ts`, `lib/db/schema.ts`,
  `lib/db/client.ts` (Drizzle connection + exported `Db` type + `getDb()`), `lib/db/index.ts`
  (barrel), `lib/db/migrate.ts`, `.env.example`, `.env.local`, `docker-compose.yml`,
  generated `drizzle/**`. DELETE `lib/db/collections.ts`, `lib/db/indexes.ts`. Must actually
  run `drizzle-kit generate` and apply it against Docker MySQL to prove it works.
- **DAYLOGS agent:** `lib/repo/dayLogs.ts`, `lib/repo/dayLogs.mapping.ts`, their `.test.ts`.
- **PROFILE+DECISIONS agent:** `lib/repo/profile.ts`, `lib/repo/decisions.ts`, mappings, tests.
- **PRED+CALIB agent:** `lib/repo/predictions.ts`, `lib/repo/calibration.ts`, mappings, tests.
- **SEED+TESTINFRA agent:** `scripts/seed.ts`, `lib/repo/testUtils.ts` (rewrite as a Drizzle
  test-DB helper), `lib/repo/__integration__/**`.
- **INTEGRATION agent:** may edit anything — brings up Docker MySQL, migrates, seeds, runs the
  full suite + `next build` + live integration tests, purges Mongo leftovers, updates
  `docs/DECISIONS.md` (DEC-011 ORM/dep-budget change; DEC-012 storage-location/privacy),
  `docs/PRIVACY.md` + `PRIVACY_STATEMENT` (honest for both local-DB and hosted-DB cases; keep
  the `privacyClaims.test.ts` guard passing), `docs/SPEC.md` data-layer notes, and `README.md`.

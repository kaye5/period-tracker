# Decision log

Lightweight ADR-style log. Each entry: what was decided, why, and what it costs. Numbered
`DEC-NNN`, oldest first. **Do not renumber or delete an entry** — if a decision is later
reversed, add a new entry that supersedes it and cross-reference the old one.

Note on ownership: `docs/DECISIONS.md` is listed as an F-owned file in SPEC.md §2, but
agent D's brief explicitly directs two deviations to be logged here (see DEC-007,
DEC-008 below, added by D). That is intentional — this file is a shared append-only log
by nature, the same way a changelog is. Append new entries at the bottom in the same
format; do not edit or renumber existing entries.

---

## DEC-001 — MongoDB, local-only, no encryption at rest

**Decision:** Store all data in MongoDB, bound to `127.0.0.1`, with auth enabled and
credentials in a gitignored `.env.local`. No encryption at rest.

**Why:** User-made trade-off (SPEC.md §0). A real database (vs. e.g. flat JSON files)
gives indexing, atomic updates, and a query layer the statistics/insight engines can
lean on, at the cost of the data being plainly readable on disk by anything with
filesystem access.

**Privacy delta:** The source PRD asked for encryption at rest. This build does not
have it. See `docs/PRIVACY.md` for the full, plainly-stated consequence — nothing about
this decision is papered over in user-facing copy.

**Status:** Accepted, current.

---

## DEC-002 — App lock deferred

**Decision:** No PIN/biometric lock screen in this build. Do not stub a fake one.

**Why:** Explicitly deferred by the user (SPEC.md §0) rather than built and left
half-working — a lock screen that doesn't actually gate anything (e.g. a PIN prompt
that can be dismissed, or that doesn't block direct DB access) is worse than no lock
screen, because it implies a protection that isn't real.

**Consequence:** Anyone who can unlock this device can open this app and see
everything in it. Documented plainly in `docs/PRIVACY.md`.

**Status:** Accepted, current. Revisit if/when this ships beyond a single trusted
device.

---

## DEC-003 — Fertility features off by default

**Decision:** `Settings.fertilityEnabled` defaults to `false`. When off: no fertility
UI, no fertility cards, no fertility fields in the day log, no fertility columns in
exports.

**Why:** Fertility estimation from calendar data alone is the least reliable prediction
this app makes (01-cycle-prediction.md §2.3-§2.4: ovulation timing is not fixed, and
the honest uncertainty is the convolution of the next-period prediction error and the
luteal-length error — wider than most users expect). Defaulting it off means a user who
never opts in never sees a calendar-only fertility estimate presented as more certain
than it is, and the app never nudges toward a use case (conceiving or avoiding
pregnancy) the user didn't ask for.

**Status:** Accepted, current.

---

## DEC-004 — Three-dependency budget: `mongodb`, `zod`, `vitest`

**Decision:** No new runtime/dev dependency beyond these three without explicit
sign-off (SPEC.md §0).

**Why:** Every additional dependency is: (a) more surface area for the "no third-party
script/analytics" privacy claim in `docs/PRIVACY.md` to accidentally become false, (b)
more supply-chain risk for an app that handles sensitive health data, (c) more that can
silently change behaviour on a routine `pnpm install`. `mongodb` and `zod` are load-
bearing (the data layer and boundary validation have no reasonable hand-rolled
substitute); `vitest` is the test runner. Everything else — charts, PDF export, date
math, statistics — is either small enough to hand-roll correctly (see DEC-005, DEC-006)
or already covered by Next.js/React/Tailwind.

**Status:** Accepted, current.

---

## DEC-005 — Hand-rolled inline SVG charts, no charting library

**Decision:** All charts (cycle length by month, period duration by month, symptom
timeline, flow by period day, predicted vs. actual) are hand-written inline SVG in
`components/charts/`, not a charting library.

**Why:** Direct consequence of DEC-004's dependency budget. The chart set this app
needs is small, fixed, and simple (line/bar charts over at most ~24 data points) —
well within what's reasonable to hand-roll with full control over accessibility
(text alternatives, non-colour indicators per SPEC.md §4.2) and no bundle-size or
supply-chain cost.

**Status:** Accepted, current.

---

## DEC-006 — Print stylesheet + "Save as PDF" instead of a PDF library

**Decision:** The clinician report (`app/report/**`) is a normal HTML page with a print
stylesheet, exported via the browser's native "Save as PDF" — not a PDF-generation
dependency.

**Why:** Direct consequence of DEC-004's dependency budget. Every modern browser's
print-to-PDF pipeline is a competent, zero-dependency PDF renderer already installed on
the user's machine; a print stylesheet gets a clinician-presentable document without
adding a PDF library's dependency tree (and its own supply-chain surface) to an app
that handles sensitive health data.

**Status:** Accepted, current.

---

<!-- Agents other than F: append new entries below this line, in the same format. -->

## DEC-007 — URG-01 fires on ANY ONE systemic symptom, not ACOG's literal conjunction

**Decision:** The urgent heavy-bleeding rule URG-01 (soaking through protection every hour
for ≥2 consecutive hours *plus* systemic symptoms) fires when the bleeding criterion is met
together with **any one** of the systemic symptoms (e.g. dizziness, lightheadedness,
shortness of breath), rather than requiring the full conjunction ACOG states with "and".

**Why:** ACOG's source sentence lists the systemic symptoms joined by "and" (see
`docs/research/03-additional-data-and-safety.md` §5, ~line 527: "the soaking criterion plus
ANY ONE systemic symptom"). Read literally, requiring *every* listed systemic symptom
simultaneously makes the rule nearly un-fireable — a user in genuine hypovolemic distress
would have to self-report the complete set before being told to seek care. For a
safety-critical *seek-urgent-care* message the asymmetric cost is clear: the cost of firing
one cycle early (a user reads a calm, sourced "consider urgent care" note) is far lower than
the cost of never firing. We therefore weaken the antecedent to a disjunction over the
systemic symptoms. The full ACOG threshold is still quoted verbatim in the message's "Why am
I seeing this?" panel so the user sees exactly what the source says.

**Cost:** URG-01 fires somewhat more readily than a literal reading of ACOG would. This is a
deliberate false-positive-tolerant choice for a safety message, disclosed here and via the
sourced threshold panel.

**Status:** Accepted, current. Implemented in `lib/engine/health.ts`; copy in
`lib/copy/health.ts`; behaviour covered by `lib/engine/health.test.ts`.

---

## DEC-008 — URG-01 and PMB-01 ignore the snooze guard and are non-dismissible

**Decision:** The two most safety-critical health-awareness rules — URG-01 (urgent heavy
bleeding with systemic symptoms) and PMB-01 (postmenopausal bleeding) — bypass the global
snooze/quiet guard that every other rule respects, and are rendered non-dismissible
(`dismissible: false`, per the `HealthMessage` contract in SPEC.md §3).

**Why:** The snooze guard exists so routine, informational nudges don't nag. Applying it to
a *seek-urgent-care* signal would let a previous snooze silence a message about a condition
(hemorrhage risk; postmenopausal bleeding, a red-flag symptom) where timeliness matters most.
A user who dismissed a benign note last month must not thereby suppress a red-flag note this
month. These two rules are the only ones where the potential harm of suppression outweighs
the annoyance cost of always showing them.

**Cost:** A user cannot permanently dismiss these two messages while the triggering condition
persists. That is intentional. Every other rule remains fully dismissible/snoozable.

**Status:** Accepted, current. Implemented in `lib/engine/health.ts`; behaviour covered by
`lib/engine/health.test.ts`.

---

## DEC-009 — Storage moved from local MongoDB to MongoDB Atlas (cloud)

**Supersedes:** DEC-001's "local-only, bound to 127.0.0.1" premise. DEC-001 remains in
the log for history; this entry is the current state.

**Decision:** The app connects to MongoDB Atlas (cloud-hosted) via a single `MONGODB_URI`
SRV connection string plus `MONGO_DB_NAME`. The local Docker MongoDB (`docker-compose.yml`)
and the `db:up`/`db:down`/`db:reset` scripts were removed; `db:seed` remains and runs
against Atlas. The redundant `MONGO_ROOT_USERNAME`/`MONGO_ROOT_PASSWORD` variables were
dropped — with Atlas the credentials live inside the URI.

**Why:** User decision. Atlas gives managed hosting, at-rest encryption, and backups
without running a local database.

**Privacy delta (significant — this is the reason the entry exists):** health data now
*leaves the device* and is stored in a third party's cloud. The earlier "nothing ever
leaves this machine / no network calls" framing was corrected everywhere it appeared
(`docs/PRIVACY.md`, `lib/copy/general.ts`'s `PRIVACY_STATEMENT`, `.env.example`). The new
posture: data is in MongoDB's custody; the Atlas connection string (with its password)
sits in plain text in `.env.local`; protection now depends on the user's Atlas account
security (strong password, 2FA, IP access list) rather than on device security alone.
The app still adds no client-side encryption, so it holds no key MongoDB does not
effectively also hold. The single most impactful future change would be client-side
(end-to-end) encryption so Atlas stores only ciphertext.

**Status:** Accepted, current.

---

## DEC-010 — Fix: database name was read from the wrong env var

**Decision:** `lib/db/client.ts` read `process.env.MONGODB_DB_NAME`, but the configured
variable is `MONGO_DB_NAME`. Corrected to `MONGO_DB_NAME` so the intended database is
actually selected.

**Why:** Straight bug. With the wrong name the driver silently fell back to the database
embedded in the URI (or the default), so `MONGO_DB_NAME` had no effect — reads and writes
could land in an unexpected database.

**Status:** Accepted, current.

---

## DEC-011 — Data layer migrated to Drizzle ORM + mysql2; `mongodb` dropped

**Supersedes:** DEC-009 and DEC-010 (the MongoDB Atlas storage layer and its env-var
handling), and the `mongodb` slice of DEC-004's three-dependency budget. DEC-001, DEC-004,
DEC-009, and DEC-010 remain in the log for history; this entry is the current state of the
storage layer. The full migration contract is `docs/DB-MIGRATION.md`.

**Decision:** All persistence moved from MongoDB to a relational (MySQL-wire) database
accessed through **Drizzle ORM** on the **mysql2** driver. The runtime dependencies are now
`drizzle-orm`, `mysql2`, and `zod`; the dev dependency `drizzle-kit` generates migrations;
`vitest` remains the test runner. `mongodb` was removed from `package.json`, the lockfile,
and every import. The dialect is **mysql**, which is wire-compatible with TiDB, so the same
code serves local MySQL, hosted MySQL, and TiDB (including TiDB Cloud) — the only difference
is `DATABASE_URL` and whether `DATABASE_SSL` is set. Schema lives in `lib/db/schema.ts`;
`lib/db/client.ts` exposes a shared pool and the `Db` handle type. Each `lib/repo/*.ts`
function's optional trailing test parameter changed from `col?: MinimalCollection<T>` to
`tx?: Db`; every domain-facing signature and return type is otherwise unchanged — this is a
storage swap, not a feature change.

**Migrations are ORM-generated only.** `drizzle-kit generate` emits SQL into `./drizzle`
with a `drizzle/meta` journal; migration SQL is never hand-authored or hand-edited. A local
Docker MySQL (`docker-compose.yml`, `pnpm db:up`/`db:down`/`db:reset`) backs development and
the integration tests.

**Why:** User decision (multi-agent build). A relational schema with explicit columns,
enums, and foreign keys models this app's data (a parent `day_logs` table with set-semantic
child tables, a singleton `profile`, prediction/decision/calibration tables) more directly
than documents, and makes the civil-date-as-`CHAR(10)` contract (SPEC.md R1) and the
optional-field null↔undefined rules enforceable at the column level. Choosing the MySQL
dialect keeps a single codebase across local MySQL and TiDB Cloud.

**Cost / dependency-budget note:** this revises DEC-004 — the runtime driver is now two
packages (`drizzle-orm` + `mysql2`) plus a dev-only `drizzle-kit`, where before there was
one (`mongodb`). The "no third-party analytics/script, sensitive-health-data supply-chain"
reasoning behind DEC-004 still holds and still forbids casual new dependencies; this entry
is the explicit sign-off DEC-004 requires for these three.

**Status:** Accepted, current.

---

## DEC-012 — Storage location is now the user's choice via `DATABASE_URL`

**Decision:** The database the app talks to is whatever `DATABASE_URL` points at, and the
user chooses where that database runs. Two supported shapes: (a) a MySQL running **on this
machine** (e.g. the local Docker MySQL) — the data stays on the machine; (b) a **hosted
service** such as TiDB Cloud or a hosted MySQL provider — the data leaves the device and is
stored on that provider's servers, in their custody. `DATABASE_SSL=true` enables TLS for
hosted services that require it (TiDB Cloud does; its default port is usually 4000).

**Why:** The Drizzle/mysql2 layer (DEC-011) is wire-compatible with both, so the same build
serves either without code changes. Which one is in use is a deployment-time configuration
choice, not a code choice.

**Privacy delta (the reason this entry exists):** the honest privacy story now depends on
where `DATABASE_URL` points, and the copy must cover **both** cases without over-claiming. A
local database keeps the data on the machine but adds no protection of its own (no app lock,
credentials in plain text in `.env.local`); a hosted database additionally puts the data in
a third party's custody, where its protection depends on that provider and the user's account
with them, not on this app. `docs/PRIVACY.md` and `lib/copy/general.ts`'s `PRIVACY_STATEMENT`
were rewritten to state exactly this, in lockstep, and still make no "encrypted", "secure",
"private", or "local-only" claim (the `lib/copy/privacyClaims.test.ts` guard enforces this).
As with DEC-009, the single most impactful future change would be client-side (end-to-end)
encryption so a hosted database stores only ciphertext.

**Status:** Accepted, current.

---

## DEC-013 — Integration tests run against a dedicated `_test` database, guarded

**Decision:** The live repo round-trip tests (`lib/repo/__integration__/*.itest.ts`) are
destructive — `truncateAll` empties every table between tests — and, because they call the
repo functions bare, they hit whatever `DATABASE_URL` points at. To stop that from ever
wiping real data:

- `pnpm test:integration` points `DATABASE_URL` at a separate `period_tracker_test`
  database (created by `scripts/mysql-init/01-create-test-db.sql` on the local Docker
  MySQL; re-created by `pnpm db:reset`).
- `lib/repo/testUtils.ts`'s `assertDestructiveTestsAllowed()` throws unless the target
  database name ends in `_test` (or `ALLOW_DESTRUCTIVE_TESTS=1` is set). So a run against
  `period_tracker` — local **or** the TiDB Cloud production database — is refused, not
  executed.
- Plain `pnpm test` sets no `DATABASE_URL`, so the integration suite skips entirely and
  needs no database.

**Why:** during the Mongo→relational migration the tests were wired to the app's own
`DATABASE_URL` and truncated it, emptying the seeded dev database — the app then showed
onboarding instead of data, looking broken. The guard makes that failure mode impossible
rather than relying on remembering to set a separate URL.

**Status:** Accepted, current.

---

## DEC-014 — Adopted shadcn/ui (Base UI) for the component layer

**Decision:** The UI was refactored from hand-rolled primitives to **shadcn/ui on the
Base UI base** (`@base-ui/react`), user-requested. The custom
`components/ui/{Button,Card,Chip,Sheet,Toggle,SegmentedControl}.tsx` and their barrel were
removed; screens import shadcn components directly. `components/ui/Legend.tsx` was kept
(no shadcn equivalent) and restyled.

**Dependency budget (supersedes DEC-004/011 for the UI layer):** this adds
`@base-ui/react`, `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`,
`sonner`, and `tw-animate-css` — a deliberate, user-approved exception to the
three-dependency budget. All are bundled npm packages (no remote-origin load), so the
`no-remote-origin.test.ts` guard still holds.

**Theme:** the app's calm rose / warm-neutral palette is preserved by mapping it onto
shadcn's semantic tokens (`--primary`, `--card`, `--muted-foreground`, …) in
`app/globals.css`, light + dark. Legacy token aliases (`bg-surface`, `text-text`,
`bg-chip-bg`, `border-border-strong`, `bg-danger`) are bridged in the `@theme inline`
block and can be removed once nothing references them.

**Guards preserved during setup:** shadcn `init` injected a `next/font/google` (Geist)
font and a `next-themes` dependency in `sonner`; both were reverted — the system-font
stack is kept (SPEC §0.1 / `no-remote-origin.test.ts`), and `sonner` now uses
`theme="system"` with no extra dependency. The Button default size was set to `h-11`
(44px) so shadcn's compact Nova defaults don't break SPEC §4.5's touch-target rule.

**Base UI, not Radix:** custom triggers use the `render` prop, not `asChild`.

**Status:** Accepted, current. Verified: tsc clean, 794 tests pass (incl. the banned-word,
privacy-claims, and no-remote-origin guards), `next build` clean, and all screens render
live against the configured database.

---


## DEC-015 — History charts moved to shadcn/ui charts (recharts dependency)

**Decision:** Replace the hand-rolled inline-SVG charts on the History screen with
shadcn/ui's chart primitives (`components/ui/chart.tsx`: ChartContainer / ChartTooltip /
ChartLegend) on top of **recharts**, added as a runtime dependency. As part of the same
pass, the History page was reordered (cycle list first, charts below) and the flow chart
switched to a sequential rose ramp (`--chart-flow-1..5`), since flow intensity is
ordered data, not categorical.

**Why:** Direct user request on 2026-07-24 ("use shadcn visualization") — this is the
sign-off SPEC §0's dependency row requires. The SVG charts were bespoke and hard to
extend; the shadcn/recharts layer gives consistent tooltips, legends, and theming on the
existing `--chart-*` tokens.

**Guards preserved:** recharts is a bundled npm package that fetches nothing at runtime,
so SPEC §0.1 and `no-remote-origin.test.ts` are unaffected. Each chart keeps its
`role="img"` text summary and collapsible data-table alternative (SPEC §4.5), and
excluded/anomalous cycles remain visible and distinguishable by more than color alone
(R7). Chart data still comes exclusively from `computeEverything` output reshaped by the
pure helpers in `components/charts/transforms.ts` (SPEC §4.1).

**Supersedes:** the "Charts: hand-rolled inline SVG, no charting dependency" row of
SPEC §0 (see the Charts note added beneath that table).

**Status:** Accepted, current.

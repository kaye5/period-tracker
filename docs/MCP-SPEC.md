# Spec: MCP server

Status: draft for review · 2026-11-14

## Objective

Let an external AI client (Claude Code, Claude Desktop, Cursor …) **record** and **read** this
app's cycle data through the Model Context Protocol, so the user can say "my period started
today", "I feel calm", "my period ended", or ask "when is my period due?", "how long will it
last?", "when does my mood usually change?" — from outside the app.

The app adds **no AI of its own**. The MCP server is a deterministic layer over what already
exists: the same day-log save path, the same validation, the same prediction engine. Any
forecasting in words ("expect irritability around Nov 25 – Dec 8") is done by the user's AI
client, from numbers this server returns. The server never invents a prediction the engine
does not compute.

### User stories

- **Record:** "My period started today." · "Still on my period, flow is heavy." · "My period
  ended." · "I'm calm and happy today." · "I have cramps." · "Nothing to report today."
  (optionally for a past date)
- **Read:** "When is my period due?" · "How long will my period last?" · "What cycle day is
  it?" · "When is my fertile window?" (only if enabled) · "When does my mood usually change?" ·
  "What should I expect around my next period?" · "What did I log last week?"

## Assumptions (confirm or correct)

1. Single user, single profile — the app has no accounts; the MCP token grants access to
   that one dataset.
2. Auth is a **fixed bearer token** set in the environment (`MCP_TOKEN`). OAuth (needed for
   claude.ai custom connectors) is out of scope.
3. Transport is **Streamable HTTP, stateless**, inside the existing Next.js app (works on
   serverless hosting; no background process).
4. **Time zones (decided 2026-11-14, see "Part A"):** server and database run in UTC; calendar
   days stay `YYYY-MM-DD` (SPEC R1); every instant is UTC; "today" always comes from the
   user's time zone (browser, else the profile), never the host's. MCP responses always state
   the time zone they used.
5. **Two small schema changes, both additive** (drizzle migration): `profile.time_zone`
   (IANA name, nullable) and `day_logs.updated_at` (UTC instant). Writes otherwise use the
   existing `day_logs` tables via `upsertDayLog`.
6. No delete or "clear" tools in v1, and no tool ever wipes recorded data.

## Tech stack

- Next.js 16 (App Router) route handler, TypeScript, zod 3.25 (already installed).
- **New dependency (one):** `@modelcontextprotocol/sdk@^1.32` — uses its
  `WebStandardStreamableHTTPServerTransport` (Request → Response, fits a route handler), with
  `sessionIdGenerator: undefined` (stateless). Supports zod `^3.25 || ^4`, so no zod upgrade.
  Not using `mcp-handler`: v2 requires the separate `@modelcontextprotocol/server` package
  (zod 4); v1 pins an older SDK. One dependency is enough.
- Existing: `lib/engine` (`computeEverything`), `lib/repo/*`, `lib/domain/schema.ts`
  (`dayLogSchema`), `lib/copy/*` (disclaimers, labels).

## Part A — Time zone (app-wide; prerequisite for MCP)

**Problem today:** "today" is computed with the *host's* time zone on the server (Today,
Calendar, Insights, Report, `/api/compute`) but the *browser's* time zone in client code (the
day-log sheet, decisions, onboarding). On UTC hosting these disagree for part of every day, so
e.g. a quick-log tap at 06:00 in UTC+7 saves to *yesterday* while "All details" opens today.

**Rules**

| What | Rule |
|---|---|
| Calendar days — period/log days, `loggedAt`, decisions, predictions | Unchanged: `YYYY-MM-DD` strings, no time zone (SPEC R1). Never converted to UTC instants — a day logged as Nov 14 at UTC+7 would otherwise read back as Nov 13. |
| Instants | Always UTC. DB: `DATETIME(3)` holding UTC; mysql2 pool `timezone: "Z"`. Wire: ISO 8601 with `Z`. |
| Server / DB | Run in UTC; no code may depend on the host time zone again — `Intl.DateTimeFormat().resolvedOptions().timeZone` is removed from all server code. |
| "Today" | `todayInZone(userTimeZone, Date.now())` everywhere, where `userTimeZone` is resolved below. |

**Resolving the user's time zone** (`lib/time/userTimeZone.ts`, one function used by every
server page, API route and MCP):

1. MCP only: the tool's `timeZone` input, if given.
2. The `tz` cookie (IANA name) sent by the browser.
3. `profile.time_zone` (last zone the browser reported).
4. `"UTC"`, flagged as a fallback.

Every candidate is validated (must be accepted by `Intl.DateTimeFormat({ timeZone })`);
invalid values are ignored, never thrown.

**Keeping it current:** a tiny client component (`components/providers/TimeZoneSync.tsx`,
mounted in the root layout) reads the browser zone on load. If it differs from the `tz`
cookie it calls `POST /api/time-zone { timeZone }`, which validates it, sets the cookie
(`SameSite=Lax`, 1 year, not httpOnly), stores it in `profile.time_zone`, and the component
then calls `router.refresh()` so server-rendered "today" updates. Travelling updates it
automatically on the next app open.

**`day_logs.updated_at`:** set to the current UTC instant on every save (app or MCP). Returned
by MCP so a client can say when something was recorded.

## Architecture

```
AI client ──HTTP POST /api/mcp──▶ app/api/mcp/route.ts
  (Authorization: Bearer …)         1. MCP_TOKEN unset → 404 (endpoint off)
                                    2. bad/missing token → 401
                                    3. new McpServer per request (stateless) + transport
                                         │
                       lib/mcp/server.ts ─┤ registers tools
                                         ├─ write tools → lib/logging/quickActions.ts
                                         │                → dayLogSchema.parse → upsertDayLog
                                         └─ read tools  → lib/cycleView/load.ts
                                                          → computeEverything (same as Today)
```

The PIN screen lock is a separate, browser-only credential and is not involved: the MCP
token is its own credential. Neither weakens the other.

## Tools

All tools return `structuredContent` (validated against an `outputSchema`) plus the same JSON
as a `text` content block for clients that ignore structured output. Errors return
`isError: true` with a plain-language message (never a stack trace).

**Every response is wrapped in the same time context** (decided 2026-11-14):

```jsonc
{
  "timeZone": "Asia/Bangkok",             // the zone this answer was computed in
  "timeZoneSource": "profile",            // "input" | "profile" | "fallback_utc"
  "today": "2026-11-14",                  // the user's local calendar day
  "now": {
    "utc": "2026-11-14T04:30:00.000Z",
    "local": "2026-11-14T11:30:00.000+07:00"
  },
  "data": { /* tool-specific result */ }
}
```

All calendar days inside `data` (`YYYY-MM-DD`) are the user's local days in `timeZone`; all
instants (e.g. `updatedAt`) are given as `{ utc, local }` pairs. When `timeZoneSource` is
`fallback_utc` the tool description tells the client to say so and suggest passing
`timeZone`.

Shared input conventions:

- `timeZone` — optional IANA name on every tool (e.g. while travelling); overrides the profile
  zone for that call only.
- `date` — optional `YYYY-MM-DD`; defaults to `today` in the resolved zone; must be a valid
  civil date, **not in the future** (in that zone).
- Enum values are exactly the app's own lists (`MoodId`, `SymptomId`, `FlowLevel`); each enum
  value is described with its in-app label so the client can map "headache" → `headache`,
  "sad" → `sad`.

### Write tools (annotations: `readOnlyHint: false`, `destructiveHint: false`, `idempotentHint: true`)

Every write merges into that day's existing log (all other recorded facts are kept — the R7
rule `components/dashboard/quickLog.ts` already implements), validates with `dayLogSchema`,
saves with `upsertDayLog`, and returns (inside the time envelope)
`{ date, dayLog, updatedAt: { utc, local }, status: <get_today data> }`.

| Tool | Input | Behaviour |
|---|---|---|
| `log_period_start` | `date?` | Day becomes a period day and the first day (`periodBoundary: "start"`). |
| `log_period_day` | `date?`, `flow?: FlowLevel` | Day becomes a period day; sets flow if given. ("Still on my period.") |
| `log_period_end` | `date?` | With `date`: that day is marked the last day (`periodBoundary: "end"`, period day). Without `date`: today if today is a period day; otherwise the last recorded period day of the open period (the same rule as Today's "Ended …" button, `quickPeriodStatus`). If there is no open period → error "No ongoing period found to end — it may already be marked as ended (see get_today)." |
| `log_spotting` | `date?` | Day becomes spotting (`bleeding: "spotting"`), which never starts or extends a period (existing engine rule). Clears `flow` and `periodBoundary` (period-only fields). If the day was a period day, the result says it was changed from period to spotting. |
| `log_mood` | `moods: MoodId[]` (≥1), `mode?: "add" \| "remove"` (default `add`), `date?` | Adds/removes exactly those moods. Never toggles, so a client retry cannot undo a save. |
| `log_symptoms` | `symptoms: SymptomId[]` (≥1), `mode?`, `date?` | Same, for symptoms. Tier C symptoms are accepted only if enabled in Settings. |
| `log_nothing_to_report` | `date?` | Records the day as a true negative. **Refuses** if the day already has any recorded data (it would replace it) — error explains and suggests the specific log tools instead. |

### Read tools (annotations: `readOnlyHint: true`)

| Tool | Answers | Returns |
|---|---|---|
| `get_today` | "What cycle day is it?" | `date`, `cycleDay` (null before any period), `phase` (only when fertility features are on and the engine computed one; labelled estimate), `periodToday`, `ongoingPeriod` (`{ startDate, lastRecordedDay }` or null), `loggedToday` (bleeding, flow, moods, symptoms, nothingToReport). |
| `get_next_period` | "When is my period due?" | `range: { from, to }` (null when the engine cannot estimate), `confidence` (label + reason, from `lib/copy`), `basedOnCycles`, `predictionKind` (`personal` / `population_estimate` / `none`), `daysUntilRange`, `overdueByDays`, `note: "This is an estimate. Always present it as a range, never a single date."` **No single centre date is returned** (SPEC R8: never a bare date). |
| `get_period_length` | "How long will my period last?" | `typicalDuration: { low, high, basedOnPeriods }` from `stats.periodDuration` (or the user's onboarding answer, flagged as self-reported, when no completed period exists); `current`: if a period is ongoing → `{ startDate, daysSoFar, expectedToContinueThrough: { from, to } \| null }` (the engine's `expectedPeriodRange`). |
| `get_cycle_stats` | "How regular am I?" | `typicalCycleLength: { low, high, basedOnCycles }`, `variability` (the engine's own sentence), `completedCycles`. |
| `get_fertile_window` | "When is my fertile window?" | Only if fertility features are enabled; otherwise a clear "not enabled in Settings" result. Returns fertile and ovulation ranges plus `FERTILITY_DISCLAIMER` **verbatim**. |
| `get_insights` | "Any patterns in my symptoms?" | The engine's insights (headline, body, detail counts, supporting dates, `replicatedLastCycle`) plus `INSIGHT_DISCLAIMER` verbatim. Exactly what the app shows; nothing added. |
| `get_pattern_data` | "When does my mood usually change?" · "What should I expect around my next period?" | See below. |
| `get_history` | "What did I log last week?" | Day logs in `{ from, to }` (both required, `to ≥ from`, at most 366 days). |
| `get_health_notes` | — | Active health-awareness messages, verbatim, with severity and cited source. `seek_urgent_care` items are listed first. |

### `get_pattern_data` — the data behind forecasts

Purpose: give the AI client the user's own cycle-aligned counts so it can forecast ("you
usually log irritability in the week before your period → expect it around Nov 25 – Dec 8")
with the evidence attached. The server only counts and does date arithmetic.

**Symptoms** come straight from the engine's existing `stats.symptomsByCycleDay` (no new
logic). **Moods** are not analysed anywhere today, so a new pure function
`computeMoodsByCycleDay(cycles, dayLogs)` is added next to it, reusing the engine's own
`classifyCycleDay` and windows unchanged.

Windows (the engine's cited constants, `lib/engine/constants.ts` — not new numbers):

| Window | Offsets | Anchor |
|---|---|---|
| `premenstrual` | −7 … −1 | days before the next period start |
| `mid_luteal` | −11 … −8 | days before the next period start |
| `menstrual` | 1 … 4 | day of the period |
| `follicular_reference` | 4 … 10 (non-bleeding days only) | day of the cycle |

Days outside these windows are not counted (the engine does not define them; adding windows
would need a research citation first — see `docs/research/`).

Counting rules (identical for symptoms and moods):

- Only completed cycles (a known next start) contribute, as in `symptomsByCycleDay`.
- **Symptom known-day rule** (existing): a day is known for a symptom if the symptom was
  logged, or the day was marked nothing-to-report.
- **Mood known-day rule** (new, stated in the code): a day is known for moods only if at least
  one mood was logged that day; nothing-to-report says nothing about mood.

Output:

```jsonc
{
  "basedOnCycles": 8,                       // completed cycles considered
  "minimumCyclesForPatterns": 3,            // engine's MIN_CYCLES_TO_SHOW_ANYTHING
  "nextPeriod": { "from": "2026-12-02", "to": "2026-12-09", "confidence": "More consistent" },
  "currentPeriod": { "startDate": "2026-11-14" } ,   // or null
  "patterns": [
    {
      "item": "irritability", "kind": "symptom", "label": "Irritability",
      "window": "premenstrual",
      "days": [
        { "offset": -7, "logged": 5, "knownDays": 7, "cycles": 7,
          "upcoming": { "from": "2026-11-25", "to": "2026-12-02" } }
        // … one entry per offset that has knownDays > 0
      ]
    },
    {
      "item": "low", "kind": "mood", "label": "Low", "window": "menstrual",
      "days": [ { "offset": 1, "logged": 4, "knownDays": 6, "cycles": 6,
                  "upcoming": { "from": "2026-12-02", "to": "2026-12-09" },
                  "currentPeriod": "2026-11-14" } ]
    }
  ],
  "note": "Counts from the user's own logs, not a medical prediction. Dates are ranges because the next period date is an estimate."
}
```

Date projection (deterministic, so the client never does date maths):

- Backward offset `o` (negative): `upcoming = { from: next.from + o, to: next.to + o }`.
- Forward offset `o`: `upcoming = { from: next.from + (o − 1), to: next.to + (o − 1) }`, and, if a
  period is ongoing and that day is today or later, `currentPeriod = start + (o − 1)` (exact).
- `upcoming` is omitted when there is no next-period range.

Input: optional `items?: (SymptomId | MoodId)[]` filter; optional `minKnownDays?` (default 1).

**Tool description must instruct the client** (this is the guardrail, since forecasting
happens there):

1. Base every forecast on these counts, and quote them ("5 of 7 logged days, 8 cycles").
2. Always give dates as ranges; the next period date is itself an estimate.
3. If `basedOnCycles < minimumCyclesForPatterns`, or `knownDays` is small, say the pattern
   is weak.
4. No medical explanations (hormones, diagnoses, treatments) and no health advice.
5. Say it comes from the user's own records.

## Commands

```
Dev:          pnpm dev
Typecheck:    pnpm typecheck
Lint:         pnpm lint
Unit tests:   pnpm test                       (vitest run)
One area:     pnpm exec vitest run lib/mcp lib/logging lib/engine
Build:        pnpm build
Inspector:    npx @modelcontextprotocol/inspector   → Streamable HTTP, http://localhost:3101/api/mcp,
              header "Authorization: Bearer $MCP_TOKEN"
Client (Claude Code):
  claude mcp add --transport http cycle https://<host>/api/mcp \
    --header "Authorization: Bearer <MCP_TOKEN>"
Token:        openssl rand -base64 32   → MCP_TOKEN in .env.local / hosting env
```

## Project structure

```
app/api/mcp/route.ts            → transport + auth only (GET/POST/DELETE per spec; stateless)
lib/mcp/auth.ts                 → bearer check: constant-time compare, 404 when MCP_TOKEN unset
lib/mcp/server.ts               → builds McpServer, registers all tools
lib/mcp/tools/write.ts          → write-tool handlers (I/O at the edges)
lib/mcp/tools/read.ts           → read-tool handlers
lib/mcp/present.ts              → pure EngineResult/DayLog → tool output mappers (unit-tested)
lib/mcp/patterns.ts             → get_pattern_data assembly + date projection (pure, tested)
lib/logging/quickActions.ts     → MOVED from components/dashboard/quickLog.ts (+ test);
                                  adds explicit on/off for mood/symptom actions; Today imports it
lib/cycleView/load.ts           → guard-free data load extracted from app/loadCycleView.ts
                                  (pages keep the PIN guard + onboarding redirect around it);
                                  takes the resolved time zone, returns today with it
lib/time/userTimeZone.ts        → resolve + validate the user's zone (input → cookie → profile → UTC)
lib/time/instant.ts             → { utc, local } formatting for instants in a zone (pure, tested)
app/api/time-zone/route.ts      → POST: validate, set `tz` cookie, store profile.time_zone
components/providers/TimeZoneSync.tsx → reports the browser zone when it changes; refreshes
lib/db/schema.ts + drizzle/     → profile.time_zone, day_logs.updated_at (additive migration)
lib/db/client.ts                → mysql2 pool `timezone: "Z"`
app/{page,history,report,calendar}, app/api/compute, components/settings, onboarding
                                → replace host-zone "today" with the resolved user zone
lib/engine/stats.ts             → + computeMoodsByCycleDay (pure); classifyCycleDay exported
docs/MCP-SPEC.md                → this file
docs/DECISIONS.md               → new DEC entry: MCP endpoint, token auth, the dependency
```

## Code style

Match the existing code: pure logic in `lib/` with a colocated `*.test.ts`, I/O only at the
route/handler edge, civil dates only (SPEC R1 — no `new Date()` arithmetic), copy from
`lib/copy` rather than new prose, comments that say *why*.

```ts
// lib/mcp/tools/write.ts — shape of every write tool
server.registerTool(
  "log_mood",
  {
    title: "Log mood",
    description: "Add or remove moods for a day (default today). Merges with what's already logged.",
    inputSchema: { moods: z.array(moodId).min(1), mode: z.enum(["add", "remove"]).default("add"), date: pastOrToday.optional() },
    outputSchema: writeResult,
    annotations: { readOnlyHint: false, destructiveHint: false, idempotentHint: true },
  },
  async ({ moods, mode, date }) => {
    const view = await loadView();                       // same data the app uses
    const day = date ?? view.today;
    let log = view.logs.get(day);
    for (const mood of moods) log = applyQuickAction(log, { kind: "mood", mood, on: mode === "add" }, day, view.today);
    const saved = await upsertDayLog(dayLogSchema.parse(log));  // same validation + save as POST /api/day-logs
    return result(await writeResult(saved));
  },
);
```

## Testing strategy

- **Unit (vitest, colocated):**
  - `quickActions.test.ts`: existing cases kept, plus explicit add/remove idempotency (adding
    twice = once; removing an absent mood = no-op).
  - `stats.test.ts`: `computeMoodsByCycleDay` (known-day rule, windows, completed cycles only,
    backward-wins tie), and `symptomsByCycleDay` unchanged.
  - `patterns.test.ts`: date projection for backward/forward offsets, the ongoing-period exact
    date, no `upcoming` without a range, filtering.
  - `present.test.ts`: `get_next_period` never emits a single date; null range handled;
    disclaimers emitted verbatim; fertility tool off when disabled.
  - `auth.test.ts`: unset token → 404, wrong/missing → 401, correct → passes; comparison is
    constant-time.
  - `userTimeZone.test.ts`: resolution order, invalid zones ignored, UTC fallback flagged;
    `today` for the same instant differs correctly across zones (e.g. 2026-11-13T23:30Z is
    Nov 14 in Asia/Bangkok, Nov 13 in America/New_York), including a DST boundary.
  - `instant.test.ts`: `{ utc, local }` formatting with correct offsets (incl. +05:45, DST).
  - Every MCP response carries `timeZone`, `timeZoneSource`, `today`, `now`.
  - A grep-style test (like `no-remote-origin.test.ts`) fails if server code under `app/` or
    `lib/` calls `resolvedOptions().timeZone`.
  - Write handlers: future date rejected; `log_period_end` with no open period → error;
    `log_nothing_to_report` refuses a non-empty day; existing fields preserved.
- **End-to-end (manual, recorded in the PR):** MCP Inspector against the throwaway seeded DB:
  list tools, call every tool, confirm saved rows in MySQL and that the app's Today screen
  shows the same values the tools return.
- Existing suites (`engine-purity.test.ts`, `no-remote-origin.test.ts`, all 880 tests) must
  stay green.

## Boundaries

- **Always:** validate every write with `dayLogSchema`; merge, never replace, recorded data;
  return predictions as ranges with their confidence; pass disclaimers and health messages
  through verbatim; keep tool handlers thin over pure, tested functions; reject future dates.
- **Ask first:** changing the privacy statement wording (`lib/copy/general.ts`,
  `docs/PRIVACY.md`); any dependency beyond `@modelcontextprotocol/sdk`; any new engine
  window or constant; adding destructive tools; OAuth.
- **Never:** use the host's time zone for anything; store a calendar day as an instant (or an
  instant in anything but UTC); answer without stating the time zone used;
  delete or clear data via MCP; return a single predicted date; generate mood or
  symptom predictions server-side; add health advice; log or echo the token; expose the PIN,
  security or delete-all endpoints through MCP; change engine constants.

## Success criteria

1. With `MCP_TOKEN` unset, `/api/mcp` returns 404; with a wrong token, 401; with the right
   token, MCP Inspector lists all 16 tools with input/output schemas.
2. "My period started today" via `log_period_start` produces exactly the same `day_logs` row
   as tapping "Period started today" on Today.
3. `log_mood` / `log_symptoms` called twice with the same input leave the day unchanged
   after the first call.
4. `log_period_end` with no date closes the open period the same way Today's "Ended …"
   button does; with no open period it errors without writing.
5. No tool output contains a lone predicted date; every prediction has a range and
   confidence, and fertility data appears only when enabled, with its disclaimer.
6. `get_pattern_data` symptom counts equal the engine's `symptomsByCycleDay` for the same
   data; mood counts follow the stated known-day rule; projected dates match the formulas
   above.
7. With the server process in UTC and the browser in UTC+7 at 06:00 local, Today shows the
   local date, and a quick-log tap and MCP `log_mood` (no `date`) both save to the local
   date; the stored `updated_at` is the UTC instant.
8. Every MCP response states `timeZone`, `timeZoneSource`, `today` and `now` (UTC + local);
   with no cookie, profile zone or input it falls back to UTC and says so.
9. Existing data needs no migration beyond the two additive columns; no calendar day changes
   value.
10. Typecheck, lint, all tests (existing + new) and the production build pass.

## Open questions

1. ~~Time zone for "today"~~ — decided 2026-11-14: Part A (UTC server/DB, browser zone,
   profile fallback, time envelope on every MCP response).
2. ~~Privacy statement~~ — decided 2026-11-14: update `PRIVACY_STATEMENT`
   (`lib/copy/general.ts`) and `docs/PRIVACY.md` with the draft below; **the user reviews the
   final wording before merge**. Both texts must stay identical and keep passing
   `lib/copy/privacyClaims.test.ts` (no "secure", "encrypted", "private-by-design" claims).
   - Append as a new third paragraph:
     > If you set an access token for this app's MCP endpoint (MCP_TOKEN), an AI assistant
     > you connect — such as Claude or Cursor — can read everything you've recorded and add
     > new entries. Whatever it reads is sent to that assistant's provider and handled under
     > your account and their terms, not by this app. Anyone who has the token has the same
     > access, so treat it like a password, and remove MCP_TOKEN to switch the endpoint off.
     > With no token set, the endpoint is off.
   - Also correct the now-false sentence "This app has no lock screen," to: "This app's
     optional PIN only hides its screens in this browser; it does not encrypt your data or
     protect the database." (The PIN screen lock shipped after the statement was written.)
3. ~~Spotting~~ — decided: `log_spotting` is in v1 (16 tools).
4. ~~Hosting~~ — decided: Vercel. Nothing may depend on the host time zone either way;
   the server is treated as UTC wherever it runs.

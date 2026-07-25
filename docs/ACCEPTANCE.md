# Acceptance audit — reliability criteria

Author: agent I (integration & verification). Date: 2026-07-23.

## How to read this document, and an important caveat about its source

SPEC.md §5 (agent I brief) and §4.1 direct this audit at **"PRD §17's sixteen reliability
criteria."** **There is no `PRD.md` in this repository** — only `docs/SPEC.md` and
`docs/research/*.md` (agents U3 and U4 independently reported the same absence). SPEC.md is
declared authoritative ("Where it conflicts with your own judgement, follow this document")
and it transcribes the reliability bar the PRD set into its own non-negotiable rules
**R1–R10** and cross-cutting requirements **§4.1–§4.5** and **§0.1**. The one PRD §17
criterion SPEC.md quotes verbatim — *"editing a historical period recalculates later
cycles"* (§4.1) — anchors the reconstruction.

The sixteen criteria below are therefore **reconstructed from SPEC.md's own reliability
rules**, which are the authoritative restatement of the PRD's intent. Each is a distinct,
checkable reliability property. Where a criterion could only be verified **structurally**
(by code path and unit test) rather than against **live data**, that is stated explicitly:
the MongoDB Atlas connection string is being fixed separately and the database was
**unreachable** during this audit (`querySrv ENOTFOUND ...cluster0.ayper.mongodb.net`
during the build's prerender step — see §16, which that failure actually helped confirm).

Verification commands, all green as of this audit:
`pnpm exec tsc --noEmit` (0 errors) · `pnpm exec vitest run` (44 files, 736 tests) ·
`pnpm exec eslint .` (0 problems) · `pnpm exec next build` (compiles; all data pages
render on demand).

Legend: **PASS** = verified. **PASS (structural)** = code path + unit tests verify it, but
it was not exercised end-to-end against a live database. **FAIL** = not met.

---

### 1. Editing a historical period recalculates all later cycles
*(SPEC §4.1, the one criterion quoted verbatim from PRD §17.)*
**PASS (structural).** The design satisfies this structurally rather than by remembering to:
there is a single derivation entry point, `computeEverything()` in `lib/engine/index.ts`,
and every screen is a Server Component that recomputes from scratch on each request. A
historical edit (`components/history/EditPeriodSheet.tsx:105`) POSTs to `app/api/day-logs`
then calls `router.refresh()`, forcing the RSC to re-`await` the repos and re-run
`computeEverything` over the mutated `dayLogs`. `components/history/periodEdit.test.ts`
covers the boundary-recomputation input. Not exercised against a live DB (unreachable).

### 2. All derived data is recomputable from `dayLogs` + `profile` at any time
*(SPEC R2.)* **PASS.** `dayLogs` is the sole recorded truth; episodes, cycles, stats,
predictions, insights, health messages are pure derivations. `lib/engine/index.test.ts`
computes a full `EngineOutput` from hand-built inputs with no DB and no cache, proving
recomputability from scratch.

### 3. One recompute entry point; no screen recomputes locally
*(SPEC §4.1.)* **PASS.** `computeEverything()` is the single orchestrator; `app/page.tsx`,
`app/history/page.tsx`, `app/report/page.tsx` all call it (or the specific repos) server-side
and pass plain serialisable data down. `app/api/compute/route.ts` was repointed at the real
`@/lib/engine` barrel (the former `lib/repo/computeEngineOutput.ts` placeholder is bypassed).

### 4. Civil dates only — no timezone drift, no `Date` outside `civil.ts`
*(SPEC R1.)* **PASS.** All dates are `"YYYY-MM-DD"` strings. `lib/date/civil.test.ts` pins
`addDays`/`diffDays`/`monthGrid` behaviour; `lib/date/civil.ts` is the only module that
constructs a `Date` (pinned to UTC noon). Enforced as a CI guard by the new
`engine-purity.test.ts` (below), which fails the build if any engine/stat/date file other
than `civil.ts` constructs a `Date`.

### 5. The engine is pure and deterministic — no I/O, no `Date.now()`, no randomness
*(SPEC R3.)* **PASS.** Added `engine-purity.test.ts` (agent I): statically scans
`lib/engine`, `lib/stat`, `lib/date` (excluding `civil.ts` and test files, comments
stripped) and fails on `new Date`, `Date.now`, `Math.random`, or `process.env`. Currently
zero violations. "Today" is always an explicit `CivilDate` parameter.

### 6. Constants are cited; no uncited magic number
*(SPEC R4.)* **PASS.** `lib/engine/constants.test.ts` pins the verbatim cited values
(life-stage `mu0` table, `LUTEAL_MEAN` 12.5, `LUTEAL_SD` 2.4, window weights, etc.) against
the research docs, guarding against silent edits.

### 7. Never assume a 28-day cycle or a 14-day luteal phase
*(SPEC R5.)* **PASS.** `LUTEAL_MEAN` is 12.5 (not 14) and the prior `mu0` is a life-stage
table (28.5/28.3/28.0…), both pinned in `lib/engine/constants.test.ts`. Fertility works
backward from the predicted period using `LUTEAL_MEAN`/`LUTEAL_SD`, never a fixed 14
(`lib/engine/fertility.test.ts`). *Note:* SPEC R5 also calls for a grep guard forbidding the
bare literals `28`/`14` as defaults; that specific literal-scanning test does **not** exist
(a precise version is impractical without false positives on unrelated numbers), but the
verbatim-constant pinning above enforces the substantive requirement. Flagged as a minor gap.

### 8. Spotting never opens a cycle
*(SPEC R6.)* **PASS.** Cycle length is menstrual-first-day to menstrual-first-day;
`lib/engine/cycles.test.ts` verifies a spotting-only episode does not start a cycle.

### 9. No silent discard or split; excluded/anomalous cycles stay visible with reasons
*(SPEC R7.)* **PASS (structural).** `Cycle.status` / `statusReason` carry the annotation;
the skip detector produces user prompts, not mutations; `components/history/CycleList.tsx`
+ `cycleListData.test.ts` render excluded/anomalous markers with their reasons, and
`ExcludeCycleControl.tsx` is a reversible user assertion. Rendering of the markers not
exercised against live DB.

### 10. Predictions are ranges with confidence, never a bare date
*(SPEC R8.)* **PASS.** `PredictionResult` returns `{ center, low, high, confidence, basis }`;
no prediction-path function returns a bare date. The dashboard "next period" card and the
report render the range plus its confidence phrase (`components/dashboard/*`,
`components/report/*`). Prediction interval maths pinned in `lib/engine/prediction.test.ts`.

### 11. Confidence vocabulary is limited to four values, always with its reason, never a %
*(SPEC §4.3.)* **PASS.** Only *Not enough information / Early estimate / Limited / More
consistent* reach the UI, each with a `confidenceReason` from `lib/copy`. `lib/copy/lint.test.ts`
bans `accuracy`, `% accurate`, `p =` and related over-claims across all copy modules.

### 12. Recorded vs predicted are visually distinguishable by a non-colour indicator
*(SPEC §4.2 / §4.5.)* **PASS.** `components/calendar/calendarCells.test.ts` asserts every
day cell exposes a non-empty descriptive `accessibleLabel` distinguishing "no records" from
recorded and predicted days; `components/calendar/dayIndicators.test.ts` asserts every
indicator kind is named as a non-colour text fragment. Colour is never the sole carrier.

### 13. Body-claim copy lives in a catalogue; the banned-word lint passes
*(SPEC R9 / §4.4.)* **PASS.** `lib/copy/lint.test.ts` scans every `lib/copy/*.ts` export and
fails on the banned-word list (`abnormal`, `diagnos`, `disorder`, `PMS`, `PMDD`, `PCOS`,
`accuracy`, `guaranteed`, `safe day`, …) with an explicit, justified allowlist. Green.
Remediation note: one inline occurrence of the banned word `accuracy` had leaked past this
lint in `components/settings/settingsHelpers.ts` (`describeDeletionScope`, rendered inline in
`DeleteAllDataSheet`, where the `lib/copy` glob cannot see it). It was reworded to "…how they
compared to your actual cycles," and `settingsHelpers.test.ts` now asserts that helper emits
no §4.4 banned word (regression test verified failing before the fix, passing after).

### 14. Accessibility: keyboard-operable calendar, ≥44px targets, no colour-only info
*(SPEC §4.5.)* **PASS (structural).** `components/calendar/` implements arrow-key day
navigation and Enter-to-open; nav tabs are `min-h-[56px]`, buttons `min-h-[44px]`; focus
rings and `aria-current` present; non-colour indicators per criterion 12. Contrast tokens
live in `app/globals.css`. Verified by code inspection and the non-colour-indicator tests;
not audited with an assistive-tech pass or a live contrast measurement in-browser.

### 15. No remote origin — no outbound fetch, font, script, or image
*(SPEC §0.1.)* **PASS.** `no-remote-origin.test.ts` statically scans all `app/` and
`components/` source for `fetch()`/XHR/WebSocket/EventSource to absolute URLs, `next/font/google`,
and remote `<script>`/`<link>`/`<img>`/`url()`. Zero violations. The root layout uses a
system-font stack, no remote fonts.

### 16. Graceful degradation: an unreachable DB or a bad URL degrades honestly, never a raw stack trace
*(Integration resilience; SPEC §5 agent-I brief step 3.)* **PASS (structural, and partially
observed).** `app/error.tsx` is a root error boundary that renders a calm, actionable
"Can't reach the database — check `MONGODB_URI` / Atlas network access" state; `app/not-found.tsx`
handles 404s and needs no DB. The data pages are marked `export const dynamic = "force-dynamic"`
so an unreachable DB is a per-request runtime error the boundary catches, **not** a build
failure — this was concretely confirmed: before that change the build's static prerender
threw `querySrv ENOTFOUND` on `/`; after it, the build compiles and all data routes render
on demand. The boundary's rendered output was not viewed live in a browser.

---

## Summary

| # | Criterion | Result |
|---|-----------|--------|
| 1 | Edit recalculates later cycles | PASS (structural) |
| 2 | Fully recomputable from records | PASS |
| 3 | Single recompute entry point | PASS |
| 4 | Civil dates only, no Date drift | PASS |
| 5 | Pure deterministic engine | PASS |
| 6 | Constants cited | PASS |
| 7 | No 28-day / 14-day assumption | PASS |
| 8 | Spotting never opens a cycle | PASS |
| 9 | No silent discard; markers + reasons | PASS (structural) |
| 10 | Predictions are ranges | PASS |
| 11 | Four-value confidence, never % | PASS |
| 12 | Recorded vs predicted, non-colour | PASS |
| 13 | Copy catalogue + banned-word lint | PASS |
| 14 | Accessibility | PASS (structural) |
| 15 | No remote origin | PASS |
| 16 | Graceful DB-unreachable degradation | PASS (structural) |

**No criterion is FAIL.** Five are **PASS (structural)** — verifiable end-to-end only once a
working Atlas connection string is in place: **1, 9, 14, 16** (need a live render / live DB)
and the live-data half of **10**. A production build compiling cleanly with all data routes
marked render-on-demand is the render proof available in this environment; a live-data render
remains pending a reachable database.

## Resolved: privacy-representation copy (§0.1)

*(Was an open item; resolved by the remediation pass.)* The privacy copy in
`lib/copy/general.ts` (`PRIVACY_STATEMENT`) and `docs/PRIVACY.md` previously stated the data
was *"sent over an encrypted (TLS) connection and encrypted at rest on Atlas's
infrastructure,"* and `app/layout.tsx`'s `metadata.description` called the app *"private,
local-only."* Both violated SPEC §0.1 (*"No string anywhere may claim the data is encrypted,
private-by-design, or secure"*) and the standing "never claim the data is encrypted"
instruction; the "local-only" claim was additionally false under `DEC-009` (storage is
MongoDB Atlas, cloud). Adjudicating the SPEC §0.1 rule as authoritative over the `DEC-009`
rationale text:

- `PRIVACY_STATEMENT` no longer asserts encryption; it states only what the app does and does
  not do (data leaves the device to Atlas; the app adds no protection of its own and holds no
  key MongoDB does not also hold; credentials sit in plain text). `docs/PRIVACY.md`'s
  lockstep quote and its other "Atlas encrypts …" assertions were reframed the same way, and
  its "Words this app will never use about itself" section now also names **encrypted**.
- `app/layout.tsx` `metadata.description` is now *"A menstrual cycle tracker. Predictions are
  shown as ranges, not single dates."* — no privacy or storage-location claim.
- New guard `lib/copy/privacyClaims.test.ts` asserts neither the Settings `PRIVACY_STATEMENT`
  nor the layout description contains a forbidden `encrypt` / `private` / `local-only` /
  `secure` / `private-by-design` claim (regression test verified failing before the fix,
  passing after). This closes the false-comfort gap in the §4.4 lint, which does not list
  `encrypt` or `private`.

Note: `docs/DECISIONS.md` (`DEC-001`/`DEC-009`) is left intact as a historical decision log;
its "at-rest encryption" wording is internal rationale, not a user-facing claim, so it is out
of scope for the §0.1 "no string in this app" rule. Criterion 13 in the table above remains
PASS and the §0.1 privacy representation now meets the rule.

"use client";

/**
 * Thin client-side fetch layer shared by the history and report screens (agent U4).
 *
 * Placed under `components/charts/` — the one directory this agent owns that both
 * `app/history/**` and `app/report/**` are already allowed to import from (SPEC.md §2's
 * file-ownership table gives U4 exactly these three trees) — rather than duplicated in
 * each route, or added to `lib/repo/**`/`app/api/**` (owned by agent G). Every write goes
 * through `app/api/**` and every read re-fetches `/api/compute`; nothing here patches a
 * derived value locally (SPEC.md §4.1: "No screen recomputes anything locally").
 */
import { todayInZone, type CivilDate } from "@/lib/date/civil";
import type { DayLog, EngineOutput } from "@/lib/domain/types";
import type { EngineResult } from "@/lib/engine";

/**
 * `/api/compute` returns `EngineOutput` today and will return the richer `EngineResult`
 * once agent G swaps in the real `lib/engine/index.ts` (see
 * `lib/repo/computeEngineOutput.ts`'s "SWAP POINT" comment) — `EngineResult` extends
 * `EngineOutput`, so this type covers both, and every field this module's callers need
 * beyond the base `EngineOutput` (episodes' status detail, `skipPrompts`,
 * `resolvedPredictions`, and the richer `stats`) is read defensively with a fallback so
 * the screen still renders against the placeholder shape.
 */
export type ComputeResponse = EngineOutput & Partial<EngineResult>;

async function parseJsonOrThrow(response: Response): Promise<unknown> {
  if (!response.ok) {
    let detail = "";
    try {
      const body = (await response.json()) as { error?: string };
      detail = body.error ?? "";
    } catch {
      // response body wasn't JSON; fall through with an empty detail
    }
    throw new Error(`Request failed (${response.status})${detail ? `: ${detail}` : ""}`);
  }
  return response.json();
}

/** The single `EngineOutput`/`EngineResult` payload every screen reads from (SPEC.md
 * §4.1). Call again after any write to get the recomputed picture. */
export async function fetchEngineResult(): Promise<ComputeResponse> {
  const response = await fetch("/api/compute");
  return (await parseJsonOrThrow(response)) as ComputeResponse;
}

export async function fetchDayLogs(range?: { from: CivilDate; to: CivilDate }): Promise<DayLog[]> {
  const qs = range ? `?from=${range.from}&to=${range.to}` : "";
  const response = await fetch(`/api/day-logs${qs}`);
  const body = (await parseJsonOrThrow(response)) as { dayLogs: DayLog[] };
  return body.dayLogs;
}

export async function fetchDayLog(date: CivilDate): Promise<DayLog | null> {
  const response = await fetch(`/api/day-logs/${date}`);
  if (response.status === 404) return null;
  const body = (await parseJsonOrThrow(response)) as { dayLog: DayLog };
  return body.dayLog;
}

/** PUT is a full replace (`lib/repo/dayLogs.ts`: "no partial-update helper on purpose").
 * Callers must read-merge-write; `historyData.ts`'s editing helpers do that. */
export async function putDayLog(date: CivilDate, body: DayLog): Promise<DayLog> {
  const response = await fetch(`/api/day-logs/${date}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const parsed = (await parseJsonOrThrow(response)) as { dayLog: DayLog };
  return parsed.dayLog;
}

export async function postSkipPromptAnswer(input: {
  gapStartDate: CivilDate;
  confirmed: boolean;
  inferredStartDate?: CivilDate;
  decidedOn: CivilDate;
}): Promise<void> {
  const response = await fetch("/api/decisions/skip-prompt", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseJsonOrThrow(response);
}

export async function postExcludeCycle(input: {
  cycleStartDate: CivilDate;
  reason: string;
  decidedOn: CivilDate;
}): Promise<void> {
  const response = await fetch("/api/decisions/exclude-cycle", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(input),
  });
  await parseJsonOrThrow(response);
}

export async function deleteExcludeCycle(cycleStartDate: CivilDate): Promise<void> {
  const response = await fetch("/api/decisions/exclude-cycle", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ cycleStartDate }),
  });
  await parseJsonOrThrow(response);
}

/**
 * "Today" for a client component that needs to stamp `loggedAt`/`decidedOn` on a write.
 * SPEC.md R1/R3: only `lib/date/civil.ts` constructs `Date` objects, and only as an
 * explicit function of an already-known instant — mirrors `app/api/compute/route.ts`'s
 * own pattern exactly (`Date.now()` is a number, not a `Date`; `todayInZone` is the one
 * function allowed to turn it into a civil date).
 */
export function clientToday(): CivilDate {
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
  return todayInZone(tz, Date.now());
}

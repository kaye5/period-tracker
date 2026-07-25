import { NextRequest, NextResponse } from "next/server";
import { isValid as isValidCivilDate, type CivilDate } from "@/lib/date/civil";
import { listDayLogs } from "@/lib/repo/dayLogs";
import { getProfileOrDefault } from "@/lib/repo/profile";
import type { DayLog } from "@/lib/domain/types";
import { handleUnexpected, jsonError } from "@/app/api/_lib/http";
import { requireApiUnlock } from "@/lib/security/guard";

/**
 * GET /api/export — selective-inclusion export of recorded data (SPEC.md's G brief:
 * "Export endpoint must support selective inclusion so sexual-activity and fertility
 * fields can be excluded, per the PRD").
 *
 * Query params:
 *   from, to               — optional YYYY-MM-DD range (both or neither)
 *   format                 — "json" (default) | "csv"
 *   includeFertility       — default true; false strips the `fertility` field
 *   includeSexualActivity  — default true; false strips `bleedingContext`
 *   includeProfile         — default false; true also returns the profile (JSON only)
 *
 * Field-exclusion note: lib/domain/types.ts's `DayLog` has no single dedicated "sexual
 * activity" field — the only signal of that kind it carries is
 * `bleedingContext === 'postcoital'`. `includeSexualActivity=false` therefore strips the
 * whole `bleedingContext` field (not just the 'postcoital' value), because a
 * partially-redacted context field would itself leak information by omission (a present
 * but non-'postcoital' context reveals that intercourse was *not* noted that day, which
 * is exactly the kind of inference the PRD's exclusion option exists to prevent).
 * Flagged in this agent's final report — if a first-class sexual-activity field is added
 * to DayLog later, this scrub logic should be revisited.
 */
function scrubDayLog(
  log: DayLog,
  opts: { includeFertility: boolean; includeSexualActivity: boolean },
): DayLog {
  const clone: DayLog = { ...log };
  if (!opts.includeFertility) delete clone.fertility;
  if (!opts.includeSexualActivity) delete clone.bleedingContext;
  return clone;
}

const CSV_HEADERS = [
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
  "painSites",
  "interferedWith",
  "painkillerDidNotHelp",
  "symptoms",
  "nothingToReport",
  "mood",
  "notes",
  "loggedAt",
] as const;

function csvEscape(value: unknown): string {
  if (value === undefined || value === null) return "";
  const s = Array.isArray(value) ? value.join(";") : String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

function toCsv(logs: DayLog[]): string {
  const rows = logs.map((l) =>
    [
      l.date,
      l.bleeding,
      l.flow,
      l.bleedingContext,
      l.periodBoundary,
      l.clots,
      l.productChanges,
      l.fastestProductChangeHours,
      l.doubleProtection,
      l.nightChange,
      l.leakThrough,
      l.pain.severity,
      l.pain.sites,
      l.pain.interferedWith,
      l.pain.painkillerDidNotHelp,
      l.symptoms,
      l.nothingToReport,
      l.mood,
      l.notes,
      l.loggedAt,
    ]
      .map(csvEscape)
      .join(","),
  );
  return [CSV_HEADERS.join(","), ...rows].join("\n");
}

export async function GET(request: NextRequest) {
  const locked = await requireApiUnlock();
  if (locked) return locked;
  try {
    const { searchParams } = new URL(request.url);
    const from = searchParams.get("from");
    const to = searchParams.get("to");
    const format = searchParams.get("format") === "csv" ? "csv" : "json";
    const includeFertility = searchParams.get("includeFertility") !== "false";
    const includeSexualActivity = searchParams.get("includeSexualActivity") !== "false";
    const includeProfile = searchParams.get("includeProfile") === "true";

    let range: { from: CivilDate; to: CivilDate } | undefined;
    if (from || to) {
      if (!from || !to || !isValidCivilDate(from) || !isValidCivilDate(to)) {
        return jsonError(400, "`from` and `to` must both be present and valid YYYY-MM-DD dates");
      }
      range = { from: from as CivilDate, to: to as CivilDate };
    }

    const rawLogs = await listDayLogs(range);
    const dayLogs = rawLogs.map((l) => scrubDayLog(l, { includeFertility, includeSexualActivity }));

    if (format === "csv") {
      return new NextResponse(toCsv(dayLogs), {
        headers: {
          "Content-Type": "text/csv; charset=utf-8",
          "Content-Disposition": 'attachment; filename="day-logs-export.csv"',
        },
      });
    }

    const profile = includeProfile ? await getProfileOrDefault() : undefined;
    // A machine timestamp for export provenance, not a civil date the user perceives —
    // deliberately `Date.now()` (a number), never `new Date(...)`, to stay within
    // SPEC.md R1's "only lib/date/civil.ts constructs Date objects."
    return NextResponse.json({ dayLogs, profile, exportedAtEpochMs: Date.now() });
  } catch (err) {
    return handleUnexpected(err);
  }
}

/**
 * `get_pattern_data` (MCP-SPEC "get_pattern_data — the data behind forecasts"): the user's own
 * cycle-aligned symptom and mood counts, with each offset projected onto the next-period range
 * so the client never does date maths. Pure: it only regroups engine points and adds days.
 */
import { addDays, compare, type CivilDate } from "@/lib/date/civil";
import type { DayLog, MoodId, SymptomId } from "@/lib/domain/types";
import { computeMoodsByCycleDay, MIN_CYCLES_TO_SHOW_ANYTHING, type CycleDayWindowLabel, type EngineResult } from "@/lib/engine";
import { CONFIDENCE_LABELS } from "@/lib/copy/general";
import { capitalizedSymptomLabel } from "@/lib/copy/insights";
import { MOOD_OPTIONS } from "@/components/daylog/daylogOptions";
import { ongoingPeriod } from "@/lib/mcp/present";

export const PATTERN_NOTE =
  "Counts from the user's own logs, not a medical prediction. Dates are ranges because the next period date is an estimate.";

interface PatternDay {
  offset: number;
  logged: number;
  knownDays: number;
  cycles: number;
  upcoming?: { from: CivilDate; to: CivilDate };
  currentPeriod?: CivilDate;
}

interface Pattern {
  item: SymptomId | MoodId;
  kind: "symptom" | "mood";
  label: string;
  window: CycleDayWindowLabel;
  days: PatternDay[];
}

export function buildPatternData({
  output,
  dayLogs,
  today,
  items,
  minKnownDays = 1,
}: {
  output: EngineResult;
  dayLogs: DayLog[];
  today: CivilDate;
  items?: readonly (SymptomId | MoodId)[];
  minKnownDays?: number;
}) {
  const { low, high, confidence } = output.prediction;
  const next = low !== null && high !== null ? { from: low, to: high } : null;
  const logsByDate = new Map(dayLogs.map((l) => [l.date, l]));
  const current = ongoingPeriod({ output, today, logsByDate });

  const points = [
    ...output.stats.symptomsByCycleDay.map((p) => ({
      ...p,
      item: p.symptom as SymptomId | MoodId,
      kind: "symptom" as const,
      label: capitalizedSymptomLabel(p.symptom),
    })),
    ...computeMoodsByCycleDay(output.cycles, dayLogs).map((p) => ({
      ...p,
      item: p.mood as SymptomId | MoodId,
      kind: "mood" as const,
      label: MOOD_OPTIONS.find((o) => o.value === p.mood)?.label ?? p.mood,
    })),
  ];

  const patterns: Pattern[] = [];
  // The engine emits points grouped by item, then window, then offset — so a group is a run.
  for (const p of points) {
    if (items && !items.includes(p.item)) continue;
    if (p.knownDays < minKnownDays) continue;
    let group = patterns.at(-1);
    if (group?.item !== p.item || group.kind !== p.kind || group.window !== p.window) {
      group = { item: p.item, kind: p.kind, label: p.label, window: p.window, days: [] };
      patterns.push(group);
    }
    // Backward offsets count from the next start (−1 = the day before); forward offsets are
    // cycle days (1 = the start day), hence the − 1.
    const shift = p.offset < 0 ? p.offset : p.offset - 1;
    const exact = p.offset > 0 && current ? addDays(current.startDate, shift) : null;
    group.days.push({
      offset: p.offset,
      logged: p.occurrences,
      knownDays: p.knownDays,
      // Each completed cycle has exactly one calendar day at a given (window, offset), and cycles
      // don't overlap, so the number of contributing cycles equals knownDays (tested).
      cycles: p.knownDays,
      ...(next && { upcoming: { from: addDays(next.from, shift), to: addDays(next.to, shift) } }),
      ...(exact && compare(exact, today) >= 0 && { currentPeriod: exact }),
    });
  }

  return {
    basedOnCycles: output.cycles.filter((c) => c.nextStartDate !== null).length,
    minimumCyclesForPatterns: MIN_CYCLES_TO_SHOW_ANYTHING,
    nextPeriod: next && { ...next, confidence: CONFIDENCE_LABELS[confidence] },
    currentPeriod: current && { startDate: current.startDate },
    patterns,
    note: PATTERN_NOTE,
  };
}

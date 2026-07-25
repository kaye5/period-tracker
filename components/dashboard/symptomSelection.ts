/**
 * Picks which rows of `CycleStatistics.symptomFrequency` (`lib/engine/stats.ts`, agent E)
 * fill the dashboard's secondary "What you've logged" card. Mirrors
 * `insightSelection.ts`'s pattern: this module does not compute anything the engine
 * didn't already compute, it only decides how many rows a small card can reasonably show.
 *
 * Symptoms with zero `knownDays` (never logged present or explicitly marked "nothing to
 * report" for that symptom) are dropped — there is nothing honest to say about them yet.
 * The rest are sorted by occurrence count, most-logged first, ties broken by symptom id
 * for a stable order across renders.
 */
import type { SymptomFrequency } from "@/lib/engine";

export const DEFAULT_SYMPTOM_ROW_LIMIT = 6;

export function selectTopSymptoms(
  frequencies: readonly SymptomFrequency[],
  limit: number = DEFAULT_SYMPTOM_ROW_LIMIT,
): SymptomFrequency[] {
  return frequencies
    .filter((f) => f.knownDays > 0)
    .slice()
    .sort((a, b) => {
      if (b.occurrences !== a.occurrences) return b.occurrences - a.occurrences;
      return a.symptom.localeCompare(b.symptom);
    })
    .slice(0, Math.max(0, limit));
}

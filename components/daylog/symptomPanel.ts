/**
 * Splits the day log's symptom panel into the groups the form renders as separate chip
 * groups (physical / emotional / opt-in tier C), and gates tier C on
 * `settings.tierCSymptomsEnabled` (SPEC.md's `Settings.tierCSymptomsEnabled`, DEFAULT
 * false). Tier C is imported directly from `lib/engine/constants.ts`'s
 * `SYMPTOM_PANEL_TIER_C` (owned by F). Tiers A/B (physical/emotional) are re-declared
 * below, split by group, rather than positionally sliced out of the engine's flat
 * `SYMPTOM_PANEL` array — `symptomPanel.test.ts` cross-checks this split against
 * `SYMPTOM_PANEL` directly, so any drift between the two fails the build instead of
 * silently mislabelling a chip.
 */
import type { SymptomId } from "@/lib/domain/types";
import { SYMPTOM_PANEL_TIER_C } from "@/lib/engine/constants";

/** Tier A of SYMPTOM_PANEL — physical symptoms, default-on. */
const PHYSICAL: SymptomId[] = [
  "cramps",
  "breast_tenderness",
  "bloating",
  "headache",
  "fatigue",
  "cravings",
  "gi_change",
  "acne",
];

/** Tier B of SYMPTOM_PANEL — emotional symptoms, default-on. Direction (premenstrual vs
 * postmenstrual) is discovered by the insight engine, never assumed here; this form
 * only decides which chip group a symptom's checkbox appears in. */
const EMOTIONAL: SymptomId[] = ["irritability", "low_mood", "anxiety", "emotional_sensitivity"];

export function physicalSymptomIds(): SymptomId[] {
  return PHYSICAL;
}

export function emotionalSymptomIds(): SymptomId[] {
  return EMOTIONAL;
}

export interface VisibleSymptomGroups {
  physical: SymptomId[];
  emotional: SymptomId[];
  /** Empty when tier C is disabled — callers render nothing for an empty group rather
   * than a group with a "no options" state. */
  tierC: SymptomId[];
}

export function visibleSymptomGroups(tierCEnabled: boolean): VisibleSymptomGroups {
  return {
    physical: PHYSICAL,
    emotional: EMOTIONAL,
    tierC: tierCEnabled ? [...SYMPTOM_PANEL_TIER_C] : [],
  };
}

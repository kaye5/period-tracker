/**
 * Display-label option lists for the day log's form controls, for every DayLog field
 * whose value set isn't already covered by a copy catalogue elsewhere (symptom labels
 * live in lib/copy/insights.ts's SYMPTOM_LABELS and are reused directly, not duplicated
 * here). These are plain option labels for the user's own selections (bleeding kind,
 * flow intensity, mood, …) — not claims the app makes about the user's body, so SPEC.md
 * R9 does not require them to live under lib/copy/. `daylogOptions.test.ts` checks each
 * list against the corresponding zod enum in lib/domain/schema.ts so a value added there
 * can't silently go unlabelled here.
 */
import type {
  BleedingContext,
  ClotSize,
  FertilityObservations,
  FlowLevel,
  Interference,
  MoodId,
  PainSeverity,
  PainSite,
} from "@/lib/domain/types";

export interface DaylogOption<T> {
  value: T;
  label: string;
}

export const PAIN_SEVERITY_OPTIONS: DaylogOption<PainSeverity>[] = [
  { value: "none", label: "None" },
  { value: "mild", label: "Mild" },
  { value: "moderate", label: "Moderate" },
  { value: "severe", label: "Severe" },
];

export const PERIOD_BOUNDARY_OPTIONS: DaylogOption<"start" | "end">[] = [
  { value: "start", label: "First day" },
  { value: "end", label: "Last day (period ended)" },
];

export const FLOW_LEVEL_OPTIONS: DaylogOption<FlowLevel>[] = [
  // Labelled "Very light" rather than bare "Spotting" so this flow-intensity chip is
  // never confused with the separate, visually distinct spotting-vs-period control
  // above it (SPEC.md U3 brief: spotting must never look like it starts a cycle) — this
  // chip only ever appears once "Period today" is already selected.
  { value: "spotting", label: "Very light" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "very_heavy", label: "Very heavy" },
];

export const CLOT_SIZE_OPTIONS: DaylogOption<ClotSize>[] = [
  { value: "none", label: "None noticed" },
  { value: "small", label: "Smaller than a quarter" },
  { value: "ge_2_5cm", label: "Quarter-size (2.5cm) or larger" },
];

export const FASTEST_CHANGE_OPTIONS: DaylogOption<0.5 | 1 | 2 | 4 | 8>[] = [
  { value: 0.5, label: "Every 30 min" },
  { value: 1, label: "Every hour" },
  { value: 2, label: "Every 2 hours" },
  { value: 4, label: "Every 4 hours" },
  { value: 8, label: "Every 8+ hours" },
];

export const BLEEDING_CONTEXT_OPTIONS: DaylogOption<BleedingContext>[] = [
  { value: "period", label: "Period" },
  { value: "intermenstrual", label: "Between periods" },
  { value: "postcoital", label: "After sex" },
  { value: "unexpected", label: "Unexpected" },
];

export const PAIN_SITE_OPTIONS: DaylogOption<PainSite>[] = [
  { value: "lower_abdomen", label: "Lower abdomen" },
  { value: "back", label: "Back" },
  { value: "legs", label: "Legs" },
  { value: "pelvis", label: "Pelvis" },
  { value: "head", label: "Head" },
  { value: "other", label: "Other" },
];

export const INTERFERENCE_OPTIONS: DaylogOption<Interference>[] = [
  { value: "work_or_school", label: "Work or school" },
  { value: "sleep", label: "Sleep" },
  { value: "exercise", label: "Exercise" },
  { value: "social", label: "Social plans" },
  { value: "household", label: "Household tasks" },
];

export const MOOD_OPTIONS: DaylogOption<MoodId>[] = [
  { value: "calm", label: "Calm" },
  { value: "happy", label: "Happy" },
  { value: "energetic", label: "Energetic" },
  { value: "irritable", label: "Irritable" },
  { value: "sad", label: "Sad" },
  { value: "anxious", label: "Anxious" },
  { value: "sensitive", label: "Sensitive" },
  { value: "low", label: "Low" },
];

type CervicalMucus = NonNullable<FertilityObservations["cervicalMucus"]>;
export const CERVICAL_MUCUS_OPTIONS: DaylogOption<CervicalMucus>[] = [
  { value: "dry", label: "Dry" },
  { value: "sticky", label: "Sticky" },
  { value: "creamy", label: "Creamy" },
  { value: "watery", label: "Watery" },
  { value: "egg_white", label: "Egg-white" },
];

type OpkResult = NonNullable<FertilityObservations["opkResult"]>;
export const OPK_RESULT_OPTIONS: DaylogOption<OpkResult>[] = [
  { value: "negative", label: "Negative" },
  { value: "positive", label: "Positive" },
];

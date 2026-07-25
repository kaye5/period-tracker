/**
 * Pure state/logic for the daily-log form (components/daylog/DayLogForm.tsx). Kept free
 * of React so it is unit-testable directly (SPEC.md R10) — DayLogForm itself is a thin
 * renderer over this module plus the `fetch` calls that persist it (POST/DELETE
 * app/api/day-logs, owned by agent G).
 *
 * Two rules this module exists to protect:
 *   1. R2 / R7 — editing a day never silently discards what was already recorded on it.
 *      `initialFormState` round-trips every field a DayLog can carry, and
 *      `buildDayLogPayload` only omits a field from the outgoing payload when the form
 *      genuinely has no value for it (never because it forgot to serialise something).
 *   2. `loggedAt` is "the day the entry was made" (back-entry detection, S17), which is
 *      NOT the same date as `date` ("the day being described"). A fresh entry's
 *      `loggedAt` is always `today`; editing an existing entry preserves its original
 *      `loggedAt` rather than overwriting the back-entry signal every time it's touched.
 */
import type { CivilDate } from "@/lib/date/civil";
import type {
  BleedingContext,
  BleedingKind,
  ClotSize,
  DayLog,
  FertilityObservations,
  FlowLevel,
  Interference,
  MoodId,
  PainSeverity,
  PainSite,
  SymptomId,
} from "@/lib/domain/types";

export interface DayLogFormState {
  bleeding: BleedingKind;
  flow: FlowLevel | undefined;
  bleedingContext: BleedingContext | undefined;
  periodBoundary: "start" | "end" | undefined;
  clots: ClotSize | undefined;
  productChanges: number | undefined;
  fastestProductChangeHours: 0.5 | 1 | 2 | 4 | 8 | undefined;
  doubleProtection: boolean;
  nightChange: boolean;
  leakThrough: boolean;
  painSeverity: PainSeverity;
  painSites: PainSite[];
  interferedWith: Interference[];
  painkillerDidNotHelp: boolean;
  symptoms: SymptomId[];
  nothingToReport: boolean;
  mood: MoodId[];
  notes: string;
  fertility: FertilityObservations;
}

export const EMPTY_FORM_STATE: DayLogFormState = {
  bleeding: "none",
  flow: undefined,
  bleedingContext: undefined,
  periodBoundary: undefined,
  clots: undefined,
  productChanges: undefined,
  fastestProductChangeHours: undefined,
  doubleProtection: false,
  nightChange: false,
  leakThrough: false,
  painSeverity: "none",
  painSites: [],
  interferedWith: [],
  painkillerDidNotHelp: false,
  symptoms: [],
  nothingToReport: false,
  mood: [],
  notes: "",
  fertility: {},
};

/** Builds form state from an existing DayLog (editing) or a blank slate (new entry). */
export function initialFormState(existing: DayLog | null | undefined): DayLogFormState {
  if (!existing) return EMPTY_FORM_STATE;
  return {
    bleeding: existing.bleeding,
    flow: existing.flow,
    bleedingContext: existing.bleedingContext,
    periodBoundary: existing.periodBoundary,
    clots: existing.clots,
    productChanges: existing.productChanges,
    fastestProductChangeHours: existing.fastestProductChangeHours,
    doubleProtection: existing.doubleProtection ?? false,
    nightChange: existing.nightChange ?? false,
    leakThrough: existing.leakThrough ?? false,
    painSeverity: existing.pain.severity,
    painSites: existing.pain.sites ?? [],
    interferedWith: existing.pain.interferedWith ?? [],
    painkillerDidNotHelp: existing.pain.painkillerDidNotHelp ?? false,
    symptoms: existing.symptoms,
    nothingToReport: existing.nothingToReport ?? false,
    mood: existing.mood ?? [],
    notes: existing.notes ?? "",
    fertility: existing.fertility ?? {},
  };
}

/**
 * Builds the DayLog payload to POST. `existingLoggedAt` should be the loggedAt of the
 * DayLog being edited, if any — omit it (or pass undefined) for a brand-new entry, in
 * which case `today` is used.
 */
export function buildDayLogPayload(
  date: CivilDate,
  today: CivilDate,
  state: DayLogFormState,
  fertilityEnabled: boolean,
  existingLoggedAt?: CivilDate,
): DayLog {
  const payload: DayLog = {
    date,
    bleeding: state.bleeding,
    pain: {
      severity: state.painSeverity,
      sites: state.painSites.length ? state.painSites : undefined,
      interferedWith: state.interferedWith.length ? state.interferedWith : undefined,
      painkillerDidNotHelp: state.painkillerDidNotHelp || undefined,
    },
    symptoms: state.symptoms,
    loggedAt: existingLoggedAt ?? today,
  };
  if (state.flow !== undefined) payload.flow = state.flow;
  if (state.bleedingContext !== undefined) payload.bleedingContext = state.bleedingContext;
  if (state.periodBoundary !== undefined) payload.periodBoundary = state.periodBoundary;
  if (state.clots !== undefined) payload.clots = state.clots;
  if (state.productChanges !== undefined) payload.productChanges = state.productChanges;
  if (state.fastestProductChangeHours !== undefined) {
    payload.fastestProductChangeHours = state.fastestProductChangeHours;
  }
  if (state.doubleProtection) payload.doubleProtection = true;
  if (state.nightChange) payload.nightChange = true;
  if (state.leakThrough) payload.leakThrough = true;
  if (state.nothingToReport) payload.nothingToReport = true;
  if (state.mood.length) payload.mood = state.mood;
  if (state.notes.trim()) payload.notes = state.notes.trim();
  if (fertilityEnabled && Object.keys(state.fertility).length > 0) {
    payload.fertility = state.fertility;
  }
  return payload;
}

/**
 * The "Nothing to report" one-tap payload (SPEC.md U3 brief: "it is what turns unknown
 * days into true negatives for the insight engine"). Deliberately ignores whatever is
 * currently sitting in the form's draft state, so this control always means exactly one
 * thing regardless of what the user was mid-typing when they tapped it.
 */
export function nothingToReportPayload(
  date: CivilDate,
  today: CivilDate,
  existingLoggedAt?: CivilDate,
): DayLog {
  return {
    date,
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    nothingToReport: true,
    loggedAt: existingLoggedAt ?? today,
  };
}

/** Toggles membership of `value` in `list`, returning a new array — the shared
 * add/remove primitive behind every multi-select chip group (symptoms, mood, pain
 * sites, interference). */
export function toggleMember<T>(list: readonly T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
}

/** Replaces the members of `groupIds` inside `current` with `nextForGroup`, leaving
 * every other selected symptom untouched. Used because the symptoms form splits one
 * `SymptomId[]` field into several independently-rendered chip groups (physical /
 * emotional / tier C) that must not clobber each other's selections. */
export function mergeSymptomGroup(
  current: readonly SymptomId[],
  groupIds: readonly SymptomId[],
  nextForGroup: readonly SymptomId[],
): SymptomId[] {
  const outsideGroup = current.filter((id) => !groupIds.includes(id));
  return [...outsideGroup, ...nextForGroup];
}

/** Sets (or, when `value` is undefined, removes) one key of a FertilityObservations
 * draft. Removing the key outright (rather than leaving `{ key: undefined }`) keeps
 * `Object.keys(...).length` in buildDayLogPayload an honest test of "has the user
 * recorded anything here". */
export function patchFertilityField<K extends keyof FertilityObservations>(
  fertility: FertilityObservations,
  key: K,
  value: FertilityObservations[K] | undefined,
): FertilityObservations {
  const next = { ...fertility };
  if (value === undefined) {
    delete next[key];
  } else {
    next[key] = value;
  }
  return next;
}

/**
 * App-wide copy catalogue (SPEC.md R9: every user-facing string that makes a claim
 * about the user's body lives here, not inline in JSX, so the banned-word lint in
 * lib/copy/lint.test.ts — owned by agent D, and run over every module in lib/copy/ —
 * can check it). This file covers the global disclaimer, the four-value confidence
 * vocabulary (SPEC.md §4.3), empty states, the privacy statement, prediction-suppressed
 * messages, the fertility disclaimer, and notification wording previews.
 *
 * lib/copy/insights.ts (agent C) and lib/copy/health.ts (agent D) own their own
 * domains' copy; this file is everything else.
 *
 * `DISCLAIMER` and `PRIVACY_STATEMENT` are, by SPEC.md §4.4, the two designated
 * "disclaimer text" exceptions to the banned-word lint — they are the only strings in
 * this catalogue allowed to say "diagnosis". Every other export here must (and does)
 * avoid the full banned-word list on its own merits.
 */
import type { PredictionResult } from "@/lib/domain/types";

// ============================================================================
// Global disclaimer
// ============================================================================

/** Shown wherever the app surfaces a prediction, insight, or health message that could
 * be mistaken for a medical judgment. Exempt from the banned-word lint as "the
 * disclaimer text" (SPEC.md §4.4). */
export const DISCLAIMER =
  "This app summarizes what you've recorded over time. It does not provide a diagnosis and is not a substitute for medical care. If something feels wrong, talk to a clinician.";

// ============================================================================
// Confidence vocabulary (SPEC.md §4.3 — only these four values ever reach the UI)
// ============================================================================

type PredictionConfidence = PredictionResult["confidence"];

/** The exact four confidence labels permitted in the UI. Never a percentage, never the
 * word "accuracy" (SPEC.md §4.3). */
export const CONFIDENCE_LABELS: Record<PredictionConfidence, string> = {
  not_enough_information: "Not enough information",
  early_estimate: "Early estimate",
  limited: "Limited",
  more_consistent: "More consistent",
};

/** Reason-string builders — every confidence label must be shown with the actual
 * numbers behind it (SPEC.md §4.3: "always accompanied by its reason string naming the
 * actual numbers"). Callers (lib/engine/prediction.ts) supply the numbers; this file
 * only owns the sentence shape. */
export const CONFIDENCE_REASONS = {
  notEnoughInformation: (completedCycles: number): string =>
    `You have ${completedCycles} completed cycle${completedCycles === 1 ? "" : "s"} recorded. A range needs at least 3.`,
  earlyEstimate: (reportedLengthDays: number): string =>
    `No completed cycle yet — this range is based on the typical length you entered at setup (${reportedLengthDays} days), not your own recorded cycles.`,
  limited: (windowCycles: number, shortestDays: number, longestDays: number): string =>
    `Your last ${windowCycles} cycles ranged from ${shortestDays} to ${longestDays} days, so this range stays wide.`,
  moreConsistent: (windowCycles: number, medianDifferenceDays: number): string =>
    `Your last ${windowCycles} cycles have stayed close in length — a typical difference of ${medianDifferenceDays} day${medianDifferenceDays === 1 ? "" : "s"} from one cycle to the next.`,
} as const;

// ============================================================================
// Prediction suppression
// ============================================================================

type SuppressedReason = NonNullable<PredictionResult["suppressed"]>["reason"];

export const PREDICTION_SUPPRESSED_MESSAGES: Record<SuppressedReason, string> = {
  pregnant: "Predictions are turned off because you've marked yourself as pregnant.",
  postpartum:
    "Predictions are turned off for now. They'll come back once you have a few recorded cycles after delivery.",
  insufficient_data: "There isn't enough recorded data yet to show a range.",
  hormonal_method:
    "Predictions are turned off because you're on a hormonal method. Cycle timing on a hormonal method doesn't follow the pattern this app predicts from.",
};

// ============================================================================
// Fertility disclaimer (SPEC.md §3: rendered adjacent to every FertilityEstimate,
// never behind a link)
// ============================================================================

export const FERTILITY_DISCLAIMER =
  "This is a calendar-based estimate, not a measurement. It uses your recorded period dates and typical timing patterns from published research — it does not use body temperature, ovulation test strips, or any other physical sign. If you're trying to conceive or trying to avoid it, don't rely on this window by itself.";

// ============================================================================
// Empty states
// ============================================================================

export const EMPTY_STATES = {
  noLogsYet: "You haven't logged anything yet. Tap a day on the calendar to add your first entry.",
  noCompletedCycles:
    "Nothing to show yet — this fills in once you've recorded at least one completed cycle.",
  noHistory: "Your cycle history will appear here once you've recorded a period.",
  fertilityDisabled: "Fertility estimates are turned off. You can turn them on in Settings.",
  noExportableData: "There's nothing to export yet.",
  noNotesYet: "No notes for this day yet.",
} as const;

// ============================================================================
// Privacy statement (SPEC.md §0.1 — must appear verbatim on the settings screen and in
// docs/PRIVACY.md; keep the two in lockstep)
// ============================================================================

export const PRIVACY_STATEMENT = `Your data is stored in a SQL database that this app reaches using the address in DATABASE_URL. Where that database runs is your choice, and it decides where your periods, symptoms, notes, and health details go: point DATABASE_URL at a database running on this machine and the data stays on this machine; point it at a hosted service such as TiDB Cloud or a hosted MySQL provider and the data leaves this device and sits on that provider's servers, in their custody.

What that does and does not mean: this app adds no protection of its own on top of whatever the database itself does, and it makes no independent claim about your data in transit or at rest. The connection details, including the database password, are stored in plain text in a file (.env.local) on this machine, so anyone who can read this machine's files can connect to your database from anywhere its network rules allow. If you use a hosted database, its protection depends on that provider and your account with them, not on this app — use a strong, unique password, turn on two-factor authentication where it is offered, and restrict network access. This app has no lock screen, sends no analytics or telemetry, and loads no third-party script, font, or image. You can export everything you've recorded, or permanently delete it, at any time from Settings.`;

// ============================================================================
// Notification wording preview (Settings.notifications.privateWording toggle)
// ============================================================================

/** Every notification type in Settings.notifications, in its "private" (lock-screen-safe,
 * no specifics) and "detailed" (states what it's about) forms. Default is private. */
export const NOTIFICATION_MESSAGES = {
  periodReminder: { private: "Reminder", detailed: "Your period may start soon" },
  fertileReminder: { private: "Reminder", detailed: "You're near your estimated fertile window" },
  symptomReminder: { private: "Reminder", detailed: "Log how you're feeling today" },
  medicationReminder: { private: "Reminder", detailed: "Time for your medication" },
  loggingReminder: { private: "Reminder", detailed: "You haven't logged today yet" },
  healthAwareness: { private: "Reminder", detailed: "You have a new note to read in the app" },
} as const;

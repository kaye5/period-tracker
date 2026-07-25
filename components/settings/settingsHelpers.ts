/**
 * Pure logic for the Settings screen (components/settings/SettingsScreen.tsx and
 * friends). Kept free of React and I/O so it's unit-testable (SPEC.md R10).
 */
import type { Settings } from "@/lib/domain/types";
import { NOTIFICATION_MESSAGES } from "@/lib/copy/general";

// ============================================================================
// Notification wording preview (Settings.notifications.privateWording)
// ============================================================================

export type NotificationKind = keyof typeof NOTIFICATION_MESSAGES;

/** The exact text a notification of `kind` would show, given the current
 * `privateWording` setting — same lookup the wizard/settings previews render, pulled
 * out so it's testable without rendering anything. */
export function notificationPreviewText(kind: NotificationKind, privateWording: boolean): string {
  const copy = NOTIFICATION_MESSAGES[kind];
  return privateWording ? copy.private : copy.detailed;
}

/** Every notification kind Settings.notifications defines a toggle for, in a stable
 * display order, each paired with a short human label for the settings list. Excludes
 * `privateWording` itself, which is the mode switch, not a notification kind. */
export const NOTIFICATION_TOGGLES: { key: keyof Settings["notifications"]; kind: NotificationKind; label: string }[] = [
  { key: "periodReminder", kind: "periodReminder", label: "Period reminder" },
  { key: "fertileReminder", kind: "fertileReminder", label: "Fertile window reminder" },
  { key: "symptomReminder", kind: "symptomReminder", label: "Symptom logging reminder" },
  { key: "medicationReminder", kind: "medicationReminder", label: "Medication reminder" },
  { key: "loggingReminder", kind: "loggingReminder", label: "Daily logging reminder" },
  { key: "healthAwareness", kind: "healthAwareness", label: "Health awareness notes" },
];

/** Immutable update of one notification toggle. */
export function withNotificationToggle(
  settings: Settings,
  key: keyof Settings["notifications"],
  value: boolean,
): Settings {
  return { ...settings, notifications: { ...settings.notifications, [key]: value } };
}

/** Immutable update of the private/detailed wording mode. */
export function withPrivateWording(settings: Settings, privateWording: boolean): Settings {
  return { ...settings, notifications: { ...settings.notifications, privateWording } };
}

// ============================================================================
// Permanent delete — a real, specific confirmation (SPEC.md's U1 brief)
// ============================================================================

export interface DeletionScope {
  dayLogCount: number;
  hasProfile: boolean;
}

/**
 * The exact, specific list of what a permanent delete destroys — no vague "your data".
 * `dayLogCount` should come from a live GET /api/day-logs so the number is real, not
 * estimated. The other collections (predictions, decisions, calibration state) are
 * named without a count because no read endpoint exists to size them honestly — SPEC.md
 * R7 forbids inventing a number, so this names the category instead of guessing one.
 */
export function describeDeletionScope(scope: DeletionScope): string[] {
  const lines: string[] = [];
  lines.push(
    scope.dayLogCount === 1
      ? "1 day log entry — every bleeding, symptom, pain, and mood record you've made"
      : `${scope.dayLogCount} day log entries — every bleeding, symptom, pain, and mood record you've made`,
  );
  if (scope.hasProfile) {
    lines.push("Your profile: reported cycle info, life-stage state, and all settings");
  }
  // Avoid the SPEC.md §4.4 banned word "accuracy" — this string is rendered inline in
  // DeleteAllDataSheet, where the lib/copy lint cannot see it. Matches the rest of the
  // build's phrasing ("how recent predictions compared"), see components/dashboard/copy.ts.
  lines.push("Saved predictions and how they compared to your actual cycles");
  lines.push("Any cycle exclusions or \"missed period\" answers you've given");
  lines.push("On-device calibration state used to size prediction ranges");
  return lines;
}

/** Text the user must type to enable the delete button — a deliberate extra step for an
 * irreversible action, distinct from the API's own `confirm` body token (that token is
 * a safety latch against a stray request, not a UI confirmation — see
 * app/api/delete-all/route.ts's comment). [choice] */
export const DELETE_CONFIRMATION_PHRASE = "DELETE";

export function isDeletionPhraseConfirmed(typed: string): boolean {
  return typed.trim() === DELETE_CONFIRMATION_PHRASE;
}

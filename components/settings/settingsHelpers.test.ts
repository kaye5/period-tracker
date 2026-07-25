import { describe, expect, it } from "vitest";
import { DEFAULT_PROFILE } from "@/lib/repo/profile";
import { NOTIFICATION_MESSAGES } from "@/lib/copy/general";
import {
  DELETE_CONFIRMATION_PHRASE,
  NOTIFICATION_TOGGLES,
  describeDeletionScope,
  isDeletionPhraseConfirmed,
  notificationPreviewText,
  withNotificationToggle,
  withPrivateWording,
} from "@/components/settings/settingsHelpers";

describe("notificationPreviewText", () => {
  it("returns the private wording when privateWording is true", () => {
    expect(notificationPreviewText("periodReminder", true)).toBe(
      NOTIFICATION_MESSAGES.periodReminder.private,
    );
  });

  it("returns the detailed wording when privateWording is false", () => {
    expect(notificationPreviewText("periodReminder", false)).toBe(
      NOTIFICATION_MESSAGES.periodReminder.detailed,
    );
  });

  it("covers every toggle listed in NOTIFICATION_TOGGLES", () => {
    for (const { kind } of NOTIFICATION_TOGGLES) {
      expect(typeof notificationPreviewText(kind, true)).toBe("string");
      expect(typeof notificationPreviewText(kind, false)).toBe("string");
    }
  });
});

describe("withNotificationToggle / withPrivateWording", () => {
  it("updates the target field immutably, without touching the original", () => {
    const before = DEFAULT_PROFILE.settings;
    const after = withNotificationToggle(before, "periodReminder", true);
    expect(after).not.toBe(before);
    expect(after.notifications.periodReminder).toBe(true);
    expect(before.notifications.periodReminder).toBe(false);
  });

  it("leaves every other notification field untouched", () => {
    const before = { ...DEFAULT_PROFILE.settings, notifications: { ...DEFAULT_PROFILE.settings.notifications, symptomReminder: true } };
    const after = withNotificationToggle(before, "periodReminder", true);
    expect(after.notifications.symptomReminder).toBe(true);
    expect(after.notifications.periodReminder).toBe(true);
  });

  it("privateWording defaults true in DEFAULT_PROFILE and can be flipped immutably", () => {
    expect(DEFAULT_PROFILE.settings.notifications.privateWording).toBe(true);
    const after = withPrivateWording(DEFAULT_PROFILE.settings, false);
    expect(after.notifications.privateWording).toBe(false);
    expect(DEFAULT_PROFILE.settings.notifications.privateWording).toBe(true);
  });
});

describe("describeDeletionScope", () => {
  it("states the exact day log count, singular vs plural", () => {
    expect(describeDeletionScope({ dayLogCount: 1, hasProfile: true })[0]).toMatch(/^1 day log entry/);
    expect(describeDeletionScope({ dayLogCount: 0, hasProfile: true })[0]).toMatch(/^0 day log entries/);
    expect(describeDeletionScope({ dayLogCount: 42, hasProfile: true })[0]).toMatch(/^42 day log entries/);
  });

  it("never invents a count for collections with no read endpoint to size them", () => {
    const lines = describeDeletionScope({ dayLogCount: 5, hasProfile: true }).join(" ");
    expect(lines).not.toMatch(/\d+ predictions/);
    expect(lines).not.toMatch(/\d+ decisions/);
    expect(lines.toLowerCase()).toContain("predictions");
    expect(lines.toLowerCase()).toContain("calibration");
  });

  it("omits the profile line when hasProfile is false", () => {
    const lines = describeDeletionScope({ dayLogCount: 3, hasProfile: false });
    expect(lines.some((l) => l.toLowerCase().includes("profile"))).toBe(false);
  });

  it("uses no SPEC.md §4.4 banned word (this copy renders inline, past the lib/copy lint)", () => {
    // DeleteAllDataSheet renders these lines directly in JSX, so the lib/copy banned-word
    // lint never sees them. "accuracy" is on the §4.4 list and must not appear here.
    const bannedInThisCopy = ["accuracy", "% accurate", "medical-grade", "clinically accurate"];
    const text = describeDeletionScope({ dayLogCount: 7, hasProfile: true }).join(" ").toLowerCase();
    for (const word of bannedInThisCopy) {
      expect(text.includes(word), `deletion-scope copy contains banned word "${word}"`).toBe(false);
    }
  });
});

describe("isDeletionPhraseConfirmed", () => {
  it("requires an exact (trimmed) match of the confirmation phrase", () => {
    expect(isDeletionPhraseConfirmed(DELETE_CONFIRMATION_PHRASE)).toBe(true);
    expect(isDeletionPhraseConfirmed(`  ${DELETE_CONFIRMATION_PHRASE}  `)).toBe(true);
    expect(isDeletionPhraseConfirmed("delete")).toBe(false);
    expect(isDeletionPhraseConfirmed("")).toBe(false);
    expect(isDeletionPhraseConfirmed("DELETE ALL")).toBe(false);
  });
});

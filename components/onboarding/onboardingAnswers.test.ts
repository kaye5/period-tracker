import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import { DEFAULT_PROFILE } from "@/lib/repo/profile";
import {
  CYCLE_LENGTH_BOUNDS,
  PERIOD_DURATION_BOUNDS,
  answersFromProfile,
  buildInitialDayLog,
  buildProfilePatch,
  initialAnswers,
  isValidCycleLengthDays,
  isValidPeriodDurationDays,
} from "@/components/onboarding/onboardingAnswers";

const TODAY = parseCivil("2026-07-22");

describe("initialAnswers", () => {
  it("never assumes a 28-day cycle or any typical length", () => {
    const answers = initialAnswers();
    expect(answers.cycleLengthKnown).toBe(false);
    expect(answers.cycleLengthDays).toBeNull();
    expect(answers.periodDurationKnown).toBe(false);
    expect(answers.periodDurationDays).toBeNull();
  });

  it("defaults regularity to 'unknown', never 'consistent'", () => {
    expect(initialAnswers().regularity).toBe("unknown");
  });

  it("defaults every special-state flag and fertilityEnabled to off", () => {
    const answers = initialAnswers();
    expect(answers.pregnant).toBe(false);
    expect(answers.breastfeeding).toBe(false);
    expect(answers.usingHormonalMethod).toBe(false);
    expect(answers.usingCopperIud).toBe(false);
    expect(answers.recentlyStoppedHormonal).toBe(false);
    expect(answers.perimenopause).toBe(false);
    expect(answers.menopause).toBe(false);
    expect(answers.knownIrregular).toBe(false);
    expect(answers.specialStatesPreferNotToSay).toBe(false);
    expect(answers.fertilityEnabled).toBe(false);
  });

  it("does not ask or store a 'trying to conceive' goal (no such field exists)", () => {
    const answers = initialAnswers();
    expect("tryingToConceive" in answers).toBe(false);
  });
});


describe("isValidCycleLengthDays / isValidPeriodDurationDays", () => {
  it("accepts the boundary values", () => {
    expect(isValidCycleLengthDays(CYCLE_LENGTH_BOUNDS.min)).toBe(true);
    expect(isValidCycleLengthDays(CYCLE_LENGTH_BOUNDS.max)).toBe(true);
    expect(isValidPeriodDurationDays(PERIOD_DURATION_BOUNDS.min)).toBe(true);
    expect(isValidPeriodDurationDays(PERIOD_DURATION_BOUNDS.max)).toBe(true);
  });

  it("rejects values outside the bounds, non-integers, and non-finite numbers", () => {
    expect(isValidCycleLengthDays(CYCLE_LENGTH_BOUNDS.min - 1)).toBe(false);
    expect(isValidCycleLengthDays(CYCLE_LENGTH_BOUNDS.max + 1)).toBe(false);
    expect(isValidCycleLengthDays(28.5)).toBe(false);
    expect(isValidCycleLengthDays(NaN)).toBe(false);
    expect(isValidPeriodDurationDays(0)).toBe(false);
    expect(isValidPeriodDurationDays(15)).toBe(false);
  });
});

describe("buildProfilePatch", () => {
  it("leaves reportedTypicalCycleLength/PeriodDays undefined when marked unknown, never defaulting", () => {
    const answers = initialAnswers();
    const profile = buildProfilePatch(answers, DEFAULT_PROFILE);
    expect(profile.reportedTypicalCycleLength).toBeUndefined();
    expect(profile.reportedTypicalPeriodDays).toBeUndefined();
  });

  it("carries through a known cycle length and period duration exactly", () => {
    const answers = {
      ...initialAnswers(),
      cycleLengthKnown: true,
      cycleLengthDays: 31,
      periodDurationKnown: true,
      periodDurationDays: 6,
    };
    const profile = buildProfilePatch(answers, DEFAULT_PROFILE);
    expect(profile.reportedTypicalCycleLength).toBe(31);
    expect(profile.reportedTypicalPeriodDays).toBe(6);
  });

  it("preferNotToSay zeroes every other special-state field regardless of their values", () => {
    const answers = {
      ...initialAnswers(),
      specialStatesPreferNotToSay: true,
      pregnant: true,
      breastfeeding: true,
      usingHormonalMethod: true,
      hormonalMethodKind: "combined_pill" as const,
      hormonalMethodStartedOn: TODAY,
      usingCopperIud: true,
      copperIudInsertedOn: TODAY,
      perimenopause: true,
      menopause: true,
      knownIrregular: true,
    };
    const profile = buildProfilePatch(answers, DEFAULT_PROFILE);
    expect(profile.state).toEqual({
      pregnant: false,
      deliveryDate: undefined,
      breastfeeding: false,
      hormonalMethod: undefined,
      copperIudInsertedOn: undefined,
      stoppedHormonalOn: undefined,
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: false,
      preferNotToSay: true,
    });
  });

  it("only sets hormonalMethod when the toggle, kind, and start date are all present", () => {
    const partial = {
      ...initialAnswers(),
      usingHormonalMethod: true,
      hormonalMethodKind: null,
      hormonalMethodStartedOn: TODAY,
    };
    expect(buildProfilePatch(partial, DEFAULT_PROFILE).state.hormonalMethod).toBeUndefined();

    const complete = {
      ...initialAnswers(),
      usingHormonalMethod: true,
      hormonalMethodKind: "hormonal_iud" as const,
      hormonalMethodStartedOn: TODAY,
    };
    expect(buildProfilePatch(complete, DEFAULT_PROFILE).state.hormonalMethod).toEqual({
      kind: "hormonal_iud",
      startedOn: TODAY,
    });
  });

  it("writes fertilityEnabled and locale from the answers, defaulting off/en-US", () => {
    const profile = buildProfilePatch(initialAnswers(), DEFAULT_PROFILE);
    expect(profile.settings.fertilityEnabled).toBe(false);
    expect(profile.settings.locale).toBe("en-US");

    const optedIn = { ...initialAnswers(), fertilityEnabled: true, locale: "en-GB" as const };
    const patched = buildProfilePatch(optedIn, DEFAULT_PROFILE);
    expect(patched.settings.fertilityEnabled).toBe(true);
    expect(patched.settings.locale).toBe("en-GB");
  });

  it("preserves settings fields the wizard does not touch (e.g. an existing tierC choice)", () => {
    const base = {
      ...DEFAULT_PROFILE,
      settings: { ...DEFAULT_PROFILE.settings, tierCSymptomsEnabled: true },
    };
    const profile = buildProfilePatch(initialAnswers(), base);
    expect(profile.settings.tierCSymptomsEnabled).toBe(true);
  });
});

describe("buildInitialDayLog", () => {
  it("returns null when the user skipped the last-period question", () => {
    expect(buildInitialDayLog(initialAnswers(), TODAY)).toBeNull();
  });

  it("builds a minimal-but-valid menstrual start day log when a date is given", () => {
    const lastPeriodStart = parseCivil("2026-07-01");
    const log = buildInitialDayLog({ ...initialAnswers(), lastPeriodStart }, TODAY);
    expect(log).toEqual({
      date: lastPeriodStart,
      bleeding: "menstrual",
      periodBoundary: "start",
      pain: { severity: "none" },
      symptoms: [],
      loggedAt: TODAY,
    });
  });
});

describe("answersFromProfile", () => {
  it("round-trips reported fields and state back into the working draft", () => {
    const profile = buildProfilePatch(
      {
        ...initialAnswers(),
        cycleLengthKnown: true,
        cycleLengthDays: 27,
        regularity: "variable" as const,
        usingCopperIud: true,
        copperIudInsertedOn: TODAY,
        fertilityEnabled: true,
        locale: "en-GB" as const,
      },
      DEFAULT_PROFILE,
    );
    const answers = answersFromProfile(profile);
    expect(answers.cycleLengthKnown).toBe(true);
    expect(answers.cycleLengthDays).toBe(27);
    expect(answers.regularity).toBe("variable");
    expect(answers.usingCopperIud).toBe(true);
    expect(answers.copperIudInsertedOn).toBe(TODAY);
    expect(answers.fertilityEnabled).toBe(true);
    expect(answers.locale).toBe("en-GB");
    // dayLogs, not Profile, is the source of truth for the last period start (R2).
    expect(answers.lastPeriodStart).toBeNull();
  });

  it("never reconstructs a 'trying to conceive' goal from a profile", () => {
    const answers = answersFromProfile(DEFAULT_PROFILE);
    expect("tryingToConceive" in answers).toBe(false);
  });
});

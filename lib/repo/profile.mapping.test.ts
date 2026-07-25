import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import type { Profile } from "@/lib/domain/types";
import { profileSchema } from "@/lib/domain/schema";
import { DEFAULT_PROFILE } from "@/lib/repo/profile";
import { PROFILE_ID, fromRow, toRow } from "@/lib/repo/profile.mapping";

const FULLY_POPULATED_PROFILE: Profile = {
  birthYear: 1994,
  menarcheYear: 2008,
  reportedTypicalCycleLength: 29,
  reportedTypicalPeriodDays: 5,
  reportedRegularity: "variable",
  state: {
    pregnant: false,
    deliveryDate: parseCivil("2020-04-01"),
    breastfeeding: true,
    hormonalMethod: { kind: "combined_pill", startedOn: parseCivil("2023-01-10") },
    copperIudInsertedOn: parseCivil("2019-05-05"),
    stoppedHormonalOn: parseCivil("2022-12-31"),
    perimenopauseSelfDeclared: true,
    menopauseSelfDeclared: false,
    knownIrregular: true,
    preferNotToSay: false,
  },
  settings: {
    fertilityEnabled: true,
    tierCSymptomsEnabled: true,
    healthAwarenessEnabled: false,
    notifications: {
      periodReminder: true,
      fertileReminder: true,
      symptomReminder: true,
      medicationReminder: true,
      loggingReminder: true,
      healthAwareness: true,
      privateWording: false,
    },
    locale: "en-GB",
  },
};

describe("lib/repo/profile.mapping", () => {
  it("round-trips a fully-populated profile, including hormonalMethod, through toRow/fromRow", () => {
    const row = toRow(FULLY_POPULATED_PROFILE);
    expect(fromRow(row)).toEqual(FULLY_POPULATED_PROFILE);
  });

  it("round-trips DEFAULT_PROFILE (the minimal profile: no optional scalars, no hormonalMethod)", () => {
    const row = toRow(DEFAULT_PROFILE);
    expect(fromRow(row)).toEqual(DEFAULT_PROFILE);
  });

  it("always writes row id = PROFILE_ID (the fixed singleton row)", () => {
    expect(toRow(DEFAULT_PROFILE).id).toBe(PROFILE_ID);
    expect(toRow(FULLY_POPULATED_PROFILE).id).toBe(PROFILE_ID);
  });

  it("writes every optional scalar/date as SQL null, not undefined, when absent", () => {
    const row = toRow(DEFAULT_PROFILE);
    expect(row.birthYear).toBeNull();
    expect(row.menarcheYear).toBeNull();
    expect(row.reportedTypicalCycleLength).toBeNull();
    expect(row.reportedTypicalPeriodDays).toBeNull();
    expect(row.reportedRegularity).toBeNull();
    expect(row.stateDeliveryDate).toBeNull();
    expect(row.stateCopperIudInsertedOn).toBeNull();
    expect(row.stateStoppedHormonalOn).toBeNull();
    expect(row.stateHormonalMethodKind).toBeNull();
    expect(row.stateHormonalMethodStartedOn).toBeNull();
  });

  it("reconstructs state.hormonalMethod only when stateHormonalMethodKind is non-null", () => {
    const withMethod = toRow(FULLY_POPULATED_PROFILE);
    expect(fromRow(withMethod).state.hormonalMethod).toEqual({
      kind: "combined_pill",
      startedOn: "2023-01-10",
    });

    const withoutMethod = toRow(DEFAULT_PROFILE);
    expect(fromRow(withoutMethod).state.hormonalMethod).toBeUndefined();

    // Belt-and-suspenders: even a row that (incorrectly) has a started-on date but no
    // kind must not reconstruct a hormonalMethod object — kind is the gate.
    const rowWithOrphanDate = { ...withoutMethod, stateHormonalMethodStartedOn: "2023-01-10" };
    expect(fromRow(rowWithOrphanDate).state.hormonalMethod).toBeUndefined();
  });

  it("round-trips preferNotToSay in both directions", () => {
    const preferNotToSayTrue: Profile = {
      ...DEFAULT_PROFILE,
      state: { ...DEFAULT_PROFILE.state, preferNotToSay: true },
    };
    expect(fromRow(toRow(preferNotToSayTrue)).state.preferNotToSay).toBe(true);
    expect(fromRow(toRow(DEFAULT_PROFILE)).state.preferNotToSay).toBe(false);
  });

  it("round-trips every settings and notification field independently", () => {
    const flipped: Profile = {
      ...DEFAULT_PROFILE,
      settings: {
        fertilityEnabled: true,
        tierCSymptomsEnabled: true,
        healthAwarenessEnabled: false,
        notifications: {
          periodReminder: true,
          fertileReminder: true,
          symptomReminder: true,
          medicationReminder: true,
          loggingReminder: true,
          healthAwareness: true,
          privateWording: false,
        },
        locale: "en-GB",
      },
    };
    expect(fromRow(toRow(flipped))).toEqual(flipped);
    // and the opposite polarity (DEFAULT_PROFILE) still round-trips too
    expect(fromRow(toRow(DEFAULT_PROFILE)).settings).toEqual(DEFAULT_PROFILE.settings);
  });

  it("every date field survives the round trip as a plain 'YYYY-MM-DD' string", () => {
    const row = toRow(FULLY_POPULATED_PROFILE);
    for (const value of [
      row.stateDeliveryDate,
      row.stateHormonalMethodStartedOn,
      row.stateCopperIudInsertedOn,
      row.stateStoppedHormonalOn,
    ]) {
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
    const back = fromRow(row);
    expect(back.state.deliveryDate).toBe("2020-04-01");
    expect(back.state.hormonalMethod?.startedOn).toBe("2023-01-10");
    expect(back.state.copperIudInsertedOn).toBe("2019-05-05");
    expect(back.state.stoppedHormonalOn).toBe("2022-12-31");
  });

  it("toRow output for DEFAULT_PROFILE and FULLY_POPULATED_PROFILE both validate as a Profile via profileSchema", () => {
    expect(() => profileSchema.parse(fromRow(toRow(DEFAULT_PROFILE)))).not.toThrow();
    expect(() => profileSchema.parse(fromRow(toRow(FULLY_POPULATED_PROFILE)))).not.toThrow();
  });
});

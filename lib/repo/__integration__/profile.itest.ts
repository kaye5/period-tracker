/**
 * Real round-trip tests for lib/repo/profile.ts against MySQL — the singleton `profile`
 * table (docs/DB-MIGRATION.md §3.3), including the `hormonalMethod` reconstruct-only-
 * when-kind-is-non-null rule and the notification-booleans defaults.
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { DEFAULT_PROFILE, deleteProfile, getProfile, getProfileOrDefault, upsertProfile } from "@/lib/repo/profile";
import type { Profile } from "@/lib/domain/types";
import { parseCivil } from "@/lib/date/civil";
import { closeDb, describeIfDb, ensureMigrationsApplied, itIfDb, truncateAll } from "@/lib/repo/testUtils";

function fullyPopulatedProfile(): Profile {
  return {
    birthYear: 1994,
    menarcheYear: 2008,
    reportedTypicalCycleLength: 29,
    reportedTypicalPeriodDays: 5,
    reportedRegularity: "variable",
    state: {
      pregnant: false,
      deliveryDate: parseCivil("2020-06-01"),
      breastfeeding: true,
      hormonalMethod: { kind: "combined_pill", startedOn: parseCivil("2022-01-15") },
      copperIudInsertedOn: parseCivil("2019-05-01"),
      stoppedHormonalOn: parseCivil("2021-12-31"),
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: true,
      preferNotToSay: false,
    },
    settings: {
      fertilityEnabled: true,
      tierCSymptomsEnabled: true,
      healthAwarenessEnabled: true,
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
}

describeIfDb("lib/repo/profile.ts (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("round-trips a fully-populated profile, including the hormonalMethod object", async () => {
    const input = fullyPopulatedProfile();
    const upserted = await upsertProfile(input);
    expect(upserted).toEqual(input);

    const fetched = await getProfile();
    expect(fetched).toEqual(input);
  });

  itIfDb("reconstructs hormonalMethod as undefined, not a partial object, when kind is null", async () => {
    const input: Profile = {
      state: {
        pregnant: false,
        breastfeeding: false,
        perimenopauseSelfDeclared: false,
        menopauseSelfDeclared: false,
        knownIrregular: false,
        preferNotToSay: false,
      },
      settings: {
        fertilityEnabled: false,
        tierCSymptomsEnabled: false,
        healthAwarenessEnabled: true,
        notifications: {
          periodReminder: false,
          fertileReminder: false,
          symptomReminder: false,
          medicationReminder: false,
          loggingReminder: false,
          healthAwareness: false,
          privateWording: true,
        },
        locale: "en-US",
      },
    };
    await upsertProfile(input);
    const fetched = await getProfile();
    expect(fetched!.state.hormonalMethod).toBeUndefined();
    expect(fetched!.state.deliveryDate).toBeUndefined();
    expect(fetched!.birthYear).toBeUndefined();
  });

  itIfDb("getProfile returns null and getProfileOrDefault returns DEFAULT_PROFILE before any write", async () => {
    expect(await getProfile()).toBeNull();
    expect(await getProfileOrDefault()).toEqual(DEFAULT_PROFILE);
  });

  itIfDb("upsertProfile is a full replace: a second write without old fields drops them", async () => {
    await upsertProfile(fullyPopulatedProfile());
    const minimal: Profile = {
      state: {
        pregnant: false,
        breastfeeding: false,
        perimenopauseSelfDeclared: false,
        menopauseSelfDeclared: false,
        knownIrregular: false,
        preferNotToSay: false,
      },
      settings: {
        fertilityEnabled: false,
        tierCSymptomsEnabled: false,
        healthAwarenessEnabled: true,
        notifications: {
          periodReminder: false,
          fertileReminder: false,
          symptomReminder: false,
          medicationReminder: false,
          loggingReminder: false,
          healthAwareness: false,
          privateWording: true,
        },
        locale: "en-US",
      },
    };
    await upsertProfile(minimal);
    const fetched = await getProfile();
    expect(fetched).toEqual(minimal);
    expect(fetched!.birthYear).toBeUndefined();
    expect(fetched!.state.hormonalMethod).toBeUndefined();
  });

  itIfDb("deleteProfile hard-deletes the singleton row", async () => {
    await upsertProfile(fullyPopulatedProfile());
    expect(await deleteProfile()).toBe(true);
    expect(await getProfile()).toBeNull();
    expect(await deleteProfile()).toBe(false);
  });
});

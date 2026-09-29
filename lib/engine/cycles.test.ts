import { describe, expect, it } from "vitest";
import { addDays, parseCivil, type CivilDate } from "@/lib/date/civil";
import type {
  BleedingEpisode,
  DayLog,
  LifeStageState,
  Profile,
  Settings,
} from "@/lib/domain/types";
import { MAX_CYCLE, MIN_IMPLIED, NO_SPLIT_BELOW } from "@/lib/engine/constants";
import {
  applyUserSkipDecision,
  buildCycles,
  buildEpisodes,
  buildSkipPrompt,
  detectSkips,
  deriveSkipSuppressionState,
  type SkipSuppressionState,
} from "@/lib/engine/cycles";

// ----------------------------------------------------------------------------
// Test fixtures / factories
// ----------------------------------------------------------------------------

function d(s: string): CivilDate {
  return parseCivil(s);
}

/** Minimal valid DayLog for a given date and bleeding kind. */
function log(
  date: string,
  bleeding: DayLog["bleeding"],
  extra: Partial<DayLog> = {},
): DayLog {
  return {
    date: d(date),
    bleeding,
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: d(date),
    ...extra,
  };
}

/** A "today" comfortably after every date used in the tests below that don't care
 * about the today-boundary rule specifically — just needs to be later than the
 * fixture's last date so the closing-streak-vs-today guard never engages by accident. */
const FAR_FUTURE_TODAY = d("2026-06-01");

const NO_SUPPRESSION: SkipSuppressionState = {
  perimenopause: false,
  postpartum: false,
  recentHormonalContraceptionStop: false,
};

const DEFAULT_SETTINGS: Settings = {
  fertilityEnabled: false,
  tierCSymptomsEnabled: false,
  healthAwarenessEnabled: true,
  notifications: {
    periodReminder: true,
    fertileReminder: false,
    symptomReminder: true,
    medicationReminder: false,
    loggingReminder: true,
    healthAwareness: true,
    privateWording: true,
  },
  locale: "en-US",
};

const DEFAULT_STATE: LifeStageState = {
  pregnant: false,
  breastfeeding: false,
  perimenopauseSelfDeclared: false,
  menopauseSelfDeclared: false,
  knownIrregular: false,
  preferNotToSay: false,
};

function profile(overrides: Partial<Profile> = {}): Profile {
  return {
    state: DEFAULT_STATE,
    settings: DEFAULT_SETTINGS,
    ...overrides,
  };
}

/** Sample-standard-deviation (n-1 denominator), computed independently of lib/stat so
 * this test verifies the research doc's arithmetic claim, not our own stat helpers. */
function sampleStdDev(values: number[]): number {
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sumSq = values.reduce((a, b) => a + (b - mean) ** 2, 0);
  return Math.sqrt(sumSq / (n - 1));
}

function mean(values: number[]): number {
  return values.reduce((a, b) => a + b, 0) / values.length;
}

// ----------------------------------------------------------------------------
// buildEpisodes
// ----------------------------------------------------------------------------

describe("buildEpisodes", () => {
  it("returns nothing for an empty log", () => {
    expect(buildEpisodes([], FAR_FUTURE_TODAY)).toEqual([]);
  });

  it("spotting never opens an episode (R6), even surrounded by silence", () => {
    const logs = [log("2026-03-01", "spotting"), log("2026-03-02", "spotting")];
    expect(buildEpisodes(logs, FAR_FUTURE_TODAY)).toEqual([]);
  });

  it("a 3-day bleed with a single 1-day gap stays one episode", () => {
    const logs = [
      log("2026-03-01", "menstrual"),
      log("2026-03-02", "none"),
      log("2026-03-03", "menstrual"),
      log("2026-03-04", "menstrual"),
      // trailing 2 none days to close it
      log("2026-03-05", "none"),
      log("2026-03-06", "none"),
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].menstrualDays).toEqual([d("2026-03-01"), d("2026-03-03"), d("2026-03-04")]);
    expect(episodes[0].startDate).toBe(d("2026-03-01"));
    expect(episodes[0].endDate).toBe(d("2026-03-04"));
    expect(episodes[0].endInferred).toBe(true);
    expect(episodes[0].durationDays).toBe(4);
  });

  it("closes on 2 consecutive non-bleeding days, with endDate at the last bleeding day", () => {
    const logs = [
      log("2026-03-01", "menstrual"),
      log("2026-03-02", "menstrual"),
      log("2026-03-03", "none"),
      log("2026-03-04", "none"),
      log("2026-03-05", "menstrual"), // a new, separate episode
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].endDate).toBe(d("2026-03-02"));
    expect(episodes[0].endInferred).toBe(true);
    expect(episodes[1].startDate).toBe(d("2026-03-05"));
  });

  it("does not close on a single non-bleeding day", () => {
    const logs = [
      log("2026-03-01", "menstrual"),
      log("2026-03-02", "none"),
      log("2026-03-03", "menstrual"),
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].endDate).toBeNull(); // still ongoing — no 2-day close seen
  });

  it("an explicit periodBoundary 'end' closes immediately, without waiting for a gap", () => {
    const logs = [
      log("2026-03-01", "menstrual"),
      log("2026-03-02", "menstrual", { periodBoundary: "end" }),
      log("2026-03-03", "menstrual"), // a new episode — previous one explicitly ended
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].endDate).toBe(d("2026-03-02"));
    expect(episodes[0].endInferred).toBe(false);
    expect(episodes[1].startDate).toBe(d("2026-03-03"));
  });

  it("leading (pre-period) spotting attaches to the episode it connects to", () => {
    const logs = [
      log("2026-03-01", "spotting"),
      log("2026-03-02", "spotting"),
      log("2026-03-03", "menstrual"),
      log("2026-03-04", "menstrual"),
      log("2026-03-05", "none"),
      log("2026-03-06", "none"),
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].startDate).toBe(d("2026-03-01")); // spans back to the spotting
    expect(episodes[0].spottingDays).toEqual([d("2026-03-01"), d("2026-03-02")]);
    expect(episodes[0].menstrualDays).toEqual([d("2026-03-03"), d("2026-03-04")]);
  });

  it("orphaned spotting (no nearby menstrual day) produces no episode", () => {
    const logs = [
      log("2026-03-01", "spotting"),
      log("2026-03-02", "none"),
      log("2026-03-03", "none"),
      // a real period much later, unrelated
      log("2026-03-20", "menstrual"),
      log("2026-03-21", "menstrual"),
      log("2026-03-22", "none"),
      log("2026-03-23", "none"),
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].spottingDays).toEqual([]);
    expect(episodes[0].startDate).toBe(d("2026-03-20"));
  });

  it("trailing (post-period) spotting attaches and keeps the episode open", () => {
    const logs = [
      log("2026-03-01", "menstrual"),
      log("2026-03-02", "menstrual"),
      log("2026-03-03", "spotting"),
      log("2026-03-04", "spotting"),
      log("2026-03-05", "none"),
      log("2026-03-06", "none"),
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].spottingDays).toEqual([d("2026-03-03"), d("2026-03-04")]);
    expect(episodes[0].endDate).toBe(d("2026-03-04")); // last bleeding-ish (spotting) day
  });

  it("treats an unlogged (missing) PAST day the same as an explicit 'none' for closing", () => {
    const logs = [
      log("2026-03-01", "menstrual"),
      // 2026-03-02 and 2026-03-03 are simply absent from dayLogs
      log("2026-03-04", "menstrual"),
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].endDate).toBe(d("2026-03-01"));
    expect(episodes[1].startDate).toBe(d("2026-03-04"));
  });

  it("does not merge months of periods when only bleeding days are ever logged", () => {
    // The app's own drag-select (buildQuickPeriodDayLog) writes `bleeding: 'menstrual'`
    // and nothing else — no 'none' rows for the days in between, no periodBoundary. If
    // an unlogged past day could not advance the closing streak, every period a user
    // ever logged merged into ONE open episode: zero completed cycles, prediction
    // degraded to a population estimate anchored on their first period ever, and the
    // calendar painted a months-stale predicted range.
    const logs = ["2026-04-07", "2026-05-05", "2026-06-02", "2026-09-22"].flatMap((start) =>
      [0, 1, 2, 3, 4].map((offset) => log(addDays(d(start), offset), "menstrual")),
    );
    const episodes = buildEpisodes(logs, d("2026-09-29"));
    expect(episodes).toHaveLength(4);
    expect(episodes[0].endDate).toBe(d("2026-04-11"));
    expect(episodes[3].startDate).toBe(d("2026-09-22"));
  });

  it("a later, unrelated log does not retroactively close an open period across unlogged days", () => {
    // The exact reported bug: a period logged Sep 27 only (today = Sep 28, not
    // declared ended) must stay open. Reproduces the mechanism: a later log dated
    // after the open period (e.g. a same-day-or-later "nothing to report" symptom
    // entry with bleeding: 'none') used to extend buildEpisodes's walk far enough that
    // the *unlogged* days in between (Sep 28, Sep 29) were miscounted as two
    // consecutive non-bleeding days, fabricating endDate: 2026-09-27 / durationDays: 1.
    const logs = [
      log("2026-09-27", "menstrual"),
      // 2026-09-28 and 2026-09-29 are simply absent — the user never logged them.
      log("2026-09-30", "none"), // an unrelated later entry (e.g. a symptom-only log)
    ];
    const today = d("2026-09-28");
    const episodes = buildEpisodes(logs, today);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].startDate).toBe(d("2026-09-27"));
    expect(episodes[0].endDate).toBeNull();
    expect(episodes[0].durationDays).toBeNull();
    expect(episodes[0].endInferred).toBe(true);
  });

  it("never closes an episode using today or future days, even if explicitly logged 'none'", () => {
    // Today isn't over yet — a 'none' logged for today (or later) is not proof
    // bleeding won't resume later today, so it must not count toward the closing
    // streak, unlike a 'none' logged for a genuinely past day.
    const logs = [
      log("2026-09-27", "menstrual"),
      log("2026-09-28", "none"), // today
      log("2026-09-29", "none"), // tomorrow (e.g. a pre-filled/back-dated stray log)
    ];
    const today = d("2026-09-28");
    const episodes = buildEpisodes(logs, today);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].endDate).toBeNull();
    expect(episodes[0].durationDays).toBeNull();
  });

  it("leaves the most recent episode open when logging simply stops", () => {
    const logs = [log("2026-03-01", "menstrual"), log("2026-03-02", "menstrual")];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(1);
    expect(episodes[0].endDate).toBeNull();
    expect(episodes[0].durationDays).toBeNull();
  });

  it("an explicit 'start' boundary splits an otherwise-bridged period into two episodes", () => {
    const logs = [
      log("2026-03-01", "menstrual"),
      log("2026-03-02", "none"), // only 1 non-bleeding day — would normally bridge
      log("2026-03-03", "menstrual", { periodBoundary: "start" }),
    ];
    const episodes = buildEpisodes(logs, FAR_FUTURE_TODAY);
    expect(episodes).toHaveLength(2);
    expect(episodes[0].endDate).toBe(d("2026-03-01"));
    expect(episodes[1].startDate).toBe(d("2026-03-03"));
  });
});

// ----------------------------------------------------------------------------
// detectSkips
// ----------------------------------------------------------------------------

describe("detectSkips", () => {
  const params = { lHat: 29, sigmaHat: 3 };

  it("a 44-day gap (< NO_SPLIT_BELOW) is always accepted as a single cycle", () => {
    expect(NO_SPLIT_BELOW).toBe(45);
    const [ann] = detectSkips([44], params, NO_SUPPRESSION);
    expect(ann.status).toBe("ok");
    expect(ann.kStar).toBeUndefined();
    expect(ann.gapDays).toBe(44);
  });

  it("a 92-day gap (> MAX_CYCLE) is gap_unknown and is never split", () => {
    expect(MAX_CYCLE).toBe(90);
    const [ann] = detectSkips([92], { lHat: 29, sigmaHat: 3 }, NO_SUPPRESSION);
    expect(ann.status).toBe("gap_unknown");
    expect(ann.kStar).toBeUndefined();
  });

  it("flags a clean 2x merge as skip_suspected with k*=2", () => {
    // G=58, L_hat=29: z_1 = (58-29)/2.5 huge; z_2 = (58-58)/(sqrt(2)*2.5) = 0.
    const [ann] = detectSkips([58], { lHat: 29, sigmaHat: 1 }, NO_SUPPRESSION);
    expect(ann.status).toBe("skip_suspected");
    expect(ann.kStar).toBe(2);
    expect(ann.impliedCycleLengthDays).toBe(29);
  });

  it("suppresses an otherwise-decisive skip under perimenopause", () => {
    // G=70, L_hat=35: z_1 huge, z_2 = (70-70)/(sqrt(2)*2.5) = 0 -> decisive without suppression.
    const gapParams = { lHat: 35, sigmaHat: 1 };
    const [unsuppressed] = detectSkips([70], gapParams, NO_SUPPRESSION);
    expect(unsuppressed.status).toBe("skip_suspected");
    expect(unsuppressed.kStar).toBe(2);

    const [suppressed] = detectSkips([70], gapParams, {
      perimenopause: true,
      postpartum: false,
      recentHormonalContraceptionStop: false,
    });
    expect(suppressed.status).toBe("ok");
    expect(suppressed.kStar).toBeUndefined();
  });

  it("also suppresses under postpartum and recent-HC-stop", () => {
    const gapParams = { lHat: 35, sigmaHat: 1 };
    expect(
      detectSkips([70], gapParams, {
        perimenopause: false,
        postpartum: true,
        recentHormonalContraceptionStop: false,
      })[0].status,
    ).toBe("ok");
    expect(
      detectSkips([70], gapParams, {
        perimenopause: false,
        postpartum: false,
        recentHormonalContraceptionStop: true,
      })[0].status,
    ).toBe("ok");
  });

  it("merges a raw gap < MIN_CYCLE forward into the following gap", () => {
    // gaps: 5 (too short alone), 30 (normal) -> merged to a single 35-day group.
    const anns = detectSkips([5, 30], params, NO_SUPPRESSION);
    expect(anns).toHaveLength(1);
    expect(anns[0].gapDays).toBe(35);
    expect(anns[0].mergedRawGapCount).toBe(2);
    expect(anns[0].status).toBe("ok");
  });

  it("merges a trailing raw gap < MIN_CYCLE backward into the previous group", () => {
    const anns = detectSkips([30, 5], params, NO_SUPPRESSION);
    expect(anns).toHaveLength(1);
    expect(anns[0].gapDays).toBe(35);
    expect(anns[0].mergedRawGapCount).toBe(2);
  });

  it("K_max respects MIN_IMPLIED (implied cycle length floor)", () => {
    // Sanity check the constant relationship the scoring loop depends on.
    expect(Math.floor(58 / MIN_IMPLIED)).toBeGreaterThanOrEqual(2);
  });

  it("every annotation carries a non-empty, human-readable statusReason", () => {
    const anns = detectSkips([20, 44, 58, 92], params, NO_SUPPRESSION);
    for (const ann of anns) {
      expect(typeof ann.statusReason).toBe("string");
      expect(ann.statusReason.length).toBeGreaterThan(0);
    }
  });
});

// ----------------------------------------------------------------------------
// Regression guard — 01-cycle-prediction.md §5.2
// ----------------------------------------------------------------------------

describe("regression guard: one merged 2L cycle inflates naive stats, detector catches it", () => {
  // Six *observed* cycles: five genuinely 29 days, one is a merged pair that should
  // have been two 29-day cycles but one log was missed, so it shows up as 58 days.
  const L = 29;
  const rawGapDays = [L, L, 2 * L, L, L, L]; // sum = 203

  it("the naive mean is inflated by ~L/6 (~4.8 days) and the naive SD goes from 0 to ~11.8", () => {
    const naiveMean = mean(rawGapDays);
    expect(naiveMean - L).toBeCloseTo(L / 6, 5);
    expect(naiveMean - L).toBeCloseTo(4.833, 2);

    const naiveSd = sampleStdDev(rawGapDays);
    expect(naiveSd).toBeCloseTo(L / Math.sqrt(6), 5);
    expect(naiveSd).toBeCloseTo(11.84, 1);
  });

  it("detectSkips flags exactly the merged gap, and excluding it recovers mean=L, SD=0", () => {
    const anns = detectSkips(rawGapDays, { lHat: L, sigmaHat: 1 }, NO_SUPPRESSION);
    expect(anns).toHaveLength(6);

    const flagged = anns.filter((a) => a.status === "skip_suspected");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].gapDays).toBe(2 * L);
    expect(flagged[0].kStar).toBe(2);

    const corrected = anns.filter((a) => a.status === "ok").map((a) => a.gapDays);
    expect(corrected).toEqual([L, L, L, L, L]);
    expect(mean(corrected)).toBe(L);
    expect(sampleStdDev(corrected)).toBe(0);
  });

  it("the same regression guard holds end-to-end through buildEpisodes + buildCycles", () => {
    // Seven period starts, 29 days apart, except one missed log turning two 29-day
    // gaps into one observed 58-day gap.
    let cursor = d("2026-01-01");
    const starts: CivilDate[] = [cursor];
    for (const gap of rawGapDays) {
      cursor = addDays(cursor, gap);
      starts.push(cursor);
    }
    expect(starts).toHaveLength(7);

    const logs: DayLog[] = [];
    for (const s of starts) {
      logs.push(log(s, "menstrual"));
      logs.push(log(addDays(s, 1), "menstrual"));
      logs.push(log(addDays(s, 2), "none"));
      logs.push(log(addDays(s, 3), "none"));
    }
    const today = addDays(starts[6], 20);
    const episodes = buildEpisodes(logs, today);
    expect(episodes).toHaveLength(7);

    const cycles = buildCycles(episodes, profile(), today, {
      lHat: L,
      sigmaHat: 1,
    });

    const completed = cycles.filter((c) => c.status !== "in_progress");
    expect(completed).toHaveLength(6);

    const flagged = completed.filter((c) => c.status === "skip_suspected");
    expect(flagged).toHaveLength(1);
    expect(flagged[0].lengthDays).toBe(58);
    expect(flagged[0].impliedSplitCount).toBe(2);

    const ok = completed.filter((c) => c.status === "ok").map((c) => c.lengthDays);
    expect(ok).toEqual([29, 29, 29, 29, 29]);
  });
});

// ----------------------------------------------------------------------------
// buildCycles
// ----------------------------------------------------------------------------

describe("buildCycles", () => {
  function episode(start: string, end: string): BleedingEpisode {
    return {
      startDate: d(start),
      endDate: d(end),
      menstrualDays: [d(start), d(end)],
      spottingDays: [],
      durationDays: 2,
      endInferred: true,
    };
  }

  it("returns [] for no episodes", () => {
    expect(buildCycles([], profile(), d("2026-06-01"))).toEqual([]);
  });

  it("returns a single in_progress cycle for one episode", () => {
    const cycles = buildCycles([episode("2026-05-01", "2026-05-02")], profile(), d("2026-05-10"));
    expect(cycles).toHaveLength(1);
    expect(cycles[0].status).toBe("in_progress");
    expect(cycles[0].index).toBe(-1);
    expect(cycles[0].lengthDays).toBeNull();
    expect(cycles[0].nextStartDate).toBeNull();
  });

  it("builds a chain of ok cycles, most recent first, with sequential indices", () => {
    const episodes = [
      episode("2026-01-01", "2026-01-02"),
      episode("2026-01-30", "2026-01-31"), // +29
      episode("2026-02-28", "2026-03-01"), // +29
      episode("2026-03-29", "2026-03-30"), // +29
    ];
    const cycles = buildCycles(episodes, profile(), d("2026-04-15"), { lHat: 29, sigmaHat: 1 });
    expect(cycles).toHaveLength(4); // 3 completed + 1 in-progress
    expect(cycles[0].status).toBe("in_progress");
    expect(cycles[0].startDate).toBe(d("2026-03-29"));

    const completed = cycles.slice(1);
    expect(completed.map((c) => c.index)).toEqual([0, 1, 2]);
    expect(completed.every((c) => c.status === "ok")).toBe(true);
    expect(completed.map((c) => c.lengthDays)).toEqual([29, 29, 29]);
    // most recent completed cycle first
    expect(completed[0].startDate).toBe(d("2026-02-28"));
    expect(completed[2].startDate).toBe(d("2026-01-01"));
  });

  it("suppresses skip detection end-to-end when perimenopauseSelfDeclared is set", () => {
    const episodes = [
      episode("2026-01-01", "2026-01-02"),
      episode("2026-03-12", "2026-03-13"), // +70 days
    ];
    const withSuppression = profile({
      state: { ...DEFAULT_STATE, perimenopauseSelfDeclared: true },
    });
    const cycles = buildCycles(episodes, withSuppression, d("2026-04-01"), {
      lHat: 35,
      sigmaHat: 1,
    });
    const completed = cycles.filter((c) => c.status !== "in_progress");
    expect(completed).toHaveLength(1);
    expect(completed[0].status).toBe("ok");
  });

  it("falls back to the population-prior constants when no detectorParams are given", () => {
    // No detectorParams passed at all -> must not throw, must still classify.
    const episodes = [episode("2026-01-01", "2026-01-02"), episode("2026-01-30", "2026-01-31")];
    const cycles = buildCycles(episodes, profile(), d("2026-02-15"));
    expect(cycles.some((c) => c.status === "ok")).toBe(true);
  });
});

describe("deriveSkipSuppressionState", () => {
  it("flags perimenopause by age even without self-declaration", () => {
    const p = profile({ birthYear: 1980 });
    const state = deriveSkipSuppressionState(p, d("2026-01-01")); // age 46
    expect(state.perimenopause).toBe(true);
  });

  it("flags postpartum within the suppression window", () => {
    const p = profile({ state: { ...DEFAULT_STATE, deliveryDate: d("2026-01-01") } });
    expect(deriveSkipSuppressionState(p, d("2026-02-01")).postpartum).toBe(true);
    expect(deriveSkipSuppressionState(p, d("2027-06-01")).postpartum).toBe(false);
  });

  it("flags recent hormonal-contraception stop within the suppression window", () => {
    const p = profile({ state: { ...DEFAULT_STATE, stoppedHormonalOn: d("2026-01-01") } });
    expect(deriveSkipSuppressionState(p, d("2026-01-15")).recentHormonalContraceptionStop).toBe(
      true,
    );
    expect(deriveSkipSuppressionState(p, d("2027-01-01")).recentHormonalContraceptionStop).toBe(
      false,
    );
  });

  it("defaults to no suppression for an otherwise-empty profile", () => {
    const state = deriveSkipSuppressionState(profile(), d("2026-01-01"));
    expect(state).toEqual(NO_SUPPRESSION);
  });
});

// ----------------------------------------------------------------------------
// buildSkipPrompt
// ----------------------------------------------------------------------------

describe("buildSkipPrompt", () => {
  it("returns null for a non-skip_suspected cycle", () => {
    const cycle = {
      index: 0,
      startDate: d("2026-01-01"),
      nextStartDate: d("2026-01-30"),
      lengthDays: 29,
      status: "ok" as const,
      weight: 1,
      episode: {
        startDate: d("2026-01-01"),
        endDate: d("2026-01-03"),
        menstrualDays: [d("2026-01-01")],
        spottingDays: [],
        durationDays: 3,
        endInferred: true,
      },
    };
    expect(buildSkipPrompt(cycle)).toBeNull();
  });

  it("builds a single suggested date for k*=2", () => {
    const cycle = {
      index: 0,
      startDate: d("2026-01-01"),
      nextStartDate: d("2026-02-28"),
      lengthDays: 58,
      status: "skip_suspected" as const,
      impliedSplitCount: 2,
      weight: 1,
      episode: {
        startDate: d("2026-01-01"),
        endDate: d("2026-01-03"),
        menstrualDays: [d("2026-01-01")],
        spottingDays: [],
        durationDays: 3,
        endInferred: true,
      },
    };
    const prompt = buildSkipPrompt(cycle);
    expect(prompt).not.toBeNull();
    expect(prompt!.options).toEqual([d("2026-01-30")]); // +29
    expect(prompt!.suggestedDate).toBe(d("2026-01-30"));
    expect(prompt!.question).toContain("2026-01-30");
  });

  it("builds multiple options for k*=3", () => {
    const cycle = {
      index: 0,
      startDate: d("2026-01-01"),
      nextStartDate: d("2026-04-01"),
      lengthDays: 90,
      status: "skip_suspected" as const,
      impliedSplitCount: 3,
      weight: 1,
      episode: {
        startDate: d("2026-01-01"),
        endDate: d("2026-01-03"),
        menstrualDays: [d("2026-01-01")],
        spottingDays: [],
        durationDays: 3,
        endInferred: true,
      },
    };
    const prompt = buildSkipPrompt(cycle);
    expect(prompt!.options).toHaveLength(2);
    expect(prompt!.options[0]).toBe(addDays(d("2026-01-01"), 30));
    expect(prompt!.options[1]).toBe(addDays(d("2026-01-01"), 60));
  });
});

// ----------------------------------------------------------------------------
// applyUserSkipDecision
// ----------------------------------------------------------------------------

describe("applyUserSkipDecision", () => {
  const start0 = d("2026-01-01");
  const mid = addDays(start0, 58); // end of the skip-suspected gap == start of the next cycle
  const nextEnd = addDays(mid, 63); // an ordinary following cycle

  function baseCycles() {
    const skipEpisode: BleedingEpisode = {
      startDate: start0,
      endDate: d("2026-01-03"),
      menstrualDays: [start0, addDays(start0, 1)],
      spottingDays: [],
      durationDays: 3,
      endInferred: true,
    };
    return [
      {
        index: -1,
        startDate: nextEnd,
        nextStartDate: null,
        lengthDays: null,
        status: "in_progress" as const,
        weight: 1,
        episode: skipEpisode,
      },
      {
        index: 0,
        startDate: mid,
        nextStartDate: nextEnd,
        lengthDays: 63,
        status: "ok" as const,
        weight: 1,
        episode: skipEpisode,
      },
      {
        index: 1,
        startDate: start0,
        nextStartDate: mid,
        lengthDays: 58,
        status: "skip_suspected" as const,
        statusReason: "looks like a missed period",
        impliedSplitCount: 2,
        weight: 1,
        episode: skipEpisode,
      },
    ];
  }

  it("leaves cycles unchanged when the user declines", () => {
    const cycles = baseCycles();
    const result = applyUserSkipDecision(cycles, {
      cycleStartDate: start0,
      confirmed: false,
    });
    expect(result).toBe(cycles);
  });

  it("leaves cycles unchanged when the decision doesn't match any cycle", () => {
    const cycles = baseCycles();
    const result = applyUserSkipDecision(cycles, {
      cycleStartDate: d("2020-01-01"),
      confirmed: true,
    });
    expect(result).toEqual(cycles);
  });

  it("leaves cycles unchanged when the target cycle isn't skip_suspected", () => {
    const cycles = baseCycles();
    const result = applyUserSkipDecision(cycles, {
      cycleStartDate: mid, // status 'ok'
      confirmed: true,
    });
    expect(result).toEqual(cycles);
  });

  it("splits a confirmed k*=2 skip into two weight-0.5 'ok' cycles that reindex correctly", () => {
    const cycles = baseCycles();
    const result = applyUserSkipDecision(cycles, {
      cycleStartDate: start0,
      confirmed: true,
    });

    // 3 original cycles -> 4 (the skip_suspected one becomes 2)
    expect(result).toHaveLength(4);

    const inProgress = result.find((c) => c.status === "in_progress")!;
    expect(inProgress.index).toBe(-1);

    const completed = result.filter((c) => c.status !== "in_progress");
    expect(completed.map((c) => c.index)).toEqual([0, 1, 2]);

    const splitPieces = completed.filter((c) => c.weight === 0.5);
    expect(splitPieces).toHaveLength(2);
    for (const piece of splitPieces) {
      expect(piece.status).toBe("ok");
    }
    // The two pieces' lengths sum to the original 58-day gap.
    const totalLength = splitPieces.reduce((sum, c) => sum + (c.lengthDays ?? 0), 0);
    expect(totalLength).toBe(58);

    // Boundaries chain correctly: first piece starts at the original start, last
    // piece's nextStartDate is the original cycle's nextStartDate.
    const sorted = [...splitPieces].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    expect(sorted[0].startDate).toBe(start0);
    expect(sorted[0].nextStartDate).toBe(sorted[1].startDate);
    expect(sorted[1].nextStartDate).toBe(mid);

    // The untouched cycles keep weight 1.
    const untouched = completed.filter((c) => c.weight === 1);
    expect(untouched).toHaveLength(1);
    expect(untouched[0].startDate).toBe(mid);
  });

  it("honors a user-supplied inferredStartDate for k*=2", () => {
    const cycles = baseCycles();
    const result = applyUserSkipDecision(cycles, {
      cycleStartDate: start0,
      confirmed: true,
      inferredStartDate: d("2026-02-01"),
    });
    const splitPieces = result.filter((c) => c.weight === 0.5);
    const sorted = [...splitPieces].sort((a, b) => (a.startDate < b.startDate ? -1 : 1));
    expect(sorted[0].nextStartDate).toBe(d("2026-02-01"));
    expect(sorted[1].startDate).toBe(d("2026-02-01"));
  });
});

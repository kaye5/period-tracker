import { describe, expect, it } from "vitest";

import { addDays, diffDays, parseCivil, type CivilDate } from "@/lib/date/civil";
import {
  MU0_DEFAULT,
  NU0,
  SIGMA0,
  SIGMA_FLOOR,
  TAU0,
  WINDOW,
} from "@/lib/engine/constants";
import type {
  BleedingEpisode,
  CalibrationState,
  Cycle,
  CycleStatus,
  Profile,
} from "@/lib/domain/types";
import {
  MORE_CONSISTENT_MEDIAN_CLD_MAX,
  NORMAL_UPPER_QUANTILE,
  POPULATION_TOTAL_SD,
  conjugatePredictive,
  lifeStageContext,
  medianCycleLengthDifference,
  mu0ForAge,
  predictNextPeriod,
  predictiveSpreadDays,
  usableCycleLengths,
} from "@/lib/engine/prediction";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const d = (s: string): CivilDate => parseCivil(s);

const NEUTRAL_CALIBRATION: CalibrationState = {
  cumulativeAdjustment: 1,
  recentCoverage: [],
};

function episode(startDate: CivilDate): BleedingEpisode {
  return {
    startDate,
    endDate: addDays(startDate, 4),
    menstrualDays: [startDate],
    spottingDays: [],
    durationDays: 5,
    endInferred: false,
  };
}

function makeCycle(
  index: number,
  startDate: CivilDate,
  lengthDays: number | null,
  status: CycleStatus = "ok",
  weight = 1,
): Cycle {
  return {
    index,
    startDate,
    nextStartDate: lengthDays === null ? null : addDays(startDate, lengthDays),
    lengthDays,
    status,
    weight,
    episode: episode(startDate),
  };
}

/**
 * Build a cycle history, most recent LAST in `lengths`, anchored so the most recent cycle
 * starts on `lastStart`. Returns cycles with index 0 = most recent, as the type contract
 * says.
 */
function historyFrom(lastStart: CivilDate, lengths: number[]): Cycle[] {
  // Walk backwards from lastStart: cycle i (0 = most recent) starts lengths[..] before.
  const reversed = [...lengths].reverse(); // most recent first
  const cycles: Cycle[] = [];
  let start = lastStart;
  for (let i = 0; i < reversed.length; i++) {
    start = addDays(start, -reversed[i]);
    cycles.push(makeCycle(i, start, reversed[i]));
  }
  return cycles;
}

function makeProfile(overrides: Partial<Profile> = {}): Profile {
  return {
    state: {
      pregnant: false,
      breastfeeding: false,
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: false,
      preferNotToSay: false,
      ...(overrides.state ?? {}),
    },
    settings: {
      fertilityEnabled: false,
      tierCSymptomsEnabled: false,
      healthAwarenessEnabled: true,
      notifications: {
        periodReminder: true,
        fertileReminder: false,
        symptomReminder: false,
        medicationReminder: false,
        loggingReminder: false,
        healthAwareness: true,
        privateWording: true,
      },
      locale: "en-US",
      ...(overrides.settings ?? {}),
    },
    ...overrides,
  } as Profile;
}

const TODAY = d("2026-07-22");

/** n values with mean exactly `m` and sample SD (n-1 denominator) exactly `sd`. */
function seriesWithSd(n: number, m: number, sd: number): number[] {
  if (n % 2 !== 0) throw new Error("seriesWithSd needs an even n");
  const a = sd * Math.sqrt((n - 1) / n);
  return Array.from({ length: n }, (_, i) => (i % 2 === 0 ? m + a : m - a));
}

// ---------------------------------------------------------------------------
// §4.2 worked-behaviour table
// ---------------------------------------------------------------------------

describe("conjugatePredictive — research §4.2 worked-behaviour table", () => {
  // The table's own caveat: "These rows use rho = 1 (no decay) so that n_eff = n."
  // The table also predates SIGMA_FLOOR, which §4.3/STEP 3 introduce afterwards, so it is
  // reproduced here with the floor switched off. See the floor test below for the pipeline
  // behaviour.
  const opts = { rho: 1, sigmaFloor: 0, mu0: 29 };

  const rows: Array<{
    label: string;
    lengths: number[];
    muPost: number;
    sigma: number;
    half: number;
  }> = [
    { label: "n=1, L=30", lengths: [30], muPost: 29.6, sigma: 3.5, half: 7.3 },
    {
      label: "n=6, SD=1.5",
      lengths: seriesWithSd(6, 29, 1.5),
      muPost: 29.0,
      sigma: 2.45,
      half: 3.7,
    },
    {
      label: "n=6, SD=6.0",
      lengths: seriesWithSd(6, 29, 6.0),
      muPost: 29.0,
      sigma: 5.21,
      half: 7.8,
    },
    {
      label: "n=12, SD=1.0",
      lengths: seriesWithSd(12, 29, 1.0),
      muPost: 29.0,
      sigma: 1.85,
      half: 2.6,
    },
    {
      label: "n=12, SD=7.0",
      lengths: seriesWithSd(12, 29, 7.0),
      muPost: 29.0,
      sigma: 6.41,
      half: 8.9,
    },
  ];

  for (const row of rows) {
    it(`reproduces "${row.label}" to the table's printed precision`, () => {
      const dist = conjugatePredictive(row.lengths, opts);
      expect(dist.nEff).toBeCloseTo(row.lengths.length, 10);
      expect(dist.muPost).toBeCloseTo(row.muPost, 1);
      expect(dist.sigmaRaw).toBeCloseTo(row.sigma, 2);
      // The table prints half-widths to 1 dp; agree to within half a printed unit.
      expect(Math.abs(dist.halfWidthRaw - row.half)).toBeLessThan(0.05);
    });

    it(`stays within the brief's 0.3 d tolerance with the pipeline's SIGMA_FLOOR on: ${row.label}`, () => {
      const dist = conjugatePredictive(row.lengths, { rho: 1, mu0: 29 });
      expect(Math.abs(dist.sigma - row.sigma)).toBeLessThanOrEqual(0.3);
      expect(Math.abs(dist.halfWidthRaw - row.half)).toBeLessThanOrEqual(0.3);
    });
  }

  it("matches the §4.2 n=1 row term by term, not just at the endpoint", () => {
    const dist = conjugatePredictive([30], { rho: 1, sigmaFloor: 0, mu0: 29 });
    // sigma^2 = (nu0 * sigma0^2 + 0) / (nu0 + 1 - 1) = sigma0^2
    expect(dist.ss).toBeCloseTo(0, 12);
    expect(dist.sigmaRaw).toBeCloseTo(SIGMA0, 12);
    // prec = 1/tau0^2 + 1/sigma^2
    const precision = 1 / TAU0 ** 2 + 1 / SIGMA0 ** 2;
    expect(dist.muPost).toBeCloseTo((29 / TAU0 ** 2 + 30 / SIGMA0 ** 2) / precision, 10);
    expect(dist.tauPost).toBeCloseTo(Math.sqrt(1 / precision), 10);
    expect(dist.df).toBeCloseTo(NU0, 10);
  });

  it("uses the Kish effective sample size: rho=0.9 over 12 cycles gives n_eff ~ 10.6", () => {
    const dist = conjugatePredictive(seriesWithSd(12, 29, 2), { rho: 0.9 });
    expect(dist.nEff).toBeGreaterThan(10.4);
    expect(dist.nEff).toBeLessThan(10.8);
  });

  it("weights recent cycles more heavily than old ones", () => {
    // Six 26-day cycles then six 32-day ones, most recent first vs. reversed.
    const recentShort = [26, 26, 26, 26, 26, 26, 32, 32, 32, 32, 32, 32];
    const recentLong = [...recentShort].reverse();
    const a = conjugatePredictive(recentShort);
    const b = conjugatePredictive(recentLong);
    expect(a.weightedMeanLength).toBeLessThan(b.weightedMeanLength);
  });

  it("honours per-observation weights (the w x 0.5 for confirmed inferred splits)", () => {
    const full = conjugatePredictive([40, 28, 28, 28], { rho: 1 });
    const halved = conjugatePredictive([40, 28, 28, 28], {
      rho: 1,
      weights: [0.5, 1, 1, 1],
    });
    expect(halved.weightedMeanLength).toBeLessThan(full.weightedMeanLength);
  });

  it("applies SIGMA_FLOOR: a very consistent 12-cycle history cannot claim a tighter sigma", () => {
    const dist = conjugatePredictive(Array(12).fill(29));
    expect(dist.sigmaRaw).toBeLessThan(SIGMA_FLOOR);
    expect(dist.sigma).toBe(SIGMA_FLOOR);
  });

  it("throws rather than inventing a distribution from no data", () => {
    expect(() => conjugatePredictive([])).toThrow();
  });
});

// ---------------------------------------------------------------------------
// mu0 / helpers
// ---------------------------------------------------------------------------

describe("mu0ForAge", () => {
  it("reads the §3.2 age table and falls back to MU0_DEFAULT", () => {
    expect(mu0ForAge(20)).toBe(28.5);
    expect(mu0ForAge(28)).toBe(28.3);
    expect(mu0ForAge(33)).toBe(28.0);
    expect(mu0ForAge(38)).toBe(27.7);
    expect(mu0ForAge(43)).toBe(27.4);
    expect(mu0ForAge(48)).toBe(27.2);
    expect(mu0ForAge(60)).toBe(28.0);
    expect(mu0ForAge(null)).toBe(MU0_DEFAULT);
  });
});

describe("medianCycleLengthDifference", () => {
  it("is the median of successive absolute differences (S2/S18)", () => {
    expect(medianCycleLengthDifference([28, 30, 27, 31])).toBe(3);
    expect(medianCycleLengthDifference([29])).toBeNull();
  });
});

describe("usableCycleLengths", () => {
  it("keeps only ok cycles inside [MIN_CYCLE, MAX_CYCLE] and sorts most recent first", () => {
    const cycles: Cycle[] = [
      makeCycle(0, d("2026-06-01"), 29),
      makeCycle(1, d("2026-05-01"), 31),
      makeCycle(2, d("2026-03-01"), 61, "skip_suspected"),
      makeCycle(3, d("2026-01-01"), 120, "gap_unknown"),
      makeCycle(4, d("2025-12-01"), 30, "excluded_by_user"),
      makeCycle(5, d("2026-07-01"), null, "in_progress"),
      makeCycle(6, d("2025-11-01"), 8), // below MIN_CYCLE even though marked ok
      makeCycle(7, d("2025-09-01"), 95), // above MAX_CYCLE even though marked ok
    ];
    const usable = usableCycleLengths(cycles);
    expect(usable.map((c) => c.lengthDays)).toEqual([29, 31]);
    expect(usable[0].startDate).toBe(d("2026-06-01"));
  });
});

describe("lifeStageContext", () => {
  it("counts postpartum and post-hormonal cycles from the boundary date", () => {
    const cycles = usableCycleLengths(historyFrom(d("2026-06-01"), [29, 30, 28, 29]));
    const context = lifeStageContext(
      makeProfile({
        birthYear: 1996,
        menarcheYear: 2009,
        state: {
          pregnant: false,
          breastfeeding: false,
          perimenopauseSelfDeclared: false,
          menopauseSelfDeclared: false,
          knownIrregular: false,
          preferNotToSay: false,
          stoppedHormonalOn: d("2026-03-15"),
        },
      }),
      TODAY,
      cycles,
    );
    expect(context.age).toBe(30);
    expect(context.gynAgeYears).toBe(17);
    expect(context.postpartumCycles).toBeNull();
    expect(context.cyclesSinceStoppingHc).toBeGreaterThan(0);
    expect(context.cyclesSinceStoppingHc).toBeLessThan(4);
  });
});

// ---------------------------------------------------------------------------
// Edge cases by N (§4.3 and the "Edge cases by N" table)
// ---------------------------------------------------------------------------

describe("predictNextPeriod — N edge cases", () => {
  it("N=0 with no recorded start at all: no forecast", () => {
    const result = predictNextPeriod({
      cycles: [],
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.kind).toBe("none");
    expect(result.center).toBeNull();
    expect(result.low).toBeNull();
    expect(result.high).toBeNull();
    expect(result.suppressed).toEqual({ reason: "insufficient_data" });
    expect(result.confidenceReason.length).toBeGreaterThan(0);
  });

  it("N=0 with a start but no completed cycle: population estimate, mu0 +- 1.28 x 6.1", () => {
    const start = d("2026-07-01");
    const result = predictNextPeriod({
      cycles: [makeCycle(0, start, null, "in_progress")],
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.kind).toBe("population_estimate");
    expect(result.confidence).toBe("early_estimate");
    expect(result.predictedLengthDays).toBe(Math.round(MU0_DEFAULT));
    expect(result.basis.sigma).toBe(POPULATION_TOTAL_SD);
    expect(result.basis.halfWidthDays).toBeCloseTo(
      NORMAL_UPPER_QUANTILE * POPULATION_TOTAL_SD,
      6,
    );
    expect(result.basis.halfWidthDays).toBeCloseTo(7.8, 1);
    expect(result.confidenceReason).toContain("population averages, not your data");
  });

  it("N=0 uses the user's reported typical length when they gave one", () => {
    const start = d("2026-07-01");
    const result = predictNextPeriod({
      cycles: [makeCycle(0, start, null, "in_progress")],
      profile: makeProfile({ reportedTypicalCycleLength: 33 }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.predictedLengthDays).toBe(33);
    expect(result.center).toBe(addDays(start, 33));
    expect(result.confidenceReason).toContain("33");
  });

  it("N=1: runs the pipeline, ~15-day window, still-learning confidence", () => {
    const result = predictNextPeriod({
      cycles: historyFrom(d("2026-07-01"), [30]),
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.kind).toBe("personal");
    expect(result.confidence).toBe("not_enough_information");
    expect(result.center).not.toBeNull();
    const width = diffDays(result.low as CivilDate, result.high as CivilDate);
    expect(width).toBeGreaterThanOrEqual(14);
    expect(width).toBeLessThanOrEqual(16);
  });

  it("N=2: runs the pipeline but still reports still-learning, never a variability verdict", () => {
    const result = predictNextPeriod({
      cycles: historyFrom(d("2026-07-01"), [29, 29]),
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.kind).toBe("personal");
    expect(result.confidence).toBe("not_enough_information");
    expect(result.basis.windowCycles).toBe(2);
  });

  it("N=3-5: predicts, but the variability verdict stays suppressed even for identical cycles", () => {
    for (const n of [3, 4, 5]) {
      const result = predictNextPeriod({
        cycles: historyFrom(d("2026-07-01"), Array(n).fill(29)),
        profile: makeProfile(),
        today: TODAY,
        calibration: NEUTRAL_CALIBRATION,
      });
      expect(result.kind).toBe("personal");
      expect(result.confidence).toBe("limited");
      expect(result.confidenceReason).toContain(`${n}`);
    }
  });

  it("N>=6 with very consistent cycles: the full display upgrades to More consistent", () => {
    const result = predictNextPeriod({
      cycles: historyFrom(d("2026-07-01"), [29, 29, 30, 29, 28, 29, 29]),
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.confidence).toBe("more_consistent");
    expect(
      medianCycleLengthDifference([29, 29, 30, 29, 28, 29, 29]),
    ).toBeLessThanOrEqual(MORE_CONSISTENT_MEDIAN_CLD_MAX);
  });

  it("N>=6 with widely varying cycles: Limited, with the user's real shortest and longest", () => {
    const result = predictNextPeriod({
      cycles: historyFrom(d("2026-07-01"), [26, 38, 27, 36, 26, 38]),
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.confidence).toBe("limited");
    expect(result.confidenceReason).toContain("26");
    expect(result.confidenceReason).toContain("38");
  });

  it("never uses more than WINDOW cycles", () => {
    const result = predictNextPeriod({
      cycles: historyFrom(d("2026-07-01"), Array(20).fill(29)),
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.basis.usableCycles).toBe(20);
    expect(result.basis.windowCycles).toBe(WINDOW);
    expect(result.basis.effectiveN).toBeLessThan(WINDOW);
  });

  it("excludes skip-suspected and gap-unknown cycles from the estimator", () => {
    const clean = historyFrom(d("2026-07-01"), [29, 29, 29, 29, 29, 29]);
    const polluted: Cycle[] = [
      ...clean,
      makeCycle(99, d("2024-01-01"), 58, "skip_suspected"),
      makeCycle(98, d("2023-06-01"), 100, "gap_unknown"),
    ];
    const a = predictNextPeriod({
      cycles: clean,
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    const b = predictNextPeriod({
      cycles: polluted,
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(b.center).toBe(a.center);
    expect(b.low).toBe(a.low);
    expect(b.high).toBe(a.high);
    expect(b.basis.usableCycles).toBe(6);
  });
});

// ---------------------------------------------------------------------------
// Life stage (§7)
// ---------------------------------------------------------------------------

describe("predictNextPeriod — life stage", () => {
  const consistent = historyFrom(d("2026-07-01"), Array(8).fill(29));

  it("suppresses prediction entirely during pregnancy", () => {
    const result = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({
        state: {
          pregnant: true,
          breastfeeding: false,
          perimenopauseSelfDeclared: false,
          menopauseSelfDeclared: false,
          knownIrregular: false,
          preferNotToSay: false,
        },
      }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.kind).toBe("none");
    expect(result.center).toBeNull();
    expect(result.suppressed).toEqual({ reason: "pregnant" });
  });

  it("suppresses prediction on an active hormonal method", () => {
    const result = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({
        state: {
          pregnant: false,
          breastfeeding: false,
          perimenopauseSelfDeclared: false,
          menopauseSelfDeclared: false,
          knownIrregular: false,
          preferNotToSay: false,
          hormonalMethod: { kind: "combined_pill", startedOn: d("2025-01-01") },
        },
      }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.suppressed).toEqual({ reason: "hormonal_method" });
  });

  it("suppresses postpartum until 3 cycles are recorded, then predicts as Limited", () => {
    const twoCycles = historyFrom(d("2026-07-01"), [29, 29]);
    const postpartumState = (deliveryDate: CivilDate) => ({
      pregnant: false,
      breastfeeding: true,
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: false,
      preferNotToSay: false,
      deliveryDate,
    });

    const early = predictNextPeriod({
      cycles: twoCycles,
      profile: makeProfile({ state: postpartumState(d("2026-01-01")) }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(early.suppressed).toEqual({ reason: "postpartum" });

    // Eight identical cycles would otherwise be More consistent; the four of them that
    // fall after delivery hold the verdict at Limited (§7.5).
    const later = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({ state: postpartumState(d("2026-03-01")) }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(later.suppressed).toBeUndefined();
    expect(later.confidence).toBe("limited");
  });

  it("holds the verdict at Limited for the first post-hormonal-contraception cycles", () => {
    const result = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({
        state: {
          pregnant: false,
          breastfeeding: false,
          perimenopauseSelfDeclared: false,
          menopauseSelfDeclared: false,
          knownIrregular: false,
          preferNotToSay: false,
          stoppedHormonalOn: d("2026-04-01"),
        },
      }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(result.confidence).toBe("limited");
  });

  it("widens the interval for a 51-year-old relative to a 38-year-old on identical data", () => {
    const younger = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({ birthYear: 1988 }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    const older = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({ birthYear: 1975 }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(older.basis.halfWidthDays).toBeGreaterThan(younger.basis.halfWidthDays);
  });

  it("widens the interval for a gynaecological age under 3 years", () => {
    const settled = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({ birthYear: 2010, menarcheYear: 2021 }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    const newlyMenstruating = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile({ birthYear: 2010, menarcheYear: 2025 }),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(newlyMenstruating.basis.halfWidthDays).toBeGreaterThan(
      settled.basis.halfWidthDays,
    );
  });
});

// ---------------------------------------------------------------------------
// Calibration, contract, tone
// ---------------------------------------------------------------------------

describe("predictNextPeriod — calibration and output contract", () => {
  const consistent = historyFrom(d("2026-07-01"), Array(8).fill(29));

  it("multiplies the half-width by the stored calibration factor", () => {
    const base = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    const widened = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile(),
      today: TODAY,
      calibration: { cumulativeAdjustment: 1.5, recentCoverage: [] },
    });
    expect(widened.basis.halfWidthDays).toBeCloseTo(base.basis.halfWidthDays * 1.5, 10);
    expect(widened.basis.calibrationFactor).toBe(1.5);
    expect(diffDays(widened.low as CivilDate, widened.high as CivilDate)).toBeGreaterThan(
      diffDays(base.low as CivilDate, base.high as CivilDate),
    );
    // The centre must not move when only the width is recalibrated.
    expect(widened.center).toBe(base.center);
  });

  it("treats a nonsensical stored calibration factor as neutral rather than crashing", () => {
    const result = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile(),
      today: TODAY,
      calibration: { cumulativeAdjustment: 0, recentCoverage: [] },
    });
    expect(result.basis.calibrationFactor).toBe(1);
  });

  it("R8: never returns a bare date — center always comes with low, high and a reason", () => {
    const cases = [
      historyFrom(d("2026-07-01"), []),
      historyFrom(d("2026-07-01"), [29]),
      historyFrom(d("2026-07-01"), Array(12).fill(29)),
      historyFrom(d("2026-07-01"), [22, 41, 26, 35, 29, 31, 27]),
    ];
    for (const cycles of cases) {
      const result = predictNextPeriod({
        cycles,
        profile: makeProfile(),
        today: TODAY,
        calibration: NEUTRAL_CALIBRATION,
      });
      if (result.center !== null) {
        expect(result.low).not.toBeNull();
        expect(result.high).not.toBeNull();
        expect(diffDays(result.low as CivilDate, result.center)).toBeGreaterThanOrEqual(0);
        expect(diffDays(result.center, result.high as CivilDate)).toBeGreaterThanOrEqual(0);
      }
      expect(result.confidenceReason.trim().length).toBeGreaterThan(0);
      expect(["not_enough_information", "early_estimate", "limited", "more_consistent"]).toContain(
        result.confidence,
      );
    }
  });

  it("R1: every emitted date is a YYYY-MM-DD civil date, never a Date", () => {
    const result = predictNextPeriod({
      cycles: consistent,
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    for (const value of [result.center, result.low, result.high]) {
      expect(typeof value).toBe("string");
      expect(value).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    }
  });

  it("never states a percentage or the word accuracy in a confidence reason", () => {
    const histories = [
      [] as number[],
      [30],
      [29, 29],
      [29, 29, 29],
      Array(8).fill(29),
      [26, 38, 27, 36, 26, 38],
    ];
    for (const lengths of histories) {
      const result = predictNextPeriod({
        cycles: historyFrom(d("2026-07-01"), lengths),
        profile: makeProfile(),
        today: TODAY,
        calibration: NEUTRAL_CALIBRATION,
      });
      expect(result.confidenceReason).not.toMatch(/%/);
      expect(result.confidenceReason.toLowerCase()).not.toContain("accur");
      expect(result.confidenceReason.toLowerCase()).not.toContain("guaranteed");
    }
  });

  it("R3: is deterministic and does not depend on wall-clock time", () => {
    const args = {
      cycles: consistent,
      profile: makeProfile(),
      calibration: NEUTRAL_CALIBRATION,
    };
    const a = predictNextPeriod({ ...args, today: TODAY });
    const b = predictNextPeriod({ ...args, today: TODAY });
    expect(b).toEqual(a);
    // Only age-dependent terms may move with `today`, and only across a year boundary.
    const sameYear = predictNextPeriod({ ...args, today: d("2026-01-02") });
    expect(sameYear.center).toBe(a.center);
  });
});

describe("predictiveSpreadDays", () => {
  it("recovers s_pred from a personal prediction's basis", () => {
    const cycles = historyFrom(d("2026-07-01"), Array(9).fill(29));
    const result = predictNextPeriod({
      cycles,
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    const dist = conjugatePredictive(Array(9).fill(29), { mu0: MU0_DEFAULT });
    expect(predictiveSpreadDays(result) as number).toBeCloseTo(dist.sPred, 8);
  });

  it("carries the calibration factor through", () => {
    const cycles = historyFrom(d("2026-07-01"), Array(9).fill(29));
    const base = predictNextPeriod({
      cycles,
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    const widened = predictNextPeriod({
      cycles,
      profile: makeProfile(),
      today: TODAY,
      calibration: { cumulativeAdjustment: 1.4, recentCoverage: [] },
    });
    expect(predictiveSpreadDays(widened) as number).toBeCloseTo(
      (predictiveSpreadDays(base) as number) * 1.4,
      8,
    );
  });

  it("recovers the population SD for a population estimate, and null when suppressed", () => {
    const populationResult = predictNextPeriod({
      cycles: [makeCycle(0, d("2026-07-01"), null, "in_progress")],
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(predictiveSpreadDays(populationResult) as number).toBeCloseTo(
      POPULATION_TOTAL_SD,
      8,
    );

    const none = predictNextPeriod({
      cycles: [],
      profile: makeProfile(),
      today: TODAY,
      calibration: NEUTRAL_CALIBRATION,
    });
    expect(predictiveSpreadDays(none)).toBeNull();
  });
});

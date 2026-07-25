import { describe, expect, it } from "vitest";
import { toCivil, type CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, Cycle, DayLog, Profile } from "@/lib/domain/types";
import { DEFAULT_REPORT_SELECTION, type ReportSelection } from "./reportSelection";
import type { ReportRange } from "./reportRange";
import {
  buildCycleRows,
  buildFertilityRows,
  buildMedicationsAndContraceptionLines,
  buildNoteRows,
  buildPainRows,
  buildPeriodRows,
  buildPregnancyAndLifeStageLines,
  buildReportData,
  buildSexualActivityContextRows,
  buildSymptomRows,
  buildUnexpectedBleedingRows,
} from "./reportData";

const d = (day: number) => toCivil(2026, 1, day);
const range: ReportRange = { from: d(1), to: d(31) };

function log(date: CivilDate, overrides: Partial<DayLog> = {}): DayLog {
  return {
    date,
    bleeding: "none",
    pain: { severity: "none" },
    symptoms: [],
    loggedAt: date,
    ...overrides,
  };
}

function episode(overrides: Partial<BleedingEpisode> = {}): BleedingEpisode {
  return {
    startDate: d(1),
    endDate: d(4),
    menstrualDays: [d(1), d(2), d(3), d(4)],
    spottingDays: [],
    durationDays: 4,
    endInferred: false,
    ...overrides,
  };
}

function cycle(overrides: Partial<Cycle> = {}): Cycle {
  return {
    index: 0,
    startDate: d(1),
    nextStartDate: d(29),
    lengthDays: 28,
    status: "ok",
    weight: 1,
    episode: episode(),
    ...overrides,
  };
}

function profile(overrides: Partial<Profile["state"]> = {}): Profile {
  return {
    state: {
      pregnant: false,
      breastfeeding: false,
      perimenopauseSelfDeclared: false,
      menopauseSelfDeclared: false,
      knownIrregular: false,
      preferNotToSay: false,
      ...overrides,
    },
    settings: {
      fertilityEnabled: true,
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
}

describe("buildPeriodRows", () => {
  it("includes episodes overlapping the range and formats duration/flow", () => {
    const byDate = new Map<CivilDate, DayLog>([
      [d(1), log(d(1), { bleeding: "menstrual", flow: "medium" })],
      [d(2), log(d(2), { bleeding: "menstrual", flow: "heavy" })],
    ]);
    const rows = buildPeriodRows([episode()], byDate, range);
    expect(rows).toHaveLength(1);
    expect(rows[0].durationText).toBe("4 days");
    expect(rows[0].flowLevelsText).toContain("medium");
    expect(rows[0].flowLevelsText).toContain("heavy");
  });

  it("excludes episodes entirely outside the range", () => {
    const rows = buildPeriodRows([episode({ startDate: toCivil(2025, 1, 1), endDate: toCivil(2025, 1, 4), menstrualDays: [] })], new Map(), range);
    expect(rows).toHaveLength(0);
  });

  it("marks an ongoing episode's end as 'Ongoing'", () => {
    const rows = buildPeriodRows([episode({ endDate: null, durationDays: null })], new Map(), range);
    expect(rows[0].endText).toBe("Ongoing");
    expect(rows[0].durationText).toBe("Unknown");
  });
});

describe("buildCycleRows", () => {
  it("includes cycles whose start date is within range, sorted chronologically", () => {
    const rows = buildCycleRows([cycle({ startDate: d(15) }), cycle({ startDate: d(1) })], range);
    expect(rows.map((r) => r.startDate)).toEqual([d(1), d(15)]);
  });

  it("excludes cycles starting outside the range", () => {
    const rows = buildCycleRows([cycle({ startDate: toCivil(2025, 12, 1) })], range);
    expect(rows).toHaveLength(0);
  });
});

describe("buildPainRows", () => {
  it("only includes days with pain logged (severity !== none)", () => {
    const logs = [
      log(d(5), { pain: { severity: "moderate", sites: ["lower_abdomen", "back"] } }),
      log(d(6), { pain: { severity: "none" } }),
    ];
    const rows = buildPainRows(logs, range);
    expect(rows).toHaveLength(1);
    expect(rows[0].severityLabel).toBe("Moderate");
    expect(rows[0].sitesText).toBe("lower abdomen, back");
  });
});

describe("buildSymptomRows", () => {
  it("restates logged symptoms with their display labels", () => {
    const rows = buildSymptomRows([log(d(5), { symptoms: ["cramps", "headache"] })], range);
    expect(rows[0].symptomsText).toContain("cramps");
    expect(rows[0].symptomsText).toContain("headache");
  });
});

describe("unexpected bleeding vs sexual-activity context", () => {
  it("unexpected bleeding is always surfaced, independent of any toggle", () => {
    const rows = buildUnexpectedBleedingRows([log(d(5), { bleeding: "spotting", bleedingContext: "unexpected" })], range);
    expect(rows).toHaveLength(1);
  });

  it("sexual-activity rows only include postcoital/intermenstrual, never 'unexpected'", () => {
    const logs = [
      log(d(5), { bleedingContext: "postcoital" }),
      log(d(6), { bleedingContext: "intermenstrual" }),
      log(d(7), { bleedingContext: "unexpected" }),
    ];
    const rows = buildSexualActivityContextRows(logs, range);
    expect(rows).toHaveLength(2);
    expect(rows.map((r) => r.contextLabel)).not.toContain("Unexpected");
  });
});

describe("buildNoteRows", () => {
  it("only includes days with non-empty notes", () => {
    const rows = buildNoteRows([log(d(5), { notes: "felt tired" }), log(d(6), { notes: "" }), log(d(7))], range);
    expect(rows).toHaveLength(1);
    expect(rows[0].note).toBe("felt tired");
  });
});

describe("buildFertilityRows", () => {
  it("summarizes each fertility field present", () => {
    const rows = buildFertilityRows(
      [log(d(5), { fertility: { cervicalMucus: "egg_white", opkResult: "positive" } })],
      range,
    );
    expect(rows[0].detailsText).toContain("egg_white");
    expect(rows[0].detailsText).toContain("positive");
  });
});

describe("buildMedicationsAndContraceptionLines / buildPregnancyAndLifeStageLines", () => {
  it("describes an active hormonal method and IUD", () => {
    const p = profile();
    p.state.hormonalMethod = { kind: "combined_pill", startedOn: d(1) };
    p.state.copperIudInsertedOn = d(2);
    const lines = buildMedicationsAndContraceptionLines(p);
    expect(lines.some((l) => l.includes("Combined pill"))).toBe(true);
    expect(lines.some((l) => l.includes("Copper IUD"))).toBe(true);
  });

  it("is empty when nothing is set, not a placeholder string", () => {
    expect(buildMedicationsAndContraceptionLines(profile())).toEqual([]);
  });

  it("describes pregnancy/breastfeeding/perimenopause state", () => {
    const lines = buildPregnancyAndLifeStageLines(profile({ pregnant: true, breastfeeding: true }));
    expect(lines.some((l) => l.includes("pregnant"))).toBe(true);
    expect(lines.some((l) => l.includes("breastfeeding"))).toBe(true);
  });
});

describe("buildReportData", () => {
  it("gates optional sections to null (not empty array) when their toggle is off", () => {
    const data = buildReportData({
      range,
      dayLogs: [],
      cycles: [],
      episodes: [],
      profile: profile(),
      selection: DEFAULT_REPORT_SELECTION,
    });
    expect(data.sexualActivityContext).toBeNull();
    expect(data.fertility).toBeNull();
  });

  it("includes gated sections as arrays (possibly empty) once their toggle is on", () => {
    const selection: ReportSelection = { ...DEFAULT_REPORT_SELECTION, includeSexualActivity: true, includeFertilityObservations: true };
    const data = buildReportData({ range, dayLogs: [], cycles: [], episodes: [], profile: profile(), selection });
    expect(data.sexualActivityContext).toEqual([]);
    expect(data.fertility).toEqual([]);
  });

  it("always includes unexpectedBleeding, periods, cycles, pain, symptoms, notes regardless of selection", () => {
    const data = buildReportData({
      range,
      dayLogs: [log(d(5), { bleedingContext: "unexpected" })],
      cycles: [cycle()],
      episodes: [episode()],
      profile: profile(),
      selection: DEFAULT_REPORT_SELECTION,
    });
    expect(data.unexpectedBleeding).toHaveLength(1);
    expect(data.periods).toHaveLength(1);
    expect(data.cycles).toHaveLength(1);
  });
});

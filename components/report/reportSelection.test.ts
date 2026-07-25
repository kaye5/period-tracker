import { describe, expect, it } from "vitest";
import { toCivil } from "@/lib/date/civil";
import {
  buildExportQuery,
  DEFAULT_REPORT_SELECTION,
  effectiveSelection,
  needsProfileInExport,
  type ReportSelection,
} from "./reportSelection";

const range = { from: toCivil(2026, 1, 1), to: toCivil(2026, 7, 23) };

describe("DEFAULT_REPORT_SELECTION", () => {
  it("defaults sexual-activity and fertility to excluded, per SPEC.md", () => {
    expect(DEFAULT_REPORT_SELECTION.includeSexualActivity).toBe(false);
    expect(DEFAULT_REPORT_SELECTION.includeFertilityObservations).toBe(false);
  });
});

describe("effectiveSelection", () => {
  it("passes a selection through unchanged when fertility is enabled", () => {
    const selection: ReportSelection = { ...DEFAULT_REPORT_SELECTION, includeFertilityObservations: true };
    expect(effectiveSelection(selection, true)).toEqual(selection);
  });

  it("forces fertility observations off when the feature is disabled, regardless of the toggle", () => {
    const selection: ReportSelection = { ...DEFAULT_REPORT_SELECTION, includeFertilityObservations: true };
    const result = effectiveSelection(selection, false);
    expect(result.includeFertilityObservations).toBe(false);
  });
});

describe("needsProfileInExport", () => {
  it("is true when either profile-backed toggle is on", () => {
    expect(needsProfileInExport({ ...DEFAULT_REPORT_SELECTION, includeMedicationsAndContraception: true, includePregnancyAndLifeStage: false })).toBe(true);
    expect(needsProfileInExport({ ...DEFAULT_REPORT_SELECTION, includeMedicationsAndContraception: false, includePregnancyAndLifeStage: true })).toBe(true);
  });

  it("is false when both are off", () => {
    expect(
      needsProfileInExport({ ...DEFAULT_REPORT_SELECTION, includeMedicationsAndContraception: false, includePregnancyAndLifeStage: false }),
    ).toBe(false);
  });
});

describe("buildExportQuery", () => {
  it("carries the range and the two export-API-supported toggles", () => {
    const url = buildExportQuery(range, DEFAULT_REPORT_SELECTION, "csv");
    expect(url).toContain("from=2026-01-01");
    expect(url).toContain("to=2026-07-23");
    expect(url).toContain("format=csv");
    expect(url).toContain("includeFertility=false");
    expect(url).toContain("includeSexualActivity=false");
  });

  it("does not set includeProfile for a csv request even when profile toggles are on", () => {
    const selection: ReportSelection = { ...DEFAULT_REPORT_SELECTION, includeMedicationsAndContraception: true };
    const url = buildExportQuery(range, selection, "csv");
    expect(url).not.toContain("includeProfile");
  });

  it("sets includeProfile=true for a json request when a profile toggle is on", () => {
    const selection: ReportSelection = { ...DEFAULT_REPORT_SELECTION, includePregnancyAndLifeStage: true, includeMedicationsAndContraception: false };
    const url = buildExportQuery(range, selection, "json");
    expect(url).toContain("includeProfile=true");
  });

  it("reflects an opted-in sexual-activity/fertility selection", () => {
    const selection: ReportSelection = {
      ...DEFAULT_REPORT_SELECTION,
      includeSexualActivity: true,
      includeFertilityObservations: true,
    };
    const url = buildExportQuery(range, selection, "csv");
    expect(url).toContain("includeSexualActivity=true");
    expect(url).toContain("includeFertility=true");
  });
});

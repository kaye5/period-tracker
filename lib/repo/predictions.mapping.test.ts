/**
 * Pure round-trip tests for lib/repo/predictions.mapping.ts — no database
 * (docs/DB-MIGRATION.md §4.1). These are the primary deterministic coverage for the
 * `low`/`high` <-> `predicted_low`/`predicted_high` renaming, null<->null preservation
 * for every nullable resolution field, and id stringification.
 */
import { describe, expect, it } from "vitest";
import { parseCivil } from "@/lib/date/civil";
import { fromRow, toInsertRow, type PredictionRow } from "@/lib/repo/predictions.mapping";
import type { PredictionRecord } from "@/lib/repo/predictions";

describe("lib/repo/predictions.mapping", () => {
  it("toInsertRow renames low/high to predicted_low/predicted_high and keeps every other field", () => {
    const record: Omit<PredictionRecord, "id"> = {
      issuedOn: parseCivil("2026-03-01"),
      predictedCenter: parseCivil("2026-03-29"),
      low: parseCivil("2026-03-25"),
      high: parseCivil("2026-04-02"),
      resolvedActualStart: null,
      signedError: null,
      covered: null,
    };
    expect(toInsertRow(record)).toEqual({
      issuedOn: "2026-03-01",
      predictedCenter: "2026-03-29",
      predictedLow: "2026-03-25",
      predictedHigh: "2026-04-02",
      resolvedActualStart: null,
      signedError: null,
      covered: null,
    });
  });

  it("toInsertRow preserves null predictedCenter/low/high (an unresolved-shape prediction)", () => {
    const record: Omit<PredictionRecord, "id"> = {
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter: null,
      low: null,
      high: null,
      resolvedActualStart: null,
      signedError: null,
      covered: null,
    };
    const row = toInsertRow(record);
    expect(row.predictedCenter).toBeNull();
    expect(row.predictedLow).toBeNull();
    expect(row.predictedHigh).toBeNull();
  });

  it("fromRow stringifies the numeric id and renames predicted_low/predicted_high back to low/high", () => {
    const row: PredictionRow = {
      id: 42,
      issuedOn: "2026-03-01",
      predictedCenter: "2026-03-29",
      predictedLow: "2026-03-25",
      predictedHigh: "2026-04-02",
      resolvedActualStart: null,
      signedError: null,
      covered: null,
    };
    const record = fromRow(row);
    expect(record.id).toBe("42");
    expect(typeof record.id).toBe("string");
    expect(record.low).toBe("2026-03-25");
    expect(record.high).toBe("2026-04-02");
    // Every date field is a plain "YYYY-MM-DD" string.
    expect(record.issuedOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(record.predictedCenter).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it("fromRow round-trips a fully resolved, covered prediction", () => {
    const row: PredictionRow = {
      id: 7,
      issuedOn: "2026-01-01",
      predictedCenter: "2026-01-29",
      predictedLow: "2026-01-25",
      predictedHigh: "2026-02-02",
      resolvedActualStart: "2026-01-30",
      signedError: 1,
      covered: true,
    };
    expect(fromRow(row)).toEqual({
      id: "7",
      issuedOn: "2026-01-01",
      predictedCenter: "2026-01-29",
      low: "2026-01-25",
      high: "2026-02-02",
      resolvedActualStart: "2026-01-30",
      signedError: 1,
      covered: true,
    });
  });

  it("fromRow round-trips a resolved-but-uncovered prediction with a negative signedError", () => {
    const row: PredictionRow = {
      id: 9,
      issuedOn: "2026-04-05",
      predictedCenter: "2026-04-27",
      predictedLow: "2026-04-23",
      predictedHigh: "2026-05-01",
      resolvedActualStart: "2026-04-10",
      signedError: -17,
      covered: false,
    };
    const record = fromRow(row);
    expect(record.signedError).toBe(-17);
    expect(record.covered).toBe(false);
  });

  it("toInsertRow -> fromRow round-trips every field (id supplied separately, as MySQL would assign it)", () => {
    const original: Omit<PredictionRecord, "id"> = {
      issuedOn: parseCivil("2026-06-01"),
      predictedCenter: parseCivil("2026-06-29"),
      low: parseCivil("2026-06-25"),
      high: parseCivil("2026-07-03"),
      resolvedActualStart: parseCivil("2026-06-28"),
      signedError: -1,
      covered: true,
    };
    const insertRow = toInsertRow(original);
    const row: PredictionRow = { id: 123, ...insertRow };
    expect(fromRow(row)).toEqual({ ...original, id: "123" });
  });
});

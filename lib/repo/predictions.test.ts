/**
 * Tests for the parts of lib/repo/predictions.ts that don't require a database: the
 * `predictionRecordSchema` validation boundary. The actual read/write functions
 * (issuePrediction, listPredictions, resolvePrediction, deleteAllPredictions) now do
 * real Drizzle I/O and are exercised by the integration suite
 * (lib/repo/__integration__/**, owned by the seed/test-infra agent) against a real
 * MySQL, per docs/DB-MIGRATION.md §4. The row<->domain mapping they depend on
 * (id stringification, low/high<->predicted_low/predicted_high) is unit-tested with no
 * database in lib/repo/predictions.mapping.test.ts.
 */
import { describe, expect, it } from "vitest";
import { predictionRecordSchema } from "@/lib/repo/predictions";

const validRecord = {
  issuedOn: "2026-03-01",
  predictedCenter: "2026-03-29",
  low: "2026-03-25",
  high: "2026-04-02",
  resolvedActualStart: null,
  signedError: null,
  covered: null,
};

describe("lib/repo/predictions predictionRecordSchema", () => {
  it("accepts a freshly issued, unresolved record", () => {
    expect(predictionRecordSchema.parse(validRecord)).toEqual(validRecord);
  });

  it("accepts a fully resolved record", () => {
    const resolved = { ...validRecord, resolvedActualStart: "2026-04-01", signedError: 3, covered: true };
    expect(predictionRecordSchema.parse(resolved)).toEqual(resolved);
  });

  it("rejects a malformed civil-date string", () => {
    expect(() => predictionRecordSchema.parse({ ...validRecord, issuedOn: "03/01/2026" })).toThrow();
  });

  it("rejects a non-existent calendar date", () => {
    expect(() => predictionRecordSchema.parse({ ...validRecord, predictedCenter: "2026-02-30" })).toThrow();
  });

  it("rejects a non-number signedError", () => {
    expect(() => predictionRecordSchema.parse({ ...validRecord, signedError: "3" })).toThrow();
  });

  it("rejects a non-boolean covered", () => {
    expect(() => predictionRecordSchema.parse({ ...validRecord, covered: "yes" })).toThrow();
  });

  it("requires issuedOn (not nullable)", () => {
    expect(() => predictionRecordSchema.parse({ ...validRecord, issuedOn: null })).toThrow();
  });
});

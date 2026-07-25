/**
 * Real round-trip tests for lib/repo/predictions.ts against MySQL — the `predictions`
 * table (docs/DB-MIGRATION.md §3.4): auto-increment id stringified into
 * `PredictionRecord.id`, `issued_on` ascending ordering, and the resolve-and-score flow.
 *
 * Skips entirely when DATABASE_URL is unset (describeIfDb/itIfDb — lib/repo/testUtils.ts).
 */
import { afterAll, beforeAll, beforeEach, expect } from "vitest";
import { deleteAllPredictions, issuePrediction, listPredictions, resolvePrediction } from "@/lib/repo/predictions";
import { parseCivil } from "@/lib/date/civil";
import { closeDb, describeIfDb, ensureMigrationsApplied, itIfDb, truncateAll } from "@/lib/repo/testUtils";

describeIfDb("lib/repo/predictions.ts (integration)", () => {
  beforeAll(async () => {
    await ensureMigrationsApplied();
  });

  beforeEach(async () => {
    await truncateAll();
  });

  afterAll(async () => {
    await closeDb();
  });

  itIfDb("issuePrediction round-trips every field and returns a string id", async () => {
    const issuedOn = parseCivil("2026-01-01");
    const predictedCenter = parseCivil("2026-01-29");
    const rec = await issuePrediction({
      issuedOn,
      predictedCenter,
      low: parseCivil("2026-01-25"),
      high: parseCivil("2026-02-02"),
    });

    expect(typeof rec.id).toBe("string");
    expect(rec.id.length).toBeGreaterThan(0);
    expect(rec.issuedOn).toBe(issuedOn);
    expect(rec.predictedCenter).toBe(predictedCenter);
    expect(rec.low).toBe("2026-01-25");
    expect(rec.high).toBe("2026-02-02");
    expect(rec.resolvedActualStart).toBeNull();
    expect(rec.signedError).toBeNull();
    expect(rec.covered).toBeNull();
  });

  itIfDb("issuePrediction accepts null predicted fields (no-prediction case)", async () => {
    const rec = await issuePrediction({
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter: null,
      low: null,
      high: null,
    });
    expect(rec.predictedCenter).toBeNull();
    expect(rec.low).toBeNull();
    expect(rec.high).toBeNull();
  });

  itIfDb("listPredictions orders by issuedOn ascending regardless of insertion order", async () => {
    await issuePrediction({
      issuedOn: parseCivil("2026-03-01"),
      predictedCenter: parseCivil("2026-03-29"),
      low: parseCivil("2026-03-25"),
      high: parseCivil("2026-04-02"),
    });
    await issuePrediction({
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter: parseCivil("2026-01-29"),
      low: parseCivil("2026-01-25"),
      high: parseCivil("2026-02-02"),
    });
    await issuePrediction({
      issuedOn: parseCivil("2026-02-01"),
      predictedCenter: parseCivil("2026-02-28"),
      low: parseCivil("2026-02-25"),
      high: parseCivil("2026-03-05"),
    });

    const all = await listPredictions();
    expect(all.map((p) => p.issuedOn)).toEqual(["2026-01-01", "2026-02-01", "2026-03-01"]);
  });

  itIfDb("listPredictions filters by resolved true/false", async () => {
    const resolved = await issuePrediction({
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter: parseCivil("2026-01-29"),
      low: parseCivil("2026-01-25"),
      high: parseCivil("2026-02-02"),
    });
    await resolvePrediction(resolved.id, parseCivil("2026-01-29"));
    await issuePrediction({
      issuedOn: parseCivil("2026-02-01"),
      predictedCenter: parseCivil("2026-02-28"),
      low: parseCivil("2026-02-25"),
      high: parseCivil("2026-03-05"),
    });

    const resolvedOnly = await listPredictions({ resolved: true });
    expect(resolvedOnly.map((p) => p.issuedOn)).toEqual(["2026-01-01"]);

    const unresolvedOnly = await listPredictions({ resolved: false });
    expect(unresolvedOnly.map((p) => p.issuedOn)).toEqual(["2026-02-01"]);
  });

  itIfDb("resolvePrediction computes signedError and covered against the actual start", async () => {
    const predictedCenter = parseCivil("2026-01-29");
    const rec = await issuePrediction({
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter,
      low: parseCivil("2026-01-25"),
      high: parseCivil("2026-02-02"),
    });

    // Actual start 2 days after the predicted center, inside [low, high] -> covered.
    const resolved = await resolvePrediction(rec.id, parseCivil("2026-01-31"));
    expect(resolved).not.toBeNull();
    expect(resolved!.resolvedActualStart).toBe("2026-01-31");
    expect(resolved!.signedError).toBe(2);
    expect(resolved!.covered).toBe(true);

    const fetchedAgain = await listPredictions();
    expect(fetchedAgain[0].resolvedActualStart).toBe("2026-01-31");
    expect(fetchedAgain[0].signedError).toBe(2);
    expect(fetchedAgain[0].covered).toBe(true);
  });

  itIfDb("resolvePrediction reports covered:false when the actual start misses the window", async () => {
    const rec = await issuePrediction({
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter: parseCivil("2026-01-29"),
      low: parseCivil("2026-01-25"),
      high: parseCivil("2026-02-02"),
    });

    const resolved = await resolvePrediction(rec.id, parseCivil("2026-02-10"));
    expect(resolved!.covered).toBe(false);
    expect(resolved!.signedError).toBe(12);
  });

  itIfDb("deleteAllPredictions empties the table and returns the count removed", async () => {
    await issuePrediction({
      issuedOn: parseCivil("2026-01-01"),
      predictedCenter: parseCivil("2026-01-29"),
      low: parseCivil("2026-01-25"),
      high: parseCivil("2026-02-02"),
    });
    await issuePrediction({
      issuedOn: parseCivil("2026-02-01"),
      predictedCenter: parseCivil("2026-02-28"),
      low: parseCivil("2026-02-25"),
      high: parseCivil("2026-03-05"),
    });

    const removed = await deleteAllPredictions();
    expect(removed).toBe(2);
    expect(await listPredictions()).toEqual([]);
  });
});

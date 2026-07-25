/**
 * Banned-word self-lint for `components/dashboard/copy.ts`, mirroring
 * `lib/copy/lint.test.ts` (SPEC.md §4.4) exactly — same word list, same "walk every
 * export, call functions with generic dummy args" approach. That file only globs
 * `lib/copy/*.ts`, so it cannot see this module (see the header comment in `copy.ts` for
 * why this file lives here instead of under `lib/copy/`); this test is how the same bar
 * is met for dashboard-owned copy.
 */
import { describe, expect, it } from "vitest";
import * as copy from "./copy";

// Transcribed verbatim from SPEC.md §4.4, identical to lib/copy/lint.test.ts's list.
const BANNED_WORDS = [
  "abnormal",
  "pathological",
  "disorder",
  "diagnos",
  "screening",
  "detect",
  "hormone",
  "hormonal imbalance",
  "imbalance",
  "pms",
  "pmdd",
  "pcos",
  "endometriosis",
  "causes",
  "because of your",
  "linked to",
  "significant",
  "p =",
  "safe day",
  "guaranteed",
  "cannot become pregnant",
  "you are ovulating",
  "accuracy",
  "% accurate",
  "medical-grade",
  "clinically accurate",
] as const;

const DUMMY_ARG_SETS: unknown[][] = [
  [],
  [3],
  [3, 3],
  [3, 3, 3],
  ["sample"],
  ["sample", 3],
  ["sample", 3, 3],
];

function collectStrings(value: unknown, depth = 0): string[] {
  if (depth > 4) return [];
  if (typeof value === "string") return [value];
  if (typeof value === "function") {
    const out: string[] = [];
    for (const args of DUMMY_ARG_SETS) {
      try {
        const result = (value as (...a: unknown[]) => unknown)(...args);
        if (typeof result === "string") out.push(result);
      } catch {
        // signature didn't match this guess; try the next one
      }
    }
    return out;
  }
  if (value !== null && typeof value === "object") {
    return Object.values(value as Record<string, unknown>).flatMap((v) =>
      collectStrings(v, depth + 1),
    );
  }
  return [];
}

describe("components/dashboard/copy.ts banned-word lint (SPEC.md §4.4)", () => {
  it("contains no banned words in any export", () => {
    const findings: { exportName: string; text: string }[] = [];
    for (const [exportName, value] of Object.entries(copy)) {
      for (const text of collectStrings(value)) {
        findings.push({ exportName, text });
      }
    }

    // Vacuity guard: if the walker found nothing, it's broken, not the copy.
    expect(findings.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const finding of findings) {
      const lower = finding.text.toLowerCase();
      for (const word of BANNED_WORDS) {
        if (lower.includes(word)) {
          violations.push(
            `export "${finding.exportName}": banned word "${word}" found in: ${JSON.stringify(finding.text)}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("never phrases a prediction as a bare single date (always a range/day-count word nearby)", () => {
    // Spot-check the one string most likely to regress into over-claiming: the header
    // "period expected" headline must always be built around a range, never a lone date.
    const headline = copy.periodExpectedHeadline("July 26–29");
    expect(headline).toContain("between");
    expect(headline).toContain("–");
  });
});

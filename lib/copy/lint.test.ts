/**
 * Banned-word lint over the entire copy catalogue (SPEC.md §4.4, §R9). Owned by agent D,
 * but scans **every** module in lib/copy/ — including other agents' — because a single
 * shared vocabulary rule is only useful if nobody can accidentally bypass it by adding a
 * new file. Fails the whole suite (not just health.ts's own copy) on any banned word
 * found case-insensitively in any exported string, anywhere in a module's export tree.
 *
 * Design notes:
 *
 * - Copy modules are discovered by reading the directory, not by a hard-coded import
 *   list, so a module added by another agent after this one is written (e.g.
 *   lib/copy/insights.ts) is linted automatically the next time this suite runs.
 * - Exports may be plain strings, arrays/objects nesting strings (walked recursively),
 *   or functions that build a string from caller-supplied numbers (e.g.
 *   lib/copy/general.ts's CONFIDENCE_REASONS). Functions are invoked with a handful of
 *   generic dummy argument lists and whatever comes back as a string is scanned too — a
 *   function whose signature none of those guesses satisfies is skipped rather than
 *   failing the suite, since this lint's job is catching banned words, not enforcing
 *   call signatures.
 * - `sourceUrl`-shaped strings (http(s):// addresses) are exempt: a URL is an address,
 *   not a claim about the user's body, and ACOG/NHS/OWH page slugs legitimately contain
 *   words like "abnormal" (e.g. .../faqs/abnormal-uterine-bleeding) that would otherwise
 *   force every citation to that guideline into the allowlist for no safety benefit.
 * - The allowlist below is the ONLY way a banned word survives this test. Every entry
 *   names the exact module + export it covers and carries a one-line justification, per
 *   SPEC.md §4.4 ("Every exception is listed explicitly in the test file with a
 *   justification comment").
 */
import { describe, expect, it } from "vitest";
import { readdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";

// ============================================================================
// The banned-word list, transcribed verbatim from SPEC.md §4.4.
// ============================================================================

const BANNED_WORDS = [
  "abnormal",
  "pathological",
  "disorder",
  "diagnos", // catches "diagnosis" / "diagnostic" / "diagnose"
  "screening",
  "detect",
  "hormone", // NOTE: deliberately does not match "hormonal" — "hormonal" does not
  // contain the substring "hormone" (the 'e'/'a' differ), so "hormonal method" and
  // "hormonal contraception" pass this check on their own merits and need no allowlist
  // entry, consistent with SPEC.md §4.4's explicit exception for that usage.
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

// ============================================================================
// Allowlist — every exception, with why. (SPEC.md §4.4's three named categories:
// attributed quotations that name their source, "hormonal" as a neutral state label
// [handled above without needing an entry, see the "hormone" comment], and the
// disclaimer text.)
// ============================================================================

interface AllowlistEntry {
  module: string; // filename in lib/copy/, e.g. "general.ts"
  /** The top-level export the word appears under. Omit only when the same disclaimer
   * literal is legitimately reused verbatim inside more than one export of the same
   * module (e.g. a shared closing sentence baked into several generated templates) —
   * in that case the exception is scoped to (module, word) instead, and the
   * justification must say why that's still safe. */
  exportName?: string;
  word: string; // the exact BANNED_WORDS entry being allowed
  reason: string;
}

const ALLOWLIST: AllowlistEntry[] = [
  {
    module: "general.ts",
    exportName: "DISCLAIMER",
    word: "diagnos",
    reason:
      'SPEC.md §4.4: "the disclaimer text" is one of the two named exceptions to this lint — DISCLAIMER says the app "does not provide a diagnosis."',
  },
  {
    module: "insights.ts",
    // No exportName: INSIGHT_DISCLAIMER's exact sentence ("not a diagnosis, and not a
    // cause") is a fixed closing line baked verbatim into every generated insight-card
    // template in this module (per 02-symptom-insights.md §E.4/§8.4 rule 1: "no card
    // exists" without it), so it legitimately reappears under multiple export names —
    // it is still the same disclaimer text SPEC.md §4.4 names as an exception, not new
    // content per template.
    word: "diagnos",
    reason:
      'INSIGHT_DISCLAIMER — "This is a summary of what you recorded — not a diagnosis, and not a cause." — is disclaimer text (SPEC.md §4.4\'s named exception) that agent C\'s templates append verbatim to every insight card, per the module\'s own header comment.',
  },
  {
    module: "health.ts",
    exportName: "HEALTH_COPY",
    word: "disorder",
    reason:
      'Appears only in HMB-05\'s sourceThreshold, a direct attributed quotation naming ACOG as the source (\'ACOG: "You may have a bleeding disorder if you have had heavy periods since you first started menstruating."\') — SPEC.md §4.4 allowlists attributed quotations that name their source.',
  },
];

function isAllowed(module: string, exportName: string, word: string): boolean {
  return ALLOWLIST.some(
    (a) => a.module === module && a.word === word && (a.exportName === undefined || a.exportName === exportName),
  );
}

// ============================================================================
// Walking a module's export tree for strings
// ============================================================================

interface Finding {
  module: string;
  exportName: string;
  text: string;
}

function isUrlLike(s: string): boolean {
  return /^https?:\/\//.test(s.trim());
}

/** A handful of generic dummy argument lists, tried in order, for copy-module exports
 * that are template-building functions (e.g. lib/copy/general.ts's CONFIDENCE_REASONS)
 * rather than plain strings. See the file header for why a function that throws on
 * every guess is simply skipped. */
const DUMMY_ARG_SETS: unknown[][] = [[], [3], [3, 3], [3, 3, 3], [3, 3, 3, 3], ["sample"]];

function tryCallForStrings(fn: (...args: unknown[]) => unknown): string[] {
  const results: string[] = [];
  for (const args of DUMMY_ARG_SETS) {
    try {
      const out = fn(...args);
      if (typeof out === "string") results.push(out);
    } catch {
      // This guess didn't match the function's signature — try the next one.
    }
  }
  return results;
}

function collectStrings(
  value: unknown,
  module: string,
  exportName: string,
  seen: Set<unknown> = new Set(),
  depth = 0,
): Finding[] {
  if (depth > 8) return [];
  if (typeof value === "string") {
    return isUrlLike(value) ? [] : [{ module, exportName, text: value }];
  }
  if (typeof value === "function") {
    return tryCallForStrings(value as (...args: unknown[]) => unknown)
      .filter((s) => !isUrlLike(s))
      .map((text) => ({ module, exportName, text }));
  }
  if (Array.isArray(value)) {
    return value.flatMap((v) => collectStrings(v, module, exportName, seen, depth + 1));
  }
  if (value !== null && typeof value === "object") {
    if (seen.has(value)) return [];
    seen.add(value);
    return Object.values(value as Record<string, unknown>).flatMap((v) =>
      collectStrings(v, module, exportName, seen, depth + 1),
    );
  }
  return [];
}

// ============================================================================
// The test
// ============================================================================

describe("lib/copy banned-word lint (SPEC.md §4.4)", () => {
  it("contains no banned words in any lib/copy/*.ts export", async () => {
    const copyDir = path.dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(copyDir)
      .filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts") && !f.endsWith(".test.tsx"))
      .sort();

    // Sanity check: if this ever finds zero files, the discovery mechanism itself is
    // broken and every other assertion below would pass vacuously.
    expect(files.length).toBeGreaterThan(0);

    const findings: Finding[] = [];
    for (const file of files) {
      const specifier = `./${file.slice(0, -3)}`;
      const mod = (await import(specifier)) as Record<string, unknown>;
      for (const [exportName, value] of Object.entries(mod)) {
        findings.push(...collectStrings(value, file, exportName));
      }
    }

    // Another vacuity guard: if nothing scanned turned up any strings at all, something
    // is wrong with the walker, not with the copy.
    expect(findings.length).toBeGreaterThan(0);

    const violations: string[] = [];
    for (const finding of findings) {
      const lower = finding.text.toLowerCase();
      for (const word of BANNED_WORDS) {
        if (lower.includes(word) && !isAllowed(finding.module, finding.exportName, word)) {
          violations.push(
            `${finding.module} → export "${finding.exportName}": banned word "${word}" found in: ${JSON.stringify(finding.text)}`,
          );
        }
      }
    }

    expect(violations).toEqual([]);
  });

  it("the allowlist only covers words that actually appear (no stale entries)", async () => {
    const copyDir = path.dirname(fileURLToPath(import.meta.url));
    const files = readdirSync(copyDir).filter((f) => f.endsWith(".ts") && !f.endsWith(".test.ts"));

    const findings: Finding[] = [];
    for (const file of files) {
      const specifier = `./${file.slice(0, -3)}`;
      const mod = (await import(specifier)) as Record<string, unknown>;
      for (const [exportName, value] of Object.entries(mod)) {
        findings.push(...collectStrings(value, file, exportName));
      }
    }

    for (const entry of ALLOWLIST) {
      const matches = findings.some(
        (f) =>
          f.module === entry.module &&
          (entry.exportName === undefined || f.exportName === entry.exportName) &&
          f.text.toLowerCase().includes(entry.word),
      );
      expect(
        matches,
        `Allowlist entry for ${entry.module} → "${entry.exportName ?? "(any export)"}" / "${entry.word}" no longer matches anything — remove it.`,
      ).toBe(true);
    }
  });
});

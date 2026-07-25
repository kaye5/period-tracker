/**
 * SPEC.md §0.1 privacy-claim guard. Distinct from the §4.4 banned-word lint
 * (lint.test.ts): "encrypt", "private", "local-only", and "secure" are NOT on the §4.4
 * list, so that lint gives false comfort here — it cannot catch a false privacy
 * reassurance. §0.1 is absolute: "No string anywhere may claim the data is encrypted,
 * private-by-design, or secure." docs/PRIVACY.md adds that no string claims the app is
 * private-by-design or keeps your data private, or that the data is encrypted.
 *
 * This test pins the two user-facing surfaces that regressed:
 *   1. lib/copy/general.ts's PRIVACY_STATEMENT (rendered verbatim in Settings).
 *   2. app/layout.tsx's metadata.description (rendered as <meta name="description">,
 *      surfaced in tab context, link/share previews, and search results).
 */
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { PRIVACY_STATEMENT } from "@/lib/copy/general";

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, "..", "..");

/** Claims §0.1 / docs/PRIVACY.md forbid the app from making about itself or the data. */
const FORBIDDEN_CLAIMS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bencrypt/i, label: "claims the data is encrypted (§0.1)" },
  { pattern: /local-only/i, label: "claims local-only storage (false per DEC-009)" },
  { pattern: /private-by-design/i, label: "claims private-by-design (§0.1)" },
  { pattern: /\bsecure\b/i, label: "claims the app is secure (§0.1)" },
  { pattern: /\bprivate\b/i, label: "claims the app/data is private (docs/PRIVACY.md)" },
];

function assertNoForbiddenClaim(text: string, where: string): void {
  for (const { pattern, label } of FORBIDDEN_CLAIMS) {
    expect(
      pattern.test(text),
      `${where} ${label}: matched ${pattern} in: ${JSON.stringify(text)}`,
    ).toBe(false);
  }
}

describe("SPEC.md §0.1 — no user-facing string claims the data is encrypted/private/secure", () => {
  it("PRIVACY_STATEMENT (Settings copy) makes no forbidden privacy claim", () => {
    assertNoForbiddenClaim(PRIVACY_STATEMENT, "PRIVACY_STATEMENT");
  });

  it("app/layout.tsx metadata.description makes no forbidden privacy claim", () => {
    const src = readFileSync(path.join(REPO_ROOT, "app", "layout.tsx"), "utf8");
    // Extract the description string literal from the metadata block so comments
    // (which legitimately name the forbidden words to explain the rule) are excluded.
    const match = src.match(/description:\s*\n?\s*("(?:[^"\\]|\\.)*")/);
    expect(match, "could not locate metadata.description string in app/layout.tsx").not.toBeNull();
    const description = JSON.parse(match![1]) as string;
    assertNoForbiddenClaim(description, "app/layout.tsx metadata.description");
  });
});

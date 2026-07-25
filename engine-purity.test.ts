/**
 * SPEC.md R1 + R3 CI guard (written by agent I — integration).
 *
 * R3: "Everything under `lib/engine/`, `lib/date/` and `lib/stat/` must be free of I/O,
 * `Date.now()`, randomness, environment access, and React." R1: "`lib/date/civil.ts` is
 * the only file permitted to construct `Date` objects." Together these are the guarantee
 * that makes the engine deterministic and its tests meaningful — the same recompute over
 * the same `dayLogs` + `profile` + `today` always yields the same `EngineOutput` (the
 * reliability property PRD §17 / SPEC §4.1 depend on).
 *
 * This test statically scans the pure layers for the forbidden constructs. It excludes:
 *   - `lib/date/civil.ts` — the ONE file R1 permits to construct `Date` (pinned to UTC noon).
 *   - `*.test.ts` files — tests legitimately build fixtures and may use `Date` in helpers.
 * Comments and string-free code are what we check; line- and block-comments are stripped
 * first so a doc-comment that merely *names* `Date.now()` (as several engine files do, to
 * state that they avoid it) is not a false positive.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["lib/engine", "lib/stat", "lib/date"].map((d) =>
  path.resolve(__dirname, d),
);
const EXCLUDE_FILES = new Set([path.resolve(__dirname, "lib/date/civil.ts")]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (path.extname(entry) !== ".ts") continue;
    if (/\.test\.ts$/.test(entry)) continue; // test fixtures may use Date in helpers
    if (EXCLUDE_FILES.has(full)) continue; // civil.ts is the one permitted Date constructor
    out.push(full);
  }
  return out;
}

/** Remove block comments and line comments so we only scan executable code. */
function stripComments(src: string): string {
  const noBlock = src.replace(/\/\*[\s\S]*?\*\//g, "");
  return noBlock
    .split("\n")
    .map((line) => line.replace(/\/\/.*$/, ""))
    .join("\n");
}

const FORBIDDEN: { name: string; pattern: RegExp }[] = [
  { name: "new Date(...) — R1: only lib/date/civil.ts may construct a Date", pattern: /new\s+Date\b/ },
  { name: "Date.now() — R3: engine must not read the clock", pattern: /\bDate\.now\s*\(/ },
  { name: "Math.random() — R3: engine must be deterministic", pattern: /\bMath\.random\s*\(/ },
  { name: "process.env — R3: no environment access in the pure layer", pattern: /\bprocess\.env\b/ },
];

describe("SPEC R1 + R3 — the pure engine/date/stat layers are deterministic", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("scans a non-trivial number of pure-layer source files", () => {
    expect(files.length).toBeGreaterThan(8);
  });

  it("contains no clock, randomness, environment, or stray Date construction", () => {
    const violations: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      const lines = code.split("\n");
      for (const rule of FORBIDDEN) {
        for (let i = 0; i < lines.length; i++) {
          if (rule.pattern.test(lines[i])) {
            const rel = path.relative(__dirname, file);
            violations.push(`${rel}:${i + 1} — ${rule.name}`);
          }
        }
      }
    }
    expect(violations, `purity violations:\n${violations.join("\n")}`).toEqual([]);
  });
});

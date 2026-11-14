/**
 * MCP-SPEC Part A guard: no server code may read the host's time zone. "Today" comes from
 * the user's zone (lib/time/requestTimeZone.ts). `resolvedOptions().timeZone` is allowed
 * only in browser code under components/, which this test does not scan.
 *
 * Statically scans every .ts/.tsx under app/ and lib/ (excluding *.test.ts), with comments
 * stripped the same way engine-purity.test.ts does so prose naming the call is not flagged.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "lib"].map((d) => path.resolve(__dirname, d));

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (![".ts", ".tsx"].includes(path.extname(entry))) continue;
    if (/\.test\.ts$/.test(entry)) continue;
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

describe("MCP-SPEC Part A — server code never uses the host time zone", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("scans a non-trivial number of source files", () => {
    expect(files.length).toBeGreaterThan(20);
  });

  it("no app/ or lib/ file calls resolvedOptions().timeZone", () => {
    const violations: string[] = [];
    for (const file of files) {
      const lines = stripComments(readFileSync(file, "utf8")).split("\n");
      lines.forEach((line, i) => {
        if (/resolvedOptions\(\)\s*\.\s*timeZone/.test(line)) {
          violations.push(`${path.relative(__dirname, file)}:${i + 1}`);
        }
      });
    }
    expect(violations, `host time zone reads:\n${violations.join("\n")}`).toEqual([]);
  });
});

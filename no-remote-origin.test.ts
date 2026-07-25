/**
 * SPEC.md §0.1 CI guard (written by agent I — integration; the spec calls for exactly this
 * test: "A CI test asserts the absence of outbound `fetch`/`XMLHttpRequest` to non-relative
 * URLs in `app/` and `components/`" — plus the broader §0.1 rule that no third-party script,
 * font, or image is loaded from a remote origin).
 *
 * It statically scans every source file under app/ and components/ (excluding test files,
 * which legitimately contain example URLs as fixtures) for:
 *   - fetch() / XMLHttpRequest / WebSocket / EventSource pointed at an absolute or
 *     protocol-relative URL,
 *   - a remote font import (next/font/google or an @import / <link> to a remote stylesheet),
 *   - a <script>/<link>/<img> tag or CSS url() that loads a resource from a remote origin.
 *
 * Note on external *links*: an <a href="https://..."> to a cited medical source (the
 * "Why am I seeing this?" panels build these from lib/copy/health.ts) is NOT a violation —
 * it is user-initiated navigation, not an auto-loaded resource, and it leaks no user data.
 * Those strings live in lib/copy, which is outside this scan's app/ + components/ scope, and
 * the resource-load checks below deliberately target only fetch/XHR/script/link/img/url(),
 * never anchor hrefs.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOTS = ["app", "components"].map((d) => path.resolve(__dirname, d));
const SCANNED_EXT = new Set([".ts", ".tsx", ".css"]);

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry === "node_modules" || entry.startsWith(".")) continue;
    const full = path.join(dir, entry);
    if (statSync(full).isDirectory()) {
      out.push(...walk(full));
      continue;
    }
    if (!SCANNED_EXT.has(path.extname(entry))) continue;
    // Test fixtures may contain example remote URLs; they ship nothing to the browser.
    if (/\.test\.(ts|tsx)$/.test(entry)) continue;
    out.push(full);
  }
  return out;
}

interface Rule {
  name: string;
  pattern: RegExp;
}

const RULES: Rule[] = [
  {
    name: "fetch() to an absolute or protocol-relative URL",
    pattern: /fetch\s*\(\s*[`'"](?:https?:)?\/\//i,
  },
  {
    name: "XMLHttpRequest usage (any; SPEC forbids XHR to non-relative URLs)",
    pattern: /new\s+XMLHttpRequest\b/,
  },
  {
    name: "WebSocket to a remote origin",
    pattern: /new\s+WebSocket\s*\(\s*[`'"]wss?:\/\//i,
  },
  {
    name: "EventSource to an absolute URL",
    pattern: /new\s+EventSource\s*\(\s*[`'"](?:https?:)?\/\//i,
  },
  {
    name: "remote font import (next/font/google)",
    pattern: /from\s+['"]next\/font\/google['"]/,
  },
  {
    name: "<script> loading a remote src",
    pattern: /<script[^>]*\bsrc\s*=\s*[`'"](?:https?:)?\/\//i,
  },
  {
    name: "<link> to a remote resource (stylesheet/font/preload)",
    pattern: /<link[^>]*\bhref\s*=\s*[`'"](?:https?:)?\/\//i,
  },
  {
    name: "<img> loading a remote src",
    pattern: /<img[^>]*\bsrc\s*=\s*[`'"]?(?:https?:)?\/\//i,
  },
  {
    name: "CSS url() loading a remote resource",
    pattern: /url\(\s*['"]?(?:https?:)?\/\//i,
  },
  {
    name: "CSS @import of a remote stylesheet",
    pattern: /@import\s+(?:url\()?\s*['"](?:https?:)?\/\//i,
  },
];

describe("SPEC §0.1 — no remote origin", () => {
  const files = ROOTS.flatMap((r) => walk(r));

  it("scans a non-trivial number of source files", () => {
    // Guards against the walker silently finding nothing (a moved directory, a typo) and
    // the whole suite passing vacuously.
    expect(files.length).toBeGreaterThan(20);
  });

  it("no app/ or components/ file loads or calls a remote origin", () => {
    const violations: string[] = [];
    for (const file of files) {
      const src = readFileSync(file, "utf8");
      const lines = src.split("\n");
      for (const rule of RULES) {
        for (let i = 0; i < lines.length; i++) {
          if (rule.pattern.test(lines[i])) {
            const rel = path.relative(path.resolve(__dirname), file);
            violations.push(`${rel}:${i + 1} — ${rule.name}: ${lines[i].trim()}`);
          }
        }
      }
    }
    expect(violations, `remote-origin violations:\n${violations.join("\n")}`).toEqual([]);
  });
});

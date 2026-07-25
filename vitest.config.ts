import { defineConfig } from "vitest/config";
import path from "node:path";

// Node environment: everything under test here (lib/date, lib/stat, lib/engine, lib/domain,
// and the pure repo mapping functions) is pure computation per SPEC.md R3 — no DOM required.
// The "@/*" alias mirrors the tsconfig.json path mapping so imports match production code
// exactly.
//
// Two projects (DB-MIGRATION.md §4):
//   - "unit": every `*.test.ts(x)` — pure, no database, safe to run file-parallel.
//   - "integration": every `*.itest.ts` — real Drizzle round-trips against the single
//     shared MySQL from `DATABASE_URL`. Because all six files hit the SAME physical
//     database (truncating between tests), running them file-parallel makes them wipe each
//     other's rows and deadlock; pinning the project to a single fork runs them serially,
//     one file at a time. They self-skip when `DATABASE_URL` is unset (describeIfDb /
//     itIfDb — lib/repo/testUtils.ts), so offline `pnpm test` stays green.
const alias = { "@": path.resolve(__dirname, ".") };

export default defineConfig({
  resolve: { alias },
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          environment: "node",
          include: ["**/*.test.ts", "**/*.test.tsx"],
          exclude: ["node_modules/**", ".next/**"],
        },
      },
      {
        resolve: { alias },
        test: {
          name: "integration",
          environment: "node",
          include: ["**/*.itest.ts"],
          exclude: ["node_modules/**", ".next/**"],
          // One worker, one file at a time — the shared MySQL cannot be written by two
          // integration files concurrently without deadlocking / cross-wiping.
          pool: "forks",
          poolOptions: { forks: { singleFork: true } },
        },
      },
    ],
  },
});

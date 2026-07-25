// Registers a tiny custom ESM resolution hook (ts-loader-hooks.mjs) so scripts/seed.ts
// can use ordinary extensionless relative imports and the "@/" path alias — exactly
// like every other TypeScript file in this codebase — while still being runnable with
// plain `node` (Node 22.6+'s built-in TypeScript type-stripping handles the TS syntax
// itself; this hook only adds the module-*resolution* step Node's ESM loader doesn't do
// for extensionless/aliased specifiers, which native `node script.ts` execution needs
// but a bundler like Next.js's/Vite's already provides). This keeps this app's runtime
// dependencies to {drizzle-orm, mysql2, zod} plus vitest for tests (DEC-011) — no
// ts-node/tsx.
//
// Used only by `pnpm db:seed` (see package.json): `node --import
// ./scripts/register-ts-loader.mjs ./scripts/seed.ts`.
import { register } from "node:module";

register("./ts-loader-hooks.mjs", import.meta.url);

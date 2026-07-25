/**
 * drizzle-kit configuration (DEC-011). `drizzle-kit generate` reads this to know which
 * schema module to introspect and where to emit migration SQL. Migrations are ORM-
 * generated only — see docs/DB-MIGRATION.md §1: never hand-write or hand-edit a file
 * under ./drizzle.
 */
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "mysql",
  schema: "./lib/db/schema.ts",
  out: "./drizzle",
  dbCredentials: {
    url: process.env.DATABASE_URL ?? "",
  },
});

/**
 * Barrel for the data layer — repos import from "@/lib/db" rather than reaching into
 * lib/db/client.ts or lib/db/schema.ts individually.
 */
export { getDb, closeDb, type Db } from "@/lib/db/client";
export * as schema from "@/lib/db/schema";
// Named table re-exports too, so a repo can do either
// `import { schema } from "@/lib/db"` + `schema.dayLogs`, or `import { dayLogs } from "@/lib/db"`.
export * from "@/lib/db/schema";

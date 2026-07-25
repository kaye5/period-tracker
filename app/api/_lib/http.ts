/**
 * Small shared helpers for app/api/** route handlers. Not itself a `route.ts` file, so
 * Next.js's App Router does not treat this as a route — it's just a regular module.
 */
import { NextResponse } from "next/server";
import { ZodError } from "zod";

export function jsonError(status: number, message: string, details?: unknown) {
  return NextResponse.json({ error: message, details }, { status });
}

/** Uniform error handling for every route handler's catch block: a validation failure
 * (ours or the caller's) becomes 400 with the zod issues attached; anything else is
 * logged and becomes an opaque 500 (never leaks internals like a connection string). */
export function handleUnexpected(err: unknown) {
  if (err instanceof ZodError) {
    return jsonError(400, "Validation failed", err.issues);
  }
  if (err instanceof SyntaxError) {
    return jsonError(400, "Request body must be valid JSON");
  }
  console.error(err);
  return jsonError(500, "Internal error");
}

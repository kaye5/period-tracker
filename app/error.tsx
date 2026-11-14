"use client";

/**
 * Root error boundary (agent I — integration; SPEC.md step 3). Every screen in this app is
 * an async Server Component that awaits the data layer (a SQL database via Drizzle/mysql2)
 * during render. If the database is unreachable, that await throws. Without this boundary,
 * Next.js would surface a raw stack trace. This catches it and degrades honestly.
 *
 * In production Next.js replaces the thrown error's message with a generic string before it
 * reaches this client component (only `digest` survives), so we do NOT try to parse the
 * cause. Instead we name the single most likely cause given where this app is in its life:
 * the database connection. The message is deliberately non-alarming and actionable, and
 * makes no claim we cannot stand behind (SPEC.md §0.1 tone).
 */
import { useEffect } from "react";
import Link from "next/link";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";

export default function AppError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Server-side only; no remote telemetry (SPEC.md §0.1). This is a local console log.
    console.error("App render error:", error);
  }, [error]);

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-stack px-gutter py-section text-center">
      <h1 className="text-title text-foreground">Something went wrong</h1>
      <p className="text-body text-muted-foreground text-pretty">
        This screen couldn&apos;t load. If it just started happening, the most likely cause
        is that the app can&apos;t reach the database.
      </p>
      <Alert className="mt-2 stage border-0 p-card">
        <AlertTitle>Can&apos;t reach the database</AlertTitle>
        <AlertDescription>
          Check that <code className="rounded bg-muted px-1 py-0.5">DATABASE_URL</code> is
          set correctly in <code className="rounded bg-muted px-1 py-0.5">.env.local</code>{" "}
          and that the database it points to is running and reachable.
        </AlertDescription>
      </Alert>
      <div className="mt-2 flex flex-wrap justify-center gap-2">
        <Button type="button" className="px-6" onClick={reset}>
          Try again
        </Button>
        <Button variant="outline" className="px-6" nativeButton={false} render={<Link href="/" />}>
          Back to Today
        </Button>
      </div>
      {error.digest ? (
        <p className="text-caption text-muted-foreground tabular-nums">Reference: {error.digest}</p>
      ) : null}
    </main>
  );
}

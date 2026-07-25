/**
 * 404 page (agent I — integration; SPEC.md step 3). A plain server component; no data
 * fetching, so it cannot itself fail on an unreachable database. Links back to the
 * dashboard, which is the app's home route.
 */
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-4 px-4 py-16 text-center">
      <h1 className="text-xl font-semibold text-text">Page not found</h1>
      <p className="text-sm text-text-muted">
        That page doesn&apos;t exist. It may have been removed, or the link was mistyped.
      </p>
      <Link
        href="/"
        className="inline-flex min-h-[44px] items-center justify-center rounded-md bg-primary px-5 text-sm font-medium text-primary-foreground hover:bg-primary-hover focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring"
      >
        Go to the dashboard
      </Link>
    </main>
  );
}

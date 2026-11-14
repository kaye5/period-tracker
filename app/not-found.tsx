/**
 * 404 page (agent I — integration; SPEC.md step 3). A plain server component; no data
 * fetching, so it cannot itself fail on an unreachable database. Links back to
 * Today, which is the app's home route.
 */
import Link from "next/link";
import { Button } from "@/components/ui/button";

export default function NotFound() {
  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-stack px-gutter py-section text-center">
      <h1 className="text-title text-foreground">Page not found</h1>
      <p className="text-body text-muted-foreground text-pretty">
        That page doesn&apos;t exist. It may have been removed, or the link was mistyped.
      </p>
      <Button className="mt-2 px-6" nativeButton={false} render={<Link href="/" />}>
        Back to Today
      </Button>
    </main>
  );
}

import Link from "next/link";
import { Settings } from "lucide-react";
import { Button } from "@/components/ui/button";

/** Top-of-page chrome: app name and a link to Settings. The "log today" fast path lives
 * just below, in QuickLog — a prominent button that opens the day log in a dialog (no
 * page switch), which is tap one of the ≤3-tap quick-log flow (SPEC.md's U3 brief). */
export function DashboardHeader() {
  return (
    <header className="flex items-center justify-between gap-3">
      <h1 className="text-xl font-semibold text-foreground">Period Tracker</h1>
      <Button variant="ghost" size="icon" aria-label="Settings" render={<Link href="/settings" />}>
        <Settings aria-hidden />
      </Button>
    </header>
  );
}

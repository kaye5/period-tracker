"use client";

/**
 * Persistent primary navigation (agent I — integration). Four destinations: Dashboard
 * ("/"), History ("/history"), Report ("/report"), Settings ("/settings"). Logging has no
 * nav slot — it's reached from the dashboard's "Log today" button, tapping any calendar
 * day, or an insight's "view the records behind this", all of which open the app-wide
 * day-log dialog (there is no /log route).
 *
 * Hidden on the onboarding flow: onboarding is a full-screen, no-escape-hatch wizard
 * (SPEC.md U1 brief), so showing a tab bar under it would let a user skip the flow. This
 * component reads the current path and renders nothing while it starts with "/onboarding".
 *
 * Accessibility (SPEC.md §4.5): each tab is a >=44x44px target (shadcn Button's default
 * height), the active tab carries aria-current="page" AND a bolder label AND a filled
 * background tint AND a distinct icon glyph per destination — never colour alone — labels
 * are always visible text, and the whole bar is a real <nav> landmark. Icons are
 * lucide-react (bundled, not a remote asset — SPEC.md §0.1) and aria-hidden, since the
 * visible label already names each destination.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { FileText, History, Home, Settings } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  /** Extra path prefixes that should also mark this tab active. */
  match: (path: string) => boolean;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Home", icon: Home, match: (p) => p === "/" },
  {
    href: "/history",
    label: "History",
    icon: History,
    match: (p) => p === "/history" || p.startsWith("/history/"),
  },
  {
    href: "/report",
    label: "Report",
    icon: FileText,
    match: (p) => p === "/report" || p.startsWith("/report/"),
  },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    match: (p) => p === "/settings" || p.startsWith("/settings/"),
  },
];

export function AppNav() {
  const pathname = usePathname() ?? "/";

  // Onboarding is a full-screen flow — no nav (SPEC.md U1). Also hide on any not-yet-known
  // path segment that is part of onboarding.
  if (pathname.startsWith("/onboarding")) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-40 border-t border-border bg-background/95 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-2xl items-stretch justify-around px-2 py-1">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex-1">
              <Button
                variant="ghost"
                aria-current={active ? "page" : undefined}
                className={cn(
                  "h-auto min-h-14 w-full flex-col gap-1 rounded-md px-2 py-2 text-xs",
                  active
                    ? "bg-muted font-semibold text-primary"
                    : "font-medium text-muted-foreground",
                )}
                render={<Link href={item.href} />}
              >
                <Icon aria-hidden className="size-[22px]" />
                <span>{item.label}</span>
              </Button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

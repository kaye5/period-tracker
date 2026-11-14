"use client";

/**
 * Persistent primary navigation (Daylight redesign). Four destinations: Today ("/"),
 * Calendar ("/calendar"), Insights ("/history"), Settings ("/settings"). Logging has no
 * nav slot — it happens on Today's quick-log card, or by tapping any day (week strip or
 * calendar), all of which use the app-wide day-log sheet. The report lives under
 * Settings → Privacy & data (and the Insights header), not in the bar.
 *
 * Hidden on the onboarding flow (a full-screen, no-escape-hatch wizard, SPEC.md U1) and
 * on the screen lock (/unlock), where every link would only redirect back.
 *
 * Accessibility (SPEC.md §4.5): each tab is ≥44px tall; the active tab carries
 * aria-current="page" AND a bold label AND a filled pill behind its icon — never colour
 * alone. Labels are always visible; icons are aria-hidden.
 */
import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ComponentType } from "react";
import { CalendarDays, ChartNoAxesColumn, Settings, Sun } from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: ComponentType<{ className?: string; "aria-hidden"?: boolean }>;
  match: (path: string) => boolean;
}

const startsWith = (prefix: string) => (p: string) => p === prefix || p.startsWith(`${prefix}/`);

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Today", icon: Sun, match: (p) => p === "/" },
  { href: "/calendar", label: "Calendar", icon: CalendarDays, match: startsWith("/calendar") },
  { href: "/history", label: "Insights", icon: ChartNoAxesColumn, match: startsWith("/history") },
  {
    href: "/settings",
    label: "Settings",
    icon: Settings,
    // The report is reached from Settings → Privacy & data, so it lights Settings.
    match: (p) => startsWith("/settings")(p) || startsWith("/report")(p),
  },
];

export function AppNav() {
  const pathname = usePathname() ?? "/";

  if (pathname.startsWith("/onboarding") || pathname.startsWith("/unlock")) {
    return null;
  }

  return (
    <nav
      aria-label="Primary"
      className="sticky bottom-0 z-40 border-t border-border bg-background/95 pb-[env(safe-area-inset-bottom)] shadow-float backdrop-blur"
    >
      <ul className="mx-auto flex h-nav w-full max-w-2xl items-stretch justify-around px-2">
        {NAV_ITEMS.map((item) => {
          const active = item.match(pathname);
          const Icon = item.icon;
          return (
            <li key={item.href} className="flex flex-1">
              <Link
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "group flex flex-1 flex-col items-center justify-center gap-1 rounded-lg text-caption transition-colors",
                  active ? "font-bold text-foreground" : "font-medium text-muted-foreground hover:text-foreground",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-14 items-center justify-center rounded-full transition-colors",
                    active ? "bg-primary text-primary-foreground" : "group-hover:bg-muted",
                  )}
                >
                  <Icon aria-hidden className="size-5" />
                </span>
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

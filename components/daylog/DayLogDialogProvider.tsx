"use client";

/**
 * App-wide day-log dialog. Mounted once in app/layout.tsx so any surface — the dashboard
 * "Log today" button, a calendar day tap, the bottom-nav Log action, an insight's "view
 * the records behind this" — can open the daily log in a modal instead of navigating to a
 * page. There is no /log route any more; every entry point calls `useDayLog().open(date)`.
 *
 * Client component: it holds the open/date state, reads "today" from the client clock, and
 * fetches the profile once (the form needs `settings` to gate fertility / tier-C fields).
 * The dialog only mounts once the profile is known, so an early click still opens correctly
 * (the open flag is set and the dialog appears as soon as the data lands).
 */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import { clientToday } from "@/components/charts/api";
import type { CivilDate } from "@/lib/date/civil";
import type { Profile } from "@/lib/domain/types";
import { DayLogDialog } from "./DayLogDialog";

interface DayLogContextValue {
  /** Open the day-log dialog for a date (defaults to today). */
  open: (date?: CivilDate) => void;
}

const DayLogContext = createContext<DayLogContextValue | null>(null);

export function useDayLog(): DayLogContextValue {
  const ctx = useContext(DayLogContext);
  if (!ctx) throw new Error("useDayLog must be used within <DayLogDialogProvider>");
  return ctx;
}

export function DayLogDialogProvider({ children }: { children: ReactNode }) {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<CivilDate | null>(null);

  // "Today" from the client clock/timezone, read once at first render — the same pattern as
  // components/onboarding/OnboardingWizard.tsx. Not an effect + setState: that is a single
  // cascading render for a value needed on the first one (react-hooks/set-state-in-effect).
  // Nothing below renders before `profile` lands (client-only), so no hydration mismatch.
  const today = useMemo(() => clientToday(), []);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile: Profile } | null) => {
        if (!cancelled && data?.profile) setProfile(data.profile);
      })
      .catch(() => {
        // No profile / API unreachable: the dialog simply won't open until it loads.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const openDialog = useCallback(
    (d?: CivilDate) => {
      setDate(d ?? today);
      setOpen(true);
    },
    [today],
  );

  const value = useMemo<DayLogContextValue>(() => ({ open: openDialog }), [openDialog]);

  return (
    <DayLogContext.Provider value={value}>
      {children}
      {profile ? (
        <DayLogDialog
          date={date ?? today}
          today={today}
          settings={profile.settings}
          open={open}
          onOpenChange={setOpen}
        />
      ) : null}
    </DayLogContext.Provider>
  );
}

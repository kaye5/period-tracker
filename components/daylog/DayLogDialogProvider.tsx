"use client";

/**
 * App-wide day-log dialog. Mounted once in app/layout.tsx so any surface — the dashboard
 * "Log today" button, a calendar day tap, the bottom-nav Log action, an insight's "view
 * the records behind this" — can open the daily log in a modal instead of navigating to a
 * page. There is no /log route any more; every entry point calls `useDayLog().open(date)`.
 *
 * Client component: it holds the open/date state, reads "today" from the client clock, and
 * fetches the profile once (the form needs `settings` to gate fertility / tier-C fields).
 * The dialog only mounts once both are known, so an early click still opens correctly (the
 * open flag is set and the dialog appears as soon as the data lands).
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
import { todayInZone, type CivilDate } from "@/lib/date/civil";
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
  const [today, setToday] = useState<CivilDate | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [open, setOpen] = useState(false);
  const [date, setDate] = useState<CivilDate | null>(null);

  // "Today" from the client clock/timezone (an I/O boundary, so it lives in an effect).
  useEffect(() => {
    const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;
    setToday(todayInZone(tz, Date.now()));
  }, []);

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
      if (d) setDate(d);
      else if (today) setDate(today);
      setOpen(true);
    },
    [today],
  );

  const value = useMemo<DayLogContextValue>(() => ({ open: openDialog }), [openDialog]);

  return (
    <DayLogContext.Provider value={value}>
      {children}
      {today && profile ? (
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

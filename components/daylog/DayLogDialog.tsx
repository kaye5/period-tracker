"use client";

/**
 * Opens the daily log form (components/daylog/DayLogForm) in a bottom sheet so logging
 * always happens in place and within thumb reach — no route switch. There is no /log
 * route; this sheet, mounted once app-wide by DayLogDialogProvider, is the only full
 * day-log surface (Today's quick-log card covers the common one-tap facts).
 *
 * The existing DayLog for the selected date is fetched client-side (GET /api/day-logs/
 * [date] → { dayLog } or 404) when the dialog opens; `settings` is handed down from the
 * server page (it already loaded the profile).
 */
import { useEffect, useState } from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Spinner } from "@/components/ui/spinner";
import type { CivilDate } from "@/lib/date/civil";
import type { DayLog, Settings } from "@/lib/domain/types";
import { DayLogForm } from "./DayLogForm";

export interface DayLogDialogProps {
  date: CivilDate | null;
  today: CivilDate;
  settings: Settings;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function DayLogDialog({ date, today, settings, open, onOpenChange }: DayLogDialogProps) {
  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-lg gap-0 overflow-y-auto rounded-t-stage px-gutter pt-section pb-0 shadow-float"
      >
        {/* The form renders its own visible date heading; this title is for assistive tech. */}
        <SheetHeader className="sr-only">
          <SheetTitle>{date ? `Log entry for ${date}` : "Log entry"}</SheetTitle>
        </SheetHeader>
        {/* Keyed by date, so changing the selected day starts from a clean "loading,
            nothing fetched yet" state and refetches. Remounting is what resets that state,
            so the effect below never has to set it synchronously
            (react-hooks/set-state-in-effect). The remount also resets the form's own
            internal state, which `key` on DayLogForm used to do.

            Deliberately NOT also gated on `open`: the sheet portal is not `keepMounted`, so
            closing already unmounts this whole subtree once the animation finishes and
            reopening mounts it fresh. Adding `open &&` on top only swapped the form for
            the spinner *during* the close animation — a flash on every close and every
            save, buying nothing. */}
        {date ? (
          <DayLogBody
            key={date}
            date={date}
            today={today}
            settings={settings}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <LoadingRow />
        )}
      </SheetContent>
    </Sheet>
  );
}

function DayLogBody({
  date,
  today,
  settings,
  onClose,
}: {
  date: CivilDate;
  today: CivilDate;
  settings: Settings;
  onClose: () => void;
}) {
  const [dayLog, setDayLog] = useState<DayLog | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/day-logs/${date}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { dayLog: DayLog } | null) => {
        if (!cancelled) setDayLog(data?.dayLog ?? null);
      })
      .catch(() => {
        if (!cancelled) setDayLog(null);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [date]);

  if (loading) return <LoadingRow />;
  return (
    <DayLogForm
      date={date}
      today={today}
      initialDayLog={dayLog}
      settings={settings}
      onClose={onClose}
    />
  );
}

function LoadingRow() {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-label font-normal text-muted-foreground">
      <Spinner aria-hidden />
      Loading…
    </div>
  );
}

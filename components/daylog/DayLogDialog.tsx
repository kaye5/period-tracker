"use client";

/**
 * Opens the daily log form (components/daylog/DayLogForm) inside a dialog so logging
 * always happens in place — no route switch (user request). There is no /log route; this
 * dialog, mounted once app-wide by DayLogDialogProvider, is the only day-log surface.
 *
 * The existing DayLog for the selected date is fetched client-side (GET /api/day-logs/
 * [date] → { dayLog } or 404) when the dialog opens; `settings` is handed down from the
 * server page (it already loaded the profile). `key={date}` on the form remounts it when
 * the selected day changes, so its internal state resets cleanly.
 */
import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
  const [dayLog, setDayLog] = useState<DayLog | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open || !date) return;
    let cancelled = false;
    setLoading(true);
    setDayLog(null);
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
  }, [open, date]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] gap-0 overflow-y-auto p-4 sm:max-w-lg sm:p-6">
        {/* The form renders its own visible date heading; this title is for assistive tech. */}
        <DialogHeader className="sr-only">
          <DialogTitle>{date ? `Log entry for ${date}` : "Log entry"}</DialogTitle>
        </DialogHeader>
        {date && !loading ? (
          <DayLogForm
            key={date}
            date={date}
            today={today}
            initialDayLog={dayLog}
            settings={settings}
            onClose={() => onOpenChange(false)}
          />
        ) : (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-muted-foreground">
            <Spinner aria-hidden />
            Loading…
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}

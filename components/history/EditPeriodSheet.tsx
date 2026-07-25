"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, BleedingKind, DayLog, FlowLevel } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { clientToday, fetchDayLogs, putDayLog } from "@/components/charts/api";
import { formatCivilDateShort } from "@/components/charts/format";
import {
  buildDayLogsToSave,
  buildEditableRange,
  buildPeriodEditDraft,
  computeBoundary,
  describeBoundary,
  setRowBleeding,
  setRowFlow,
  type PeriodEditDraft,
} from "@/components/history/periodEdit";

export interface EditPeriodSheetProps {
  episode: BleedingEpisode;
}

const BLEEDING_OPTIONS: { value: BleedingKind; label: string }[] = [
  { value: "none", label: "None" },
  { value: "spotting", label: "Spotting" },
  { value: "menstrual", label: "Period" },
];

const FLOW_OPTIONS: { value: FlowLevel; label: string }[] = [
  { value: "spotting", label: "Spotting" },
  { value: "light", label: "Light" },
  { value: "medium", label: "Medium" },
  { value: "heavy", label: "Heavy" },
  { value: "very_heavy", label: "Very heavy" },
];

/** Every day-level toggle in this sheet is a quick-log control (SPEC.md §4.5: "the
 * calendar day cells and quick-log controls especially must stay >=44px") — the
 * ToggleGroupItem default (32px) is bumped up to the app's 44px minimum here. */
const DAY_TOGGLE_CLASS = "h-11 px-3";

/**
 * "Edit period" (SPEC.md's U4 brief: "Inline editing of a historical period goes
 * through app/api/day-logs and refreshes"). The trigger button mounts `EditPeriodSheetPanel`
 * only while open — same pattern as `components/settings/DeleteAllDataSheet.tsx` — so
 * every open is a fresh mount with fresh state, and no effect ever needs to reset state
 * left over from a previous open/close.
 */
export function EditPeriodSheet({ episode }: EditPeriodSheetProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="ghost" onClick={() => setOpen(true)}>
        Edit period
      </Button>
      {open ? <EditPeriodSheetPanel episode={episode} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

interface PanelProps {
  episode: BleedingEpisode;
  onClose: () => void;
}

function EditPeriodSheetPanel({ episode, onClose }: PanelProps) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<PeriodEditDraft | null>(null);
  const [originalByDate, setOriginalByDate] = useState<ReadonlyMap<CivilDate, DayLog>>(new Map());
  const loading = draft === null && error === null;

  useEffect(() => {
    let cancelled = false;
    const range = buildEditableRange(episode);
    fetchDayLogs({ from: range.start, to: range.end })
      .then((logs) => {
        if (cancelled) return;
        const byDate = new Map(logs.map((l) => [l.date, l] as const));
        setOriginalByDate(byDate);
        setDraft(buildPeriodEditDraft(range, byDate));
      })
      .catch(() => {
        if (!cancelled) setError("Couldn't load this period's days. Try again.");
      });
    return () => {
      cancelled = true;
    };
    // `episode` is captured once at mount (a fresh mount per open, see EditPeriodSheet).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const boundary = draft ? computeBoundary(draft, episode.startDate) : null;

  async function save() {
    if (!draft) return;
    setSaving(true);
    setError(null);
    try {
      const today = clientToday();
      const toSave = buildDayLogsToSave(draft, originalByDate, boundary, today);
      // Sequential, deliberately not Promise.all: each PUT should land (or visibly fail)
      // on its own rather than racing several writes against the same collection at once.
      for (const dayLog of toSave) {
        await putDayLog(dayLog.date, dayLog);
      }
      router.refresh();
      onClose();
    } catch {
      setError("Couldn't save your changes. Check your connection and try again.");
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onOpenChange={(next) => {
        if (!next) onClose();
      }}
    >
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Edit period</SheetTitle>
        </SheetHeader>
        <div className="flex flex-1 flex-col gap-3 overflow-y-auto px-4">
          {loading || !draft ? (
            error ? (
              <p role="alert" className="text-sm text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">Loading…</p>
            )
          ) : (
            <>
              <p className="text-sm text-foreground">
                Currently: <strong>{describeBoundary(boundary)}</strong>
              </p>
              <p className="text-sm text-muted-foreground">
                Adjust the days below. Marking a day before or after as spotting or period adds it to the
                period; setting a day back to &ldquo;None&rdquo; removes it.
              </p>
              <div className="flex max-h-[50vh] flex-col gap-3 overflow-y-auto">
                {draft.rows.map((row) => (
                  <div key={row.date} className="flex flex-wrap items-center gap-2 border-b border-border pb-3">
                    <span className="w-24 shrink-0 text-sm text-foreground">{formatCivilDateShort(row.date)}</span>
                    <ToggleGroup
                      aria-label={`Bleeding on ${formatCivilDateShort(row.date)}`}
                      value={[row.bleeding]}
                      onValueChange={(values) => {
                        const next = values[0] as BleedingKind | undefined;
                        if (next) setDraft(setRowBleeding(draft, row.date, next));
                      }}
                    >
                      {BLEEDING_OPTIONS.map((opt) => (
                        <ToggleGroupItem key={opt.value} value={opt.value} className={DAY_TOGGLE_CLASS}>
                          {opt.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {row.bleeding !== "none" ? (
                      <ToggleGroup
                        aria-label={`Flow on ${formatCivilDateShort(row.date)}`}
                        value={row.flow ? [row.flow] : []}
                        onValueChange={(values) => {
                          const next = values[0] as FlowLevel | undefined;
                          if (next) setDraft(setRowFlow(draft, row.date, next));
                        }}
                      >
                        {FLOW_OPTIONS.map((opt) => (
                          <ToggleGroupItem key={opt.value} value={opt.value} className={DAY_TOGGLE_CLASS}>
                            {opt.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    ) : null}
                  </div>
                ))}
              </div>
              {error ? (
                <p role="alert" className="text-sm text-destructive">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <SheetFooter className="flex-row justify-start gap-2">
          <Button variant="default" disabled={saving || !draft} onClick={save}>
            Save
          </Button>
          <Button variant="outline" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

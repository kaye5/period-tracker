"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { PencilIcon } from "lucide-react";
import type { CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, BleedingKind, DayLog, FlowLevel } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Sheet, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChipCheck } from "@/components/daylog/ChipGroup";
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
      <Button variant="ghost" className="rounded-full px-3 text-label" onClick={() => setOpen(true)}>
        <PencilIcon aria-hidden />
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
      <SheetContent
        side="bottom"
        className="mx-auto max-h-[92dvh] w-full max-w-lg gap-0 rounded-t-stage shadow-float"
      >
        <SheetHeader className="px-gutter pt-section pr-14 pb-stack">
          <SheetTitle className="text-heading">Edit period</SheetTitle>
        </SheetHeader>
        <div className="flex min-h-0 flex-1 flex-col gap-stack overflow-y-auto px-gutter">
          {loading || !draft ? (
            error ? (
              <p role="alert" className="text-label font-normal text-destructive">
                {error}
              </p>
            ) : (
              <p className="text-label font-normal text-muted-foreground">Loading…</p>
            )
          ) : (
            <>
              <p className="text-body text-popover-foreground tabular-nums">
                Currently: <strong className="font-semibold">{describeBoundary(boundary)}</strong>
              </p>
              <p className="text-label font-normal text-muted-foreground text-pretty">
                Adjust the days below. Marking a day before or after as spotting or period adds it to the
                period; setting a day back to &ldquo;None&rdquo; removes it.
              </p>
              <div className="flex flex-col divide-y divide-border">
                {draft.rows.map((row) => (
                  <div key={row.date} className="flex flex-col gap-2 py-stack">
                    <span className="text-label text-popover-foreground tabular-nums">{formatCivilDateShort(row.date)}</span>
                    <ToggleGroup
                      variant="chip"
                      size="chip"
                      className="flex-wrap"
                      aria-label={`Bleeding on ${formatCivilDateShort(row.date)}`}
                      value={[row.bleeding]}
                      onValueChange={(values) => {
                        const next = values[0] as BleedingKind | undefined;
                        if (next) setDraft(setRowBleeding(draft, row.date, next));
                      }}
                    >
                      {BLEEDING_OPTIONS.map((opt) => (
                        <ToggleGroupItem key={opt.value} value={opt.value}>
                          <ChipCheck />
                          {opt.label}
                        </ToggleGroupItem>
                      ))}
                    </ToggleGroup>
                    {row.bleeding !== "none" ? (
                      <ToggleGroup
                        variant="chip"
                        size="chip"
                        className="flex-wrap"
                        aria-label={`Flow on ${formatCivilDateShort(row.date)}`}
                        value={row.flow ? [row.flow] : []}
                        onValueChange={(values) => {
                          const next = values[0] as FlowLevel | undefined;
                          if (next) setDraft(setRowFlow(draft, row.date, next));
                        }}
                      >
                        {FLOW_OPTIONS.map((opt) => (
                          <ToggleGroupItem key={opt.value} value={opt.value}>
                            <ChipCheck />
                            {opt.label}
                          </ToggleGroupItem>
                        ))}
                      </ToggleGroup>
                    ) : null}
                  </div>
                ))}
              </div>
              {error ? (
                <p role="alert" className="text-label font-normal text-destructive">
                  {error}
                </p>
              ) : null}
            </>
          )}
        </div>
        <SheetFooter className="flex-row justify-between gap-2 border-t border-border px-gutter py-stack">
          <Button variant="outline" className="rounded-full" disabled={saving} onClick={onClose}>
            Cancel
          </Button>
          <Button variant="default" className="rounded-full px-6" disabled={saving || !draft} onClick={save}>
            Save
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}

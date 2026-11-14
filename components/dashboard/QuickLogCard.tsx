"use client";

/**
 * Today's quick-log card (Daylight redesign). Each tap records one fact for today — or,
 * for "it ended on …", for the last recorded period day — and saves immediately through
 * the same POST /api/day-logs upsert the full form uses, merged onto whatever was already
 * recorded (`applyQuickAction`). A toast confirms the save and offers Undo, which restores
 * the previous log exactly (or deletes the day if nothing was recorded before).
 *
 * Saves run one at a time in tap order. The card shows each change immediately (an
 * override per date) and drops the override once the refreshed server data has arrived.
 * A failed save reverts its override and says so.
 */
import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Check, Droplet, SlidersHorizontal } from "lucide-react";
import type { CivilDate } from "@/lib/date/civil";
import type { DayLog, FlowLevel, MoodId, SymptomId } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Toggle } from "@/components/ui/toggle";
import { ChipCheck } from "@/components/daylog/ChipGroup";
import { FLOW_LEVEL_OPTIONS, MOOD_OPTIONS } from "@/components/daylog/daylogOptions";
import { useDayLog } from "@/components/daylog/DayLogDialogProvider";
import { capitalizedSymptomLabel } from "@/lib/copy/insights";
import { formatMonthDay } from "./format";
import { applyQuickAction, type QuickAction, type QuickPeriodStatus } from "./quickLog";

export interface QuickLogCardProps {
  today: CivilDate;
  todayLog: DayLog | undefined;
  /** From `quickPeriodStatus`, computed on the server from the engine's cycles. */
  periodStatus: QuickPeriodStatus;
  /** The log of `periodStatus.lastPeriodDay`, when status is "ongoing". */
  lastPeriodDayLog: DayLog | undefined;
  symptoms: SymptomId[];
}

type Overrides = Partial<Record<CivilDate, DayLog | null>>;

async function persist(date: CivilDate, log: DayLog | null): Promise<void> {
  const res =
    log === null
      ? await fetch(`/api/day-logs/${date}`, { method: "DELETE" })
      : await fetch("/api/day-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(log),
        });
  if (!res.ok && !(log === null && res.status === 404)) throw new Error(`save failed: ${res.status}`);
}

export function QuickLogCard({ today, todayLog, periodStatus, lastPeriodDayLog, symptoms }: QuickLogCardProps) {
  const router = useRouter();
  const { open } = useDayLog();
  const [, startTransition] = useTransition();
  const [overrides, setOverrides] = useState<Overrides>({});
  const queue = useRef<Promise<void>>(Promise.resolve());
  const pending = useRef(new Map<CivilDate, number>());

  const current = (date: CivilDate, fromServer: DayLog | undefined): DayLog | undefined =>
    date in overrides ? (overrides[date] ?? undefined) : fromServer;

  const log = current(today, todayLog);
  const status: QuickPeriodStatus =
    log?.bleeding === "menstrual"
      ? { kind: "today" }
      : periodStatus.kind === "today"
        ? { kind: "none" }
        : periodStatus;

  function save(date: CivilDate, before: DayLog | undefined, after: DayLog | null, message: string | null) {
    setOverrides((o) => ({ ...o, [date]: after }));
    pending.current.set(date, (pending.current.get(date) ?? 0) + 1);

    queue.current = queue.current
      .then(() => persist(date, after))
      .then(
        () => {
          settle(date);
          if (message) {
            toast(message, {
              action: { label: "Undo", onClick: () => save(date, after ?? undefined, before ?? null, null) },
            });
          }
        },
        () => {
          settle(date);
          setOverrides((o) => ({ ...o, [date]: before ?? null }));
          toast.error("Couldn't save that. Check your connection and try again.");
        },
      );
  }

  /** After the last in-flight save for `date`, refresh server data and, in the same
   * transition, drop the override so the UI switches to the fresh props in one step. */
  function settle(date: CivilDate) {
    const left = (pending.current.get(date) ?? 1) - 1;
    pending.current.set(date, left);
    if (left > 0) return;
    startTransition(() => {
      router.refresh();
      setOverrides((o) => {
        const next = { ...o };
        delete next[date];
        return next;
      });
    });
  }

  function apply(action: QuickAction, message: string, date: CivilDate = today, fromServer = todayLog) {
    const before = current(date, fromServer);
    save(date, before, applyQuickAction(before, action, date, today), message);
  }

  const toggleMood = (mood: MoodId, label: string) =>
    apply({ kind: "mood", mood }, log?.mood?.includes(mood) ? `Removed: ${label}` : `Logged: ${label}`);
  const toggleSymptom = (symptom: SymptomId, label: string) =>
    apply({ kind: "symptom", symptom }, log?.symptoms.includes(symptom) ? `Removed: ${label}` : `Logged: ${label}`);
  const setFlow = (flow: FlowLevel, label: string) =>
    log?.flow === flow
      ? apply({ kind: "flow", flow: undefined }, "Flow cleared")
      : apply({ kind: "flow", flow }, `Flow: ${label}`);

  const showNothing = !log || log.nothingToReport === true;

  return (
    <section aria-labelledby="quick-log-title" className="flex flex-col gap-section stage p-card">
      <div className="flex items-center justify-between gap-2">
        <h2 id="quick-log-title" className="text-heading text-card-foreground">
          Log today
        </h2>
        <Button variant="ghost" className="-mr-2 rounded-full text-label" onClick={() => open(today)}>
          <SlidersHorizontal data-icon="inline-start" aria-hidden />
          All details
        </Button>
      </div>

      <div className="flex flex-col gap-stack">
        {status.kind === "none" ? (
          <Button
            className="h-quicklog w-full rounded-full text-body font-semibold"
            onClick={() => apply({ kind: "period", on: true, start: true }, "Period start logged for today")}
          >
            <Droplet data-icon="inline-start" aria-hidden />
            Period started today
          </Button>
        ) : null}

        {status.kind === "ongoing" ? (
          <div className="flex gap-2">
            <Button
              className="h-quicklog flex-1 rounded-full text-body font-semibold"
              onClick={() => apply({ kind: "period", on: true }, "Period day logged")}
            >
              <Droplet data-icon="inline-start" aria-hidden />
              Period today
            </Button>
            <Button
              variant="outline"
              className="h-quicklog flex-1 rounded-full text-label"
              onClick={() =>
                apply(
                  { kind: "lastDay", on: true },
                  `${formatMonthDay(status.lastPeriodDay)} marked as the last day`,
                  status.lastPeriodDay,
                  lastPeriodDayLog,
                )
              }
            >
              Ended {formatMonthDay(status.lastPeriodDay)}
            </Button>
          </div>
        ) : null}

        {status.kind === "today" ? (
          <>
            <div className="flex gap-2">
              <Toggle
                variant="chip"
                size="chip"
                pressed
                onPressedChange={() => apply({ kind: "period", on: false }, "Period day removed")}
                className="h-quicklog flex-1 text-body font-semibold"
              >
                <Check aria-hidden />
                Period today
              </Toggle>
              <Toggle
                variant="chip"
                size="chip"
                pressed={log?.periodBoundary === "end"}
                onPressedChange={(on) =>
                  apply({ kind: "lastDay", on }, on ? "Marked as the last day" : "Last-day mark removed")
                }
                className="h-quicklog flex-1"
              >
                <ChipCheck />
                Last day
              </Toggle>
            </div>
            <ChipRow legend="Flow">
              {FLOW_LEVEL_OPTIONS.map((o) => (
                <Chip key={o.value} pressed={log?.flow === o.value} onPress={() => setFlow(o.value, o.label)}>
                  {o.label}
                </Chip>
              ))}
            </ChipRow>
          </>
        ) : null}
      </div>

      <ChipRow legend="Mood">
        {MOOD_OPTIONS.map((o) => (
          <Chip key={o.value} pressed={log?.mood?.includes(o.value) ?? false} onPress={() => toggleMood(o.value, o.label)}>
            {o.label}
          </Chip>
        ))}
      </ChipRow>

      <ChipRow legend="Symptoms">
        {symptoms.map((id) => {
          const label = capitalizedSymptomLabel(id);
          return (
            <Chip key={id} pressed={log?.symptoms.includes(id) ?? false} onPress={() => toggleSymptom(id, label)}>
              {label}
            </Chip>
          );
        })}
        <Button variant="ghost" className="h-chip rounded-full px-4 text-label" onClick={() => open(today)}>
          More symptoms…
        </Button>
      </ChipRow>

      {showNothing ? (
        <div className="border-t border-border pt-stack">
          <Chip
            pressed={log?.nothingToReport === true}
            onPress={() =>
              log?.nothingToReport
                ? save(today, log, null, "Cleared today")
                : apply({ kind: "nothing" }, "Logged: nothing to note today")
            }
          >
            Nothing to note today
          </Chip>
        </div>
      ) : null}
    </section>
  );
}

function ChipRow({ legend, children }: { legend: string; children: React.ReactNode }) {
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="mb-2 text-label text-card-foreground">{legend}</legend>
      <div className="flex flex-wrap gap-2">{children}</div>
    </fieldset>
  );
}

function Chip({ pressed, onPress, children }: { pressed: boolean; onPress: () => void; children: React.ReactNode }) {
  return (
    <Toggle variant="chip" size="chip" pressed={pressed} onPressedChange={onPress}>
      <ChipCheck />
      {children}
    </Toggle>
  );
}

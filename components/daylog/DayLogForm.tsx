"use client";

/**
 * The daily log screen (SPEC.md U3 brief, PRD §3). Progressive disclosure: bleeding and
 * flow — plus the separate, visually distinct spotting control — sit at the top level;
 * everything else lives behind `<Expander>`s. Fertility fields render only when
 * `settings.fertilityEnabled` (SPEC.md §0), with the fertility disclaimer rendered
 * directly above them, never behind a link.
 *
 * Quick-log path (SPEC.md: "a basic period entry must complete in ≤3 taps"): 1) tap a
 * day on the calendar to arrive here, 2) tap "Period today", 3) tap Save. `flow`,
 * `bleedingContext`, `periodBoundary` and everything below the Bleeding card are
 * genuinely optional — the schema only requires `pain.severity` and `symptoms`, both of
 * which already have safe defaults ("none" / empty) the instant the form mounts. See
 * this agent's final report for the exact count.
 */
import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check } from "lucide-react";
import type { CivilDate } from "@/lib/date/civil";
import { civilDateParts, monthName } from "@/components/calendar/civilDateDisplay";
import type { DayLog, Interference, MoodId, PainSite, Settings, SymptomId } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { capitalizedSymptomLabel } from "@/lib/copy/insights";
import { FERTILITY_DISCLAIMER } from "@/lib/copy/general";
import { ChipGroup } from "./ChipGroup";
import { Expander } from "./Expander";
import { NothingToReportButton } from "./NothingToReportButton";
import {
  buildDayLogPayload,
  initialFormState,
  mergeSymptomGroup,
  nothingToReportPayload,
  patchFertilityField,
  type DayLogFormState,
} from "./dayLogFormState";
import { visibleSymptomGroups } from "./symptomPanel";
import {
  BLEEDING_CONTEXT_OPTIONS,
  CERVICAL_MUCUS_OPTIONS,
  CLOT_SIZE_OPTIONS,
  FASTEST_CHANGE_OPTIONS,
  FLOW_LEVEL_OPTIONS,
  INTERFERENCE_OPTIONS,
  MOOD_OPTIONS,
  OPK_RESULT_OPTIONS,
  PAIN_SEVERITY_OPTIONS,
  PAIN_SITE_OPTIONS,
  PERIOD_BOUNDARY_OPTIONS,
} from "./daylogOptions";

export interface DayLogFormProps {
  date: CivilDate;
  today: CivilDate;
  initialDayLog: DayLog | null;
  settings: Settings;
  /** When set, the form is inside a dialog: the "Back to calendar" link is hidden (the
   * dialog has its own close), and the form is otherwise identical. */
  onClose?: () => void;
}

async function postDayLog(payload: DayLog): Promise<void> {
  const res = await fetch("/api/day-logs", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload),
  });
  if (!res.ok) throw new Error("Could not save this entry. Please try again.");
}

export function DayLogForm({ date, today, initialDayLog, settings, onClose }: DayLogFormProps) {
  const router = useRouter();
  const [state, setState] = useState<DayLogFormState>(() => initialFormState(initialDayLog));
  const [hasExistingLog, setHasExistingLog] = useState(initialDayLog != null);
  const [loggedAtAnchor, setLoggedAtAnchor] = useState(initialDayLog?.loggedAt);
  const [saving, setSaving] = useState(false);
  const [savingNothing, setSavingNothing] = useState(false);
  const [justSavedNothing, setJustSavedNothing] = useState(false);
  const [justSaved, setJustSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmingClear, setConfirmingClear] = useState(false);
  const [clearing, setClearing] = useState(false);

  const { year, month, day } = civilDateParts(date);
  const isBackEntry = date !== today;
  const groups = visibleSymptomGroups(settings.tierCSymptomsEnabled);

  function patch<K extends keyof DayLogFormState>(key: K, value: DayLogFormState[K]) {
    setJustSaved(false);
    setState((prev) => ({ ...prev, [key]: value }));
  }

  function patchFertility<K extends keyof DayLogFormState["fertility"]>(
    key: K,
    value: DayLogFormState["fertility"][K] | undefined,
  ) {
    patch("fertility", patchFertilityField(state.fertility, key, value));
  }

  function setPeriodToday(on: boolean) {
    patch("bleeding", on ? "menstrual" : "none");
    if (!on) {
      patch("flow", undefined);
      patch("periodBoundary", undefined);
    }
  }

  function setSpottingOnly(on: boolean) {
    patch("bleeding", on ? "spotting" : "none");
  }

  async function handleSave() {
    setError(null);
    setSaving(true);
    try {
      const payload = buildDayLogPayload(date, today, state, settings.fertilityEnabled, loggedAtAnchor);
      await postDayLog(payload);
      setHasExistingLog(true);
      setLoggedAtAnchor(payload.loggedAt);
      setJustSaved(true);
      setJustSavedNothing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this entry.");
    } finally {
      setSaving(false);
    }
  }

  async function handleNothingToReport() {
    setError(null);
    setSavingNothing(true);
    try {
      const payload = nothingToReportPayload(date, today, loggedAtAnchor);
      await postDayLog(payload);
      setState(initialFormState(payload));
      setHasExistingLog(true);
      setLoggedAtAnchor(payload.loggedAt);
      setJustSavedNothing(true);
      setJustSaved(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this entry.");
    } finally {
      setSavingNothing(false);
    }
  }

  async function handleClear() {
    setError(null);
    setClearing(true);
    try {
      const res = await fetch(`/api/day-logs/${date}`, { method: "DELETE" });
      if (!res.ok && res.status !== 404) throw new Error("Could not clear this day. Please try again.");
      setState(initialFormState(null));
      setHasExistingLog(false);
      setLoggedAtAnchor(undefined);
      setConfirmingClear(false);
      setJustSaved(false);
      setJustSavedNothing(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not clear this day.");
    } finally {
      setClearing(false);
    }
  }

  return (
    <div className="flex flex-col gap-5">
      <header className="flex flex-col gap-1">
        {onClose ? null : (
          <Link href="/" className="text-sm text-muted-foreground hover:text-foreground">
            ‹ Back to calendar
          </Link>
        )}
        <h1 className="text-xl font-semibold text-foreground">
          {monthName(month)} {day}, {year}
        </h1>
        {isBackEntry ? (
          <p className="text-sm text-muted-foreground">
            You&apos;re logging a day in the past — that&apos;s recorded as a back-entry.
          </p>
        ) : null}
      </header>

      <NothingToReportButton
        onTap={handleNothingToReport}
        pending={savingNothing}
        savedJustNow={justSavedNothing}
      />

      <Card>
        <CardHeader>
          <CardTitle>Bleeding</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          <Button
            type="button"
            variant={state.bleeding === "menstrual" ? "default" : "secondary"}
            aria-pressed={state.bleeding === "menstrual"}
            onClick={() => setPeriodToday(state.bleeding !== "menstrual")}
            className="h-14 w-full text-base font-semibold"
          >
            {state.bleeding === "menstrual" ? <Check data-icon="inline-start" aria-hidden="true" /> : null}
            {state.bleeding === "menstrual" ? "Period day — recorded" : "I had my period this day"}
          </Button>

          {state.bleeding === "menstrual" ? (
            <>
              <ChipGroup
                mode="single"
                legend="Flow"
                options={FLOW_LEVEL_OPTIONS}
                value={state.flow}
                onChange={(v) => patch("flow", v)}
              />
              <div className="flex flex-col gap-1.5">
                <ChipGroup
                  mode="single"
                  legend="Is this the start or end of your period?"
                  options={PERIOD_BOUNDARY_OPTIONS}
                  value={state.periodBoundary}
                  onChange={(v) => patch("periodBoundary", v)}
                />
                <p className="text-xs text-muted-foreground">
                  Tap “Last day” on the final day you bleed to close the period and record
                  its length — otherwise it keeps showing as ongoing.
                </p>
              </div>
            </>
          ) : null}

          <div className="flex flex-col gap-1 border-t border-border pt-3">
            <Button
              type="button"
              variant="outline"
              aria-pressed={state.bleeding === "spotting"}
              onClick={() => setSpottingOnly(state.bleeding !== "spotting")}
              className={
                state.bleeding === "spotting"
                  ? "h-11 self-start rounded-full border-primary bg-primary/50 px-4 text-sm font-medium text-foreground hover:bg-primary/50"
                  : "h-11 self-start rounded-full px-4 text-sm font-medium text-muted-foreground"
              }
            >
              {state.bleeding === "spotting" ? <Check data-icon="inline-start" aria-hidden="true" /> : null}
              Just spotting — not a full period
            </Button>
            <p className="text-xs text-muted-foreground">
              Spotting is tracked separately from a period and never starts a new cycle.
            </p>
          </div>
        </CardContent>
      </Card>

      <Expander title="Product & protection">
        <ChipGroup
          mode="single"
          legend="Clot size"
          options={CLOT_SIZE_OPTIONS}
          value={state.clots}
          onChange={(v) => patch("clots", v)}
        />
        <Field>
          <FieldLabel htmlFor="product-changes">Product changes today</FieldLabel>
          <Input
            id="product-changes"
            type="number"
            min={0}
            inputMode="numeric"
            className="h-11 w-24"
            value={state.productChanges ?? ""}
            onChange={(e) =>
              patch("productChanges", e.target.value === "" ? undefined : Math.max(0, Number(e.target.value)))
            }
          />
        </Field>
        <ChipGroup
          mode="single"
          legend="Fastest time between changes"
          options={FASTEST_CHANGE_OPTIONS}
          value={state.fastestProductChangeHours}
          onChange={(v) => patch("fastestProductChangeHours", v)}
        />
        <FieldGroup>
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="double-protection" className="font-normal">
              Needed two products at once
            </FieldLabel>
            <Switch
              id="double-protection"
              checked={state.doubleProtection}
              onCheckedChange={(v) => patch("doubleProtection", v)}
            />
          </Field>
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="night-change" className="font-normal">
              Changed protection overnight
            </FieldLabel>
            <Switch id="night-change" checked={state.nightChange} onCheckedChange={(v) => patch("nightChange", v)} />
          </Field>
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="leak-through" className="font-normal">
              Leaked through to clothes or bedding
            </FieldLabel>
            <Switch id="leak-through" checked={state.leakThrough} onCheckedChange={(v) => patch("leakThrough", v)} />
          </Field>
        </FieldGroup>
      </Expander>

      <Expander title="Bleeding context">
        <ChipGroup
          mode="single"
          legend="What kind of bleeding is this?"
          options={BLEEDING_CONTEXT_OPTIONS}
          value={state.bleedingContext}
          onChange={(v) => patch("bleedingContext", v)}
        />
      </Expander>

      <Expander title="Pain">
        <ChipGroup
          mode="single"
          legend="Pain severity"
          options={PAIN_SEVERITY_OPTIONS}
          clearable={false}
          value={state.painSeverity}
          onChange={(v) => patch("painSeverity", v ?? "none")}
        />
        {state.painSeverity !== "none" ? (
          <>
            <ChipGroup<PainSite>
              mode="multi"
              legend="Where"
              options={PAIN_SITE_OPTIONS}
              value={state.painSites}
              onChange={(v) => patch("painSites", v)}
            />
            <ChipGroup<Interference>
              mode="multi"
              legend="Got in the way of"
              options={INTERFERENCE_OPTIONS}
              value={state.interferedWith}
              onChange={(v) => patch("interferedWith", v)}
            />
            <Field orientation="horizontal" className="justify-between">
              <FieldLabel htmlFor="painkiller-no-help" className="font-normal">
                Painkillers didn&apos;t help
              </FieldLabel>
              <Switch
                id="painkiller-no-help"
                checked={state.painkillerDidNotHelp}
                onCheckedChange={(v) => patch("painkillerDidNotHelp", v)}
              />
            </Field>
          </>
        ) : null}
      </Expander>

      <Expander title="Physical symptoms">
        <SymptomGroupChips
          legend="Physical"
          ids={groups.physical}
          selected={state.symptoms}
          onChange={(next) => patch("symptoms", next)}
        />
        <SymptomGroupChips
          legend="Emotional"
          ids={groups.emotional}
          selected={state.symptoms}
          onChange={(next) => patch("symptoms", next)}
        />
        {groups.tierC.length > 0 ? (
          <SymptomGroupChips
            legend="Other"
            ids={groups.tierC}
            selected={state.symptoms}
            onChange={(next) => patch("symptoms", next)}
          />
        ) : null}
      </Expander>

      <Expander title="Mood">
        <ChipGroup<MoodId>
          mode="multi"
          legend="Mood"
          options={MOOD_OPTIONS}
          value={state.mood}
          onChange={(v) => patch("mood", v)}
        />
      </Expander>

      {settings.fertilityEnabled ? (
        <Expander title="Reproductive health observations">
          <p className="text-xs text-muted-foreground">{FERTILITY_DISCLAIMER}</p>
          <ChipGroup
            mode="single"
            legend="Cervical mucus"
            options={CERVICAL_MUCUS_OPTIONS}
            value={state.fertility.cervicalMucus}
            onChange={(v) => patchFertility("cervicalMucus", v)}
          />
          <Field orientation="horizontal" className="justify-between">
            <FieldLabel htmlFor="ovulation-pain" className="font-normal">
              Ovulation-type pain
            </FieldLabel>
            <Switch
              id="ovulation-pain"
              checked={state.fertility.ovulationPain ?? false}
              onCheckedChange={(v) => patchFertility("ovulationPain", v || undefined)}
            />
          </Field>
          <Field>
            <FieldLabel htmlFor="bbt-celsius">Basal body temperature (°C)</FieldLabel>
            <Input
              id="bbt-celsius"
              type="number"
              step="0.01"
              className="h-11 w-32"
              value={state.fertility.bbtCelsius ?? ""}
              onChange={(e) =>
                patchFertility("bbtCelsius", e.target.value === "" ? undefined : Number(e.target.value))
              }
            />
          </Field>
          <ChipGroup
            mode="single"
            legend="Ovulation test result"
            options={OPK_RESULT_OPTIONS}
            value={state.fertility.opkResult}
            onChange={(v) => patchFertility("opkResult", v)}
          />
        </Expander>
      ) : null}

      <Expander title="Notes">
        <Field>
          <FieldLabel htmlFor="day-notes" className="sr-only">
            Notes for this day
          </FieldLabel>
          <Textarea
            id="day-notes"
            rows={4}
            value={state.notes}
            onChange={(e) => patch("notes", e.target.value)}
            placeholder="Anything else you want to remember about today"
          />
        </Field>
      </Expander>

      {error ? (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <div className="sticky bottom-0 -mx-4 flex items-center justify-between gap-3 border-t border-border bg-background/95 p-4 backdrop-blur">
        {hasExistingLog ? (
          <AlertDialog open={confirmingClear} onOpenChange={setConfirmingClear}>
            <AlertDialogTrigger render={<Button type="button" variant="ghost" />}>
              Clear this day
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Clear this day&apos;s log?</AlertDialogTitle>
                <AlertDialogDescription>This removes everything recorded for this day.</AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel disabled={clearing}>Cancel</AlertDialogCancel>
                <AlertDialogAction variant="destructive" onClick={handleClear} disabled={clearing}>
                  {clearing ? "Clearing…" : "Clear"}
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : (
          <span />
        )}
        <Button type="button" variant="default" onClick={handleSave} disabled={saving}>
          {saving ? (
            "Saving…"
          ) : justSaved ? (
            <>
              Saved
              <Check data-icon="inline-end" aria-hidden="true" />
            </>
          ) : (
            "Save"
          )}
        </Button>
      </div>
    </div>
  );
}

/** One chip group backed by a slice of the shared `symptoms: SymptomId[]` field —
 * factored out so Physical/Emotional/Other read identically apart from which ids they
 * own (SPEC.md's "everything else behind expanders" applies uniformly to all three). */
function SymptomGroupChips({
  legend,
  ids,
  selected,
  onChange,
}: {
  legend: string;
  ids: SymptomId[];
  selected: SymptomId[];
  onChange: (next: SymptomId[]) => void;
}) {
  return (
    <ChipGroup<SymptomId>
      mode="multi"
      legend={legend}
      options={ids.map((id) => ({ value: id, label: capitalizedSymptomLabel(id) }))}
      value={selected.filter((id) => ids.includes(id))}
      onChange={(nextForGroup) => onChange(mergeSymptomGroup(selected, ids, nextForGroup))}
    />
  );
}

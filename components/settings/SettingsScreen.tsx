"use client";

/**
 * Settings (SPEC.md's U1 brief): every toggle in the Settings type, the notification
 * wording preview, a data-export entry point (the report screen itself is owned by
 * agent U4 — this only links to it), permanent delete with a real confirmation, and the
 * docs/PRIVACY.md statement rendered verbatim, not paraphrased.
 *
 * Auto-saves: every change here PUTs the whole profile to /api/profile immediately
 * (SPEC.md's data layer has no partial-update route — see app/api/profile/route.ts's
 * own comment — so every write here is a full replace built from the last-fetched
 * profile plus the one field just changed).
 */
import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { FileTextIcon, Trash2Icon } from "lucide-react";
import { cn } from "@/lib/utils";
import { parseCivil, type CivilDate } from "@/lib/date/civil";
import { isValidTimeZone } from "@/lib/time/userTimeZone";
import { clientToday } from "@/components/charts/api";
import type { HormonalMethodKind, Profile, Settings } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { ChipCheck } from "@/components/daylog/ChipGroup";
import { PRIVACY_STATEMENT, FERTILITY_DISCLAIMER } from "@/lib/copy/general";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { DeleteAllDataSheet } from "@/components/settings/DeleteAllDataSheet";
import { ScreenLockCard } from "@/components/settings/ScreenLockCard";
import {
  CYCLE_LENGTH_BOUNDS,
  PERIOD_DURATION_BOUNDS,
  isValidCycleLengthDays,
  isValidPeriodDurationDays,
  type Regularity,
} from "@/components/onboarding/onboardingAnswers";

const HORMONAL_METHOD_OPTIONS: { value: HormonalMethodKind; label: string }[] = [
  { value: "combined_pill", label: "Combined pill" },
  { value: "progestin_only_pill", label: "Progestin-only pill" },
  { value: "patch", label: "Patch" },
  { value: "ring", label: "Ring" },
  { value: "hormonal_iud", label: "Hormonal IUD" },
  { value: "implant", label: "Implant" },
  { value: "injection", label: "Injection" },
];

type SaveState = "idle" | "saving" | "saved" | "error";

/** Shared Daylight row/control styles for this screen (and its sub-cards). */
const ROW = "min-h-chip py-2";
const ROW_LABEL = "text-body font-normal text-card-foreground";
const SUB_LABEL = "text-label text-card-foreground";
const INPUT = "h-chip rounded-xl px-3 text-body tabular-nums md:text-body";
/** Switch lists read as one list: hairline dividers instead of loose gaps. */
const ROW_LIST = "gap-0 divide-y divide-border";

export function SettingsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const today = clientToday();

  useEffect(() => {
    fetch("/api/profile")
      .then((res) => res.json())
      .then((data: { profile: Profile }) => setProfile(data.profile))
      .catch(() => setSaveState("error"));
  }, []);

  async function save(next: Profile) {
    setProfile(next);
    setSaveState("saving");
    try {
      const res = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(next),
      });
      if (!res.ok) throw new Error("save failed");
      setSaveState("saved");
    } catch {
      setSaveState("error");
    }
  }

  if (deleted) {
    return (
      <div className="mx-auto w-full max-w-2xl px-gutter py-section">
        <Empty className="stage">
          <EmptyHeader>
            <EmptyTitle>Everything was deleted</EmptyTitle>
            <EmptyDescription>
              Your day logs, profile, and prediction history have been permanently removed.
            </EmptyDescription>
          </EmptyHeader>
        </Empty>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="mx-auto flex w-full max-w-2xl items-center gap-2 px-gutter py-section text-label font-normal text-muted-foreground">
        <Spinner />
        Loading settings…
      </div>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-col gap-section px-gutter py-section">
      <div className="flex items-baseline justify-between gap-2">
        <h1 className="text-title text-foreground">Settings</h1>
        <SaveIndicator state={saveState} />
      </div>

      {/* Privacy, export and delete live together, first (Flo privacy / Sora data
          controls): the things someone checks before trusting the app with anything. */}
      <SettingsSection id="settings-privacy" title="Privacy & data">
        <Button
          variant="outline"
          className="w-full rounded-full bg-card"
          nativeButton={false}
          render={<Link href="/report" />}
        >
          <FileTextIcon data-icon="inline-start" />
          Export or build a report
        </Button>
        <ScreenLockCard />
        <PrivacyCard />
        <Button variant="destructive" className="w-full rounded-full" onClick={() => setDeleteOpen(true)}>
          <Trash2Icon data-icon="inline-start" />
          Permanently delete all data
        </Button>
      </SettingsSection>

      <SettingsSection
        id="settings-cycle"
        title="Cycle basics"
        action={<Badge variant="secondary">Optional</Badge>}
      >
        <CycleBasicsCard profile={profile} onSave={save} />
      </SettingsSection>

      <SettingsSection id="settings-situation" title="Your situation">
        <LifeStageCard profile={profile} today={today} onSave={save} hormonalMethodOptions={HORMONAL_METHOD_OPTIONS} />
      </SettingsSection>

      <SettingsSection id="settings-features" title="Features">
        <FeaturesCard profile={profile} onSave={save} />
      </SettingsSection>

      <SettingsSection id="settings-time-zone" title="Time zone">
        <TimeZoneCard onSaveState={setSaveState} />
      </SettingsSection>

      <SettingsSection id="settings-notifications" title="Notifications">
        <NotificationSettings
          settings={profile.settings}
          onChange={(settings) => save({ ...profile, settings })}
        />
      </SettingsSection>

      {deleteOpen ? (
        <DeleteAllDataSheet
          hasProfile={true}
          onClose={() => setDeleteOpen(false)}
          onDeleted={() => {
            setDeleteOpen(false);
            setDeleted(true);
          }}
        />
      ) : null}
    </main>
  );
}

/** A visible, labelled settings group: the heading sits on the page canvas, the cards
 * below it on their own stages, so the page scans by group. */
function SettingsSection({
  id,
  title,
  action,
  children,
}: {
  id: string;
  title: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-labelledby={id} className="flex flex-col gap-stack">
      <div className="flex items-center justify-between gap-2 px-1">
        <h2 id={id} className="text-heading text-foreground">
          {title}
        </h2>
        {action}
      </div>
      {children}
    </section>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const text = { saving: "Saving…", saved: "Saved", error: "Could not save" }[state];
  return (
    <span className={cn("text-caption", state === "error" ? "text-destructive" : "text-muted-foreground")}>
      {text}
    </span>
  );
}

/**
 * A self-reported whole-number field (cycle length, period length).
 *
 * UNCONTROLLED on purpose. These used to be controlled inputs that PUT the profile on
 * every keystroke, which meant a half-typed "4" on the way to "45" was saved as a real
 * answer, and "45" itself was saved too — `lib/domain/schema.ts` now rejects that at the
 * API, so the same keystroke-saving would just surface as a failed save. Committing on
 * blur lets the user type freely, validates once, and only then writes. An out-of-range
 * entry is reverted and says why rather than being silently dropped.
 *
 * `key` on the input resyncs `defaultValue` whenever the stored value changes from
 * elsewhere (the "I don't know" checkbox, or the initial profile fetch).
 */
function ReportedNumberField({
  value,
  bounds,
  isValid,
  label,
  unit,
  onCommit,
}: {
  value: number;
  bounds: { min: number; max: number };
  isValid: (n: number) => boolean;
  label: string;
  unit: string;
  onCommit: (n: number) => void;
}) {
  const [error, setError] = useState<string | null>(null);

  return (
    <>
      {/* Wrapped so the Field's full-width child rule doesn't stretch the input. */}
      <div>
        <Input
          key={value}
          type="number"
          inputMode="numeric"
          min={bounds.min}
          max={bounds.max}
          aria-label={label}
          aria-invalid={error !== null}
          aria-describedby={error !== null ? `${label}-error` : undefined}
          className={cn(INPUT, "w-28")}
          defaultValue={value}
          onBlur={(e) => {
            const next = Number(e.target.value);
            if (e.target.value.trim() === "" || !isValid(next)) {
              e.target.value = String(value);
              setError(`Enter a whole number of ${unit} between ${bounds.min} and ${bounds.max}.`);
              return;
            }
            setError(null);
            if (next !== value) onCommit(next);
          }}
        />
      </div>
      {error !== null ? (
        <FieldDescription id={`${label}-error`} className="text-destructive">
          {error}
        </FieldDescription>
      ) : null}
    </>
  );
}

function CycleBasicsCard({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const known = profile.reportedTypicalCycleLength !== undefined;
  const durationKnown = profile.reportedTypicalPeriodDays !== undefined;
  const regularity = profile.reportedRegularity ?? "unknown";

  return (
    <Card>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel className={SUB_LABEL}>Typical cycle length</FieldLabel>
            <Field orientation="horizontal" className="min-h-chip">
              <Checkbox
                id="cycle-length-unknown"
                checked={!known}
                onCheckedChange={(checked) =>
                  onSave({
                    ...profile,
                    reportedTypicalCycleLength: checked ? undefined : CYCLE_LENGTH_BOUNDS.min,
                  })
                }
              />
              <FieldLabel htmlFor="cycle-length-unknown" className={ROW_LABEL}>
                I don&apos;t know
              </FieldLabel>
            </Field>
            {known ? (
              <ReportedNumberField
                value={profile.reportedTypicalCycleLength ?? CYCLE_LENGTH_BOUNDS.min}
                bounds={CYCLE_LENGTH_BOUNDS}
                isValid={isValidCycleLengthDays}
                label="Typical cycle length in days"
                unit="days"
                onCommit={(n) => onSave({ ...profile, reportedTypicalCycleLength: n })}
              />
            ) : null}
          </Field>

          <Field>
            <FieldLabel className={SUB_LABEL}>Typical period length</FieldLabel>
            <Field orientation="horizontal" className="min-h-chip">
              <Checkbox
                id="period-length-unknown"
                checked={!durationKnown}
                onCheckedChange={(checked) =>
                  onSave({
                    ...profile,
                    reportedTypicalPeriodDays: checked ? undefined : PERIOD_DURATION_BOUNDS.min,
                  })
                }
              />
              <FieldLabel htmlFor="period-length-unknown" className={ROW_LABEL}>
                I don&apos;t know
              </FieldLabel>
            </Field>
            {durationKnown ? (
              <ReportedNumberField
                value={profile.reportedTypicalPeriodDays ?? PERIOD_DURATION_BOUNDS.min}
                bounds={PERIOD_DURATION_BOUNDS}
                isValid={isValidPeriodDurationDays}
                label="Typical period length in days"
                unit="days"
                onCommit={(n) => onSave({ ...profile, reportedTypicalPeriodDays: n })}
              />
            ) : null}
          </Field>

          <Field>
            <FieldLabel className={SUB_LABEL}>Regularity</FieldLabel>
            <ToggleGroup
              aria-label="Cycle regularity"
              value={[regularity]}
              onValueChange={(values) => {
                const next = values[0] as Regularity | undefined;
                if (next) onSave({ ...profile, reportedRegularity: next });
              }}
              className="flex-wrap"
            >
              <ToggleGroupItem value="consistent" variant="chip" size="chip">
                <ChipCheck />
                Fairly consistent
              </ToggleGroupItem>
              <ToggleGroupItem value="variable" variant="chip" size="chip">
                <ChipCheck />
                Varies a lot
              </ToggleGroupItem>
              <ToggleGroupItem value="unknown" variant="chip" size="chip">
                <ChipCheck />
                Not sure
              </ToggleGroupItem>
            </ToggleGroup>
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function LifeStageCard({
  profile,
  today,
  onSave,
  hormonalMethodOptions,
}: {
  profile: Profile;
  today: CivilDate;
  onSave: (p: Profile) => void;
  hormonalMethodOptions: { value: HormonalMethodKind; label: string }[];
}) {
  const s = profile.state;

  function setState(next: Partial<Profile["state"]>) {
    onSave({ ...profile, state: { ...s, ...next } });
  }

  return (
    <Card>
      <CardContent>
        <FieldGroup className={ROW_LIST}>
          <Field orientation="horizontal" className="mb-2 min-h-chip rounded-xl bg-muted px-4 py-2">
            <FieldLabel htmlFor="prefer-not-to-say" className={ROW_LABEL}>
              I&apos;d rather not answer these
            </FieldLabel>
            <Switch
              id="prefer-not-to-say"
              checked={s.preferNotToSay}
              onCheckedChange={(preferNotToSay) =>
                setState(
                  preferNotToSay
                    ? {
                        preferNotToSay,
                        pregnant: false,
                        deliveryDate: undefined,
                        breastfeeding: false,
                        hormonalMethod: undefined,
                        copperIudInsertedOn: undefined,
                        stoppedHormonalOn: undefined,
                        perimenopauseSelfDeclared: false,
                        menopauseSelfDeclared: false,
                        knownIrregular: false,
                      }
                    : { preferNotToSay },
                )
              }
            />
          </Field>

          {s.preferNotToSay ? null : (
            <>
              <ToggleRow
                id="state-pregnant"
                label="Pregnant"
                checked={s.pregnant}
                onChange={(pregnant) => setState({ pregnant })}
              />
              <ToggleRow
                id="state-postpartum"
                label="Gave birth recently (postpartum)"
                checked={s.deliveryDate !== undefined}
                onChange={(v) => setState({ deliveryDate: v ? today : undefined })}
              />
              {s.deliveryDate !== undefined ? (
                <DateRow
                  label="Delivery date"
                  value={s.deliveryDate}
                  max={today}
                  onChange={(deliveryDate) => setState({ deliveryDate: deliveryDate ?? undefined })}
                />
              ) : null}
              <ToggleRow
                id="state-breastfeeding"
                label="Breastfeeding"
                checked={s.breastfeeding}
                onChange={(breastfeeding) => setState({ breastfeeding })}
              />
              <ToggleRow
                id="state-hormonal"
                label="Using hormonal birth control"
                checked={s.hormonalMethod !== undefined}
                onChange={(v) =>
                  setState({
                    hormonalMethod: v ? { kind: "combined_pill", startedOn: today } : undefined,
                  })
                }
              />
              {s.hormonalMethod ? (
                <div className="flex flex-col gap-stack py-3">
                  <Field>
                    <FieldLabel htmlFor="method-kind" className={SUB_LABEL}>
                      Method
                    </FieldLabel>
                    <Select
                      value={s.hormonalMethod.kind}
                      onValueChange={(kind) =>
                        setState({
                          hormonalMethod: { ...s.hormonalMethod!, kind: kind as HormonalMethodKind },
                        })
                      }
                    >
                      <SelectTrigger id="method-kind" className="h-chip w-full rounded-xl px-3 text-body">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {hormonalMethodOptions.map((o) => (
                          <SelectItem key={o.value} value={o.value}>
                            {o.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </Field>
                  <DateRow
                    label="Started on"
                    value={s.hormonalMethod.startedOn}
                    max={today}
                    onChange={(startedOn) =>
                      startedOn && setState({ hormonalMethod: { ...s.hormonalMethod!, startedOn } })
                    }
                  />
                </div>
              ) : (
                <>
                  <ToggleRow
                    id="state-stopped-hormonal"
                    label="Recently stopped hormonal birth control"
                    checked={s.stoppedHormonalOn !== undefined}
                    onChange={(v) => setState({ stoppedHormonalOn: v ? today : undefined })}
                  />
                  {s.stoppedHormonalOn !== undefined ? (
                    <DateRow
                      label="Stopped on"
                      value={s.stoppedHormonalOn}
                      max={today}
                      onChange={(v) => setState({ stoppedHormonalOn: v ?? undefined })}
                    />
                  ) : null}
                </>
              )}
              <ToggleRow
                id="state-copper-iud"
                label="Using a copper IUD"
                checked={s.copperIudInsertedOn !== undefined}
                onChange={(v) => setState({ copperIudInsertedOn: v ? today : undefined })}
              />
              {s.copperIudInsertedOn !== undefined ? (
                <DateRow
                  label="Inserted on"
                  value={s.copperIudInsertedOn}
                  max={today}
                  onChange={(v) => setState({ copperIudInsertedOn: v ?? undefined })}
                />
              ) : null}
              <ToggleRow
                id="state-perimenopause"
                label="In perimenopause"
                checked={s.perimenopauseSelfDeclared}
                onChange={(perimenopauseSelfDeclared) => setState({ perimenopauseSelfDeclared })}
              />
              <ToggleRow
                id="state-menopause"
                label="Postmenopausal"
                checked={s.menopauseSelfDeclared}
                onChange={(menopauseSelfDeclared) => setState({ menopauseSelfDeclared })}
              />
              <ToggleRow
                id="state-known-irregular"
                label="I already know my cycles are irregular"
                checked={s.knownIrregular}
                onChange={(knownIrregular) => setState({ knownIrregular })}
              />
            </>
          )}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <Field orientation="horizontal" className={ROW}>
      <FieldLabel htmlFor={id} className={ROW_LABEL}>
        {label}
      </FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}

function DateRow({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: CivilDate;
  max: CivilDate;
  onChange: (v: CivilDate | null) => void;
}) {
  const id = `settings-date-${label.toLowerCase().replace(/\s+/g, "-")}`;
  return (
    <Field className="py-3">
      <FieldLabel htmlFor={id} className={SUB_LABEL}>
        {label}
      </FieldLabel>
      <Input
        id={id}
        type="date"
        max={max}
        className={cn(INPUT, "w-full")}
        value={value}
        onChange={(e) => {
          if (!e.target.value) return onChange(null);
          try {
            onChange(parseCivil(e.target.value));
          } catch {
            // Ignore an in-progress/invalid native date-input value.
          }
        }}
      />
    </Field>
  );
}

function FeaturesCard({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const { settings } = profile;
  function setSettings(next: Partial<Settings>) {
    onSave({ ...profile, settings: { ...settings, ...next } });
  }

  return (
    <Card>
      <CardContent>
        <FieldGroup className={ROW_LIST}>
          <Field orientation="horizontal" className={cn(ROW, "pb-3")}>
            <FieldContent>
              <FieldLabel htmlFor="feature-fertility" className={ROW_LABEL}>Fertility window estimates</FieldLabel>
              <FieldDescription>
                {settings.fertilityEnabled
                  ? FERTILITY_DISCLAIMER
                  : "Off. Turning this on removes no data — it only adds an optional estimate you can turn back off at any time."}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="feature-fertility"
              checked={settings.fertilityEnabled}
              onCheckedChange={(fertilityEnabled) => setSettings({ fertilityEnabled })}
            />
          </Field>

          <Field orientation="horizontal" className={cn(ROW, "py-3")}>
            <FieldLabel htmlFor="feature-tierc" className={ROW_LABEL}>
              Extra symptom tracking (sleep, exercise, focus, libido)
            </FieldLabel>
            <Switch
              id="feature-tierc"
              checked={settings.tierCSymptomsEnabled}
              onCheckedChange={(tierCSymptomsEnabled) => setSettings({ tierCSymptomsEnabled })}
            />
          </Field>

          <Field orientation="horizontal" className={cn(ROW, "pt-3")}>
            <FieldContent>
              <FieldLabel htmlFor="feature-health-awareness" className={ROW_LABEL}>Health awareness notes</FieldLabel>
              <FieldDescription>
                Occasional notes that quote a named guideline (e.g. ACOG, NHS) when what
                you&apos;ve recorded matches something they suggest discussing with a
                clinician.
              </FieldDescription>
            </FieldContent>
            <Switch
              id="feature-health-awareness"
              checked={settings.healthAwarenessEnabled}
              onCheckedChange={(healthAwarenessEnabled) => setSettings({ healthAwarenessEnabled })}
            />
          </Field>
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

/**
 * The zone "today" is worked out in — in the app and in MCP answers. Automatic (default)
 * follows this device via TimeZoneSync; turning it off pins a zone picked from the list,
 * committed on blur like ReportedNumberField so a half-typed name is never saved.
 */
function TimeZoneCard({ onSaveState }: { onSaveState: (s: SaveState) => void }) {
  const router = useRouter();
  const [setting, setSetting] = useState<{ timeZone: string | null; manual: boolean } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const deviceZone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  const zones = useMemo(() => Intl.supportedValuesOf("timeZone"), []);

  useEffect(() => {
    fetch("/api/time-zone")
      .then((res) => res.json())
      .then((data: { timeZone: string | null; manual: boolean }) => setSetting(data))
      .catch(() => onSaveState("error"));
  }, [onSaveState]);

  async function save(timeZone: string, manual: boolean) {
    const previous = setting;
    setSetting({ timeZone, manual });
    onSaveState("saving");
    try {
      const res = await fetch("/api/time-zone", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ timeZone, manual }),
      });
      if (!res.ok) throw new Error("save failed");
      const saved = (await res.json()) as { timeZone: string; manual: boolean };
      setSetting(saved);
      onSaveState("saved");
      router.refresh();
    } catch {
      setSetting(previous);
      onSaveState("error");
    }
  }

  if (!setting) {
    return (
      <Card>
        <CardContent className="flex min-h-chip items-center gap-2 text-label font-normal text-muted-foreground">
          <Spinner />
          Loading…
        </CardContent>
      </Card>
    );
  }

  const current = setting.timeZone ?? deviceZone;

  return (
    <Card>
      <CardContent>
        <FieldGroup className={ROW_LIST}>
          <Field orientation="horizontal" className={cn(ROW, setting.manual ? "pb-3" : undefined)}>
            <FieldContent>
              <FieldLabel htmlFor="time-zone-auto" className={ROW_LABEL}>
                Set automatically
              </FieldLabel>
              <FieldDescription>
                {setting.manual
                  ? `Off. "Today" stays in ${current} wherever you open the app.`
                  : `Follows this device's time zone (${deviceZone}).`}
              </FieldDescription>
            </FieldContent>
            <Switch
              id="time-zone-auto"
              checked={!setting.manual}
              onCheckedChange={(auto) => {
                setError(null);
                void save(auto ? deviceZone : current, !auto);
              }}
            />
          </Field>

          {setting.manual ? (
            <Field className="pt-3">
              <FieldLabel htmlFor="time-zone-manual" className={SUB_LABEL}>
                Time zone
              </FieldLabel>
              <Input
                key={current}
                id="time-zone-manual"
                list="time-zone-options"
                autoComplete="off"
                spellCheck={false}
                aria-invalid={error !== null}
                aria-describedby={error !== null ? "time-zone-error" : undefined}
                className={cn(INPUT, "w-full")}
                defaultValue={current}
                onKeyDown={(e) => {
                  if (e.key === "Enter") e.currentTarget.blur();
                }}
                onBlur={(e) => {
                  const next = e.target.value.trim();
                  if (!isValidTimeZone(next)) {
                    e.target.value = current;
                    setError("Pick a time zone from the list, e.g. Asia/Bangkok.");
                    return;
                  }
                  setError(null);
                  if (next !== current) void save(next, true);
                }}
              />
              <datalist id="time-zone-options">
                {zones.map((z) => (
                  <option key={z} value={z} />
                ))}
              </datalist>
              {error !== null ? (
                <FieldDescription id="time-zone-error" className="text-destructive">
                  {error}
                </FieldDescription>
              ) : (
                <FieldDescription>Used for &quot;today&quot; in the app and in MCP answers.</FieldDescription>
              )}
            </Field>
          ) : null}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function PrivacyCard() {
  return (
    <Card className="gap-stack">
      <CardHeader>
        <CardTitle role="heading" aria-level={3} className="text-body font-semibold">
          Privacy
        </CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-label font-normal text-card-foreground text-pretty">{PRIVACY_STATEMENT}</p>
      </CardContent>
    </Card>
  );
}

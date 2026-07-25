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
import { useEffect, useState } from "react";
import Link from "next/link";
import { FileTextIcon, Trash2Icon } from "lucide-react";
import { parseCivil, todayInZone, type CivilDate } from "@/lib/date/civil";
import type { HormonalMethodKind, Profile, Settings } from "@/lib/domain/types";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardAction, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Empty, EmptyDescription, EmptyHeader, EmptyTitle } from "@/components/ui/empty";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { PRIVACY_STATEMENT, FERTILITY_DISCLAIMER } from "@/lib/copy/general";
import { NotificationSettings } from "@/components/settings/NotificationSettings";
import { DeleteAllDataSheet } from "@/components/settings/DeleteAllDataSheet";
import { ScreenLockCard } from "@/components/settings/ScreenLockCard";
import {
  CYCLE_LENGTH_BOUNDS,
  PERIOD_DURATION_BOUNDS,
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

function todayCivil(): CivilDate {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  return todayInZone(tz, Date.now());
}

export function SettingsScreen() {
  const [profile, setProfile] = useState<Profile | null>(null);
  const [saveState, setSaveState] = useState<SaveState>("idle");
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [deleted, setDeleted] = useState(false);
  const today = todayCivil();

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
      <div className="mx-auto w-full max-w-md px-4 py-8">
        <Empty>
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
      <div className="mx-auto flex w-full max-w-md items-center gap-2 px-4 py-8 text-sm text-muted-foreground">
        <Spinner />
        Loading settings…
      </div>
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col gap-4 px-4 py-8">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-semibold text-foreground">Settings</h1>
        <SaveIndicator state={saveState} />
      </div>

      <CycleBasicsCard profile={profile} onSave={save} />
      <LifeStageCard profile={profile} today={today} onSave={save} hormonalMethodOptions={HORMONAL_METHOD_OPTIONS} />
      <FeaturesCard profile={profile} onSave={save} />
      <NotificationSettings
        settings={profile.settings}
        onChange={(settings) => save({ ...profile, settings })}
      />
      <ScreenLockCard />
      <DataCard onDeleteClick={() => setDeleteOpen(true)} />
      <PrivacyCard />

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
    </div>
  );
}

function SaveIndicator({ state }: { state: SaveState }) {
  if (state === "idle") return null;
  const text = { saving: "Saving…", saved: "Saved", error: "Could not save" }[state];
  return (
    <span className={["text-xs", state === "error" ? "text-destructive" : "text-muted-foreground"].join(" ")}>
      {text}
    </span>
  );
}

function CycleBasicsCard({ profile, onSave }: { profile: Profile; onSave: (p: Profile) => void }) {
  const known = profile.reportedTypicalCycleLength !== undefined;
  const durationKnown = profile.reportedTypicalPeriodDays !== undefined;
  const regularity = profile.reportedRegularity ?? "unknown";

  return (
    <Card>
      <CardHeader>
        <CardTitle>Cycle basics</CardTitle>
        <CardAction>
          <Badge variant="secondary">Optional</Badge>
        </CardAction>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field>
            <FieldLabel>Typical cycle length</FieldLabel>
            <Field orientation="horizontal">
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
              <FieldLabel htmlFor="cycle-length-unknown" className="font-normal">
                I don&apos;t know
              </FieldLabel>
            </Field>
            {known ? (
              <Input
                type="number"
                inputMode="numeric"
                min={CYCLE_LENGTH_BOUNDS.min}
                max={CYCLE_LENGTH_BOUNDS.max}
                aria-label="Typical cycle length in days"
                className="h-11 w-28"
                value={profile.reportedTypicalCycleLength ?? ""}
                onChange={(e) =>
                  onSave({
                    ...profile,
                    reportedTypicalCycleLength: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            ) : null}
          </Field>

          <Field>
            <FieldLabel>Typical period length</FieldLabel>
            <Field orientation="horizontal">
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
              <FieldLabel htmlFor="period-length-unknown" className="font-normal">
                I don&apos;t know
              </FieldLabel>
            </Field>
            {durationKnown ? (
              <Input
                type="number"
                inputMode="numeric"
                min={PERIOD_DURATION_BOUNDS.min}
                max={PERIOD_DURATION_BOUNDS.max}
                aria-label="Typical period length in days"
                className="h-11 w-28"
                value={profile.reportedTypicalPeriodDays ?? ""}
                onChange={(e) =>
                  onSave({
                    ...profile,
                    reportedTypicalPeriodDays: e.target.value === "" ? undefined : Number(e.target.value),
                  })
                }
              />
            ) : null}
          </Field>

          <Field>
            <FieldLabel>Regularity</FieldLabel>
            <ToggleGroup
              aria-label="Cycle regularity"
              value={[regularity]}
              onValueChange={(values) => {
                const next = values[0] as Regularity | undefined;
                if (next) onSave({ ...profile, reportedRegularity: next });
              }}
              className="flex-wrap"
            >
              <ToggleGroupItem value="consistent" className="h-11">
                Fairly consistent
              </ToggleGroupItem>
              <ToggleGroupItem value="variable" className="h-11">
                Varies a lot
              </ToggleGroupItem>
              <ToggleGroupItem value="unknown" className="h-11">
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
      <CardHeader>
        <CardTitle>Your situation</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal" className="rounded-lg border border-border bg-muted/40 p-3">
            <FieldLabel htmlFor="prefer-not-to-say">I&apos;d rather not answer these</FieldLabel>
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
                <div className="flex flex-col gap-4 pl-2">
                  <Field>
                    <FieldLabel htmlFor="method-kind">Method</FieldLabel>
                    <Select
                      value={s.hormonalMethod.kind}
                      onValueChange={(kind) =>
                        setState({
                          hormonalMethod: { ...s.hormonalMethod!, kind: kind as HormonalMethodKind },
                        })
                      }
                    >
                      <SelectTrigger id="method-kind" className="h-11 w-full">
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
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
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
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="date"
        max={max}
        className="h-11 w-full"
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
      <CardHeader>
        <CardTitle>Features</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="feature-fertility">Fertility window estimates</FieldLabel>
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

          <Field orientation="horizontal">
            <FieldLabel htmlFor="feature-tierc">
              Extra symptom tracking (sleep, exercise, focus, libido)
            </FieldLabel>
            <Switch
              id="feature-tierc"
              checked={settings.tierCSymptomsEnabled}
              onCheckedChange={(tierCSymptomsEnabled) => setSettings({ tierCSymptomsEnabled })}
            />
          </Field>

          <Field orientation="horizontal">
            <FieldContent>
              <FieldLabel htmlFor="feature-health-awareness">Health awareness notes</FieldLabel>
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

function DataCard({ onDeleteClick }: { onDeleteClick: () => void }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Your data</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        <Button variant="outline" render={<Link href="/report" />}>
          <FileTextIcon data-icon="inline-start" />
          Export or build a report
        </Button>
        <Button variant="destructive" onClick={onDeleteClick}>
          <Trash2Icon data-icon="inline-start" />
          Permanently delete all data
        </Button>
      </CardContent>
    </Card>
  );
}

function PrivacyCard() {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Privacy</CardTitle>
      </CardHeader>
      <CardContent>
        <p className="whitespace-pre-line text-sm text-foreground">{PRIVACY_STATEMENT}</p>
      </CardContent>
    </Card>
  );
}

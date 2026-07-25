"use client";

/**
 * Onboarding wizard (PRD §5 initial prediction inputs, §12 special states — see this
 * agent's final report for the one PRD-listed question, "trying to conceive", that is
 * deliberately not asked because SPEC.md's fixed LifeStageState type has no field for
 * it and SPEC.md explicitly forbids assuming the user's reproductive goal).
 *
 * A single linear wizard over the pure state in onboardingAnswers.ts. On the final step
 * it PUTs the assembled Profile to /api/profile and, if the user gave a last-period
 * date, POSTs the corresponding DayLog to /api/day-logs (SPEC.md R2: dayLogs, not
 * Profile, is the source of truth for that date) — then hands off to the dashboard.
 */
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { compare, parseCivil, todayInZone, type CivilDate } from "@/lib/date/civil";
import type { HormonalMethodKind, Profile } from "@/lib/domain/types";
import { profileSchema } from "@/lib/domain/schema";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DISCLAIMER, FERTILITY_DISCLAIMER } from "@/lib/copy/general";
import {
  CYCLE_LENGTH_BOUNDS,
  PERIOD_DURATION_BOUNDS,
  answersFromProfile,
  buildInitialDayLog,
  buildProfilePatch,
  initialAnswers,
  isValidCycleLengthDays,
  isValidPeriodDurationDays,
  type OnboardingAnswers,
  type Regularity,
} from "@/components/onboarding/onboardingAnswers";

const DEFAULT_PROFILE_SHAPE: Profile = profileSchema.parse({
  state: {
    pregnant: false,
    breastfeeding: false,
    perimenopauseSelfDeclared: false,
    menopauseSelfDeclared: false,
    knownIrregular: false,
    preferNotToSay: false,
  },
  settings: {
    fertilityEnabled: false,
    tierCSymptomsEnabled: false,
    healthAwarenessEnabled: true,
    notifications: {
      periodReminder: false,
      fertileReminder: false,
      symptomReminder: false,
      medicationReminder: false,
      loggingReminder: false,
      healthAwareness: false,
      privateWording: true,
    },
    locale: "en-US",
  },
});

const HORMONAL_METHOD_OPTIONS: { value: HormonalMethodKind; label: string }[] = [
  { value: "combined_pill", label: "Combined pill" },
  { value: "progestin_only_pill", label: "Progestin-only pill" },
  { value: "patch", label: "Patch" },
  { value: "ring", label: "Ring" },
  { value: "hormonal_iud", label: "Hormonal IUD" },
  { value: "implant", label: "Implant" },
  { value: "injection", label: "Injection" },
];

const REGULARITY_OPTIONS: { value: Regularity; label: string }[] = [
  { value: "consistent", label: "Fairly consistent" },
  { value: "variable", label: "Varies a lot" },
  { value: "unknown", label: "Not sure" },
];

type Step =
  | "welcome"
  | "lastPeriod"
  | "cycleLength"
  | "periodDuration"
  | "regularity"
  | "specialStates"
  | "fertility"
  | "review";

const STEP_ORDER: Step[] = [
  "welcome",
  "lastPeriod",
  "cycleLength",
  "periodDuration",
  "regularity",
  "specialStates",
  "fertility",
  "review",
];

/** Turns a human label into a stable id fragment for label/control pairing, e.g.
 * "Gave birth recently (postpartum)" -> "gave-birth-recently-postpartum". */
function slugId(label: string): string {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function todayCivil(): CivilDate {
  const tz = typeof Intl !== "undefined" ? Intl.DateTimeFormat().resolvedOptions().timeZone : "UTC";
  return todayInZone(tz, Date.now());
}

export function OnboardingWizard() {
  const router = useRouter();
  const [stepIndex, setStepIndex] = useState(0);
  const [answers, setAnswers] = useState<OnboardingAnswers>(() => initialAnswers());
  const [baseProfile, setBaseProfile] = useState<Profile>(DEFAULT_PROFILE_SHAPE);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const today = useMemo(() => todayCivil(), []);

  // Prefill from any existing profile, so revisiting /onboarding doesn't discard prior
  // answers (see onboardingAnswers.ts's answersFromProfile doc comment).
  useEffect(() => {
    let cancelled = false;
    fetch("/api/profile")
      .then((res) => (res.ok ? res.json() : null))
      .then((data: { profile: Profile } | null) => {
        if (cancelled || !data) return;
        setBaseProfile(data.profile);
        setAnswers(answersFromProfile(data.profile));
      })
      .catch(() => {
        // No profile yet, or the API isn't reachable — the wizard still works with
        // untouched defaults; nothing to recover from here.
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const step = STEP_ORDER[stepIndex];

  function patch(next: Partial<OnboardingAnswers>) {
    setAnswers((prev) => ({ ...prev, ...next }));
  }

  function goNext() {
    setStepIndex((i) => Math.min(i + 1, STEP_ORDER.length - 1));
  }
  function goBack() {
    setStepIndex((i) => Math.max(i - 1, 0));
  }

  async function finish() {
    setSubmitting(true);
    setSubmitError(null);
    try {
      const profile = buildProfilePatch(answers, baseProfile);
      const profileRes = await fetch("/api/profile", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(profile),
      });
      if (!profileRes.ok) throw new Error("Could not save your profile. Please try again.");

      const dayLog = buildInitialDayLog(answers, today);
      if (dayLog) {
        const logRes = await fetch("/api/day-logs", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(dayLog),
        });
        if (!logRes.ok) throw new Error("Your profile saved, but your period date did not. Please log it from the calendar.");
      }

      router.push("/");
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-1 flex-col gap-4 px-4 py-8">
      <ProgressDots total={STEP_ORDER.length} index={stepIndex} />

      {step === "welcome" && <WelcomeStep />}
      {step === "lastPeriod" && (
        <LastPeriodStep
          value={answers.lastPeriodStart}
          today={today}
          onChange={(lastPeriodStart) => patch({ lastPeriodStart })}
        />
      )}
      {step === "cycleLength" && (
        <CycleLengthStep
          known={answers.cycleLengthKnown}
          days={answers.cycleLengthDays}
          onChange={(cycleLengthKnown, cycleLengthDays) => patch({ cycleLengthKnown, cycleLengthDays })}
        />
      )}
      {step === "periodDuration" && (
        <PeriodDurationStep
          known={answers.periodDurationKnown}
          days={answers.periodDurationDays}
          onChange={(periodDurationKnown, periodDurationDays) =>
            patch({ periodDurationKnown, periodDurationDays })
          }
        />
      )}
      {step === "regularity" && (
        <RegularityStep value={answers.regularity} onChange={(regularity) => patch({ regularity })} />
      )}
      {step === "specialStates" && <SpecialStatesStep answers={answers} patch={patch} today={today} />}
      {step === "fertility" && (
        <FertilityStep
          enabled={answers.fertilityEnabled}
          onChange={(fertilityEnabled) => patch({ fertilityEnabled })}
        />
      )}
      {step === "review" && <ReviewStep answers={answers} />}

      {submitError ? (
        <Alert variant="destructive">
          <AlertDescription>{submitError}</AlertDescription>
        </Alert>
      ) : null}

      <div className="mt-2 flex items-center justify-between gap-3">
        <Button variant="ghost" onClick={goBack} disabled={stepIndex === 0 || submitting}>
          Back
        </Button>
        {step === "review" ? (
          <Button onClick={finish} disabled={submitting}>
            {submitting ? "Saving…" : "Finish setup"}
          </Button>
        ) : (
          <Button onClick={goNext} disabled={submitting}>
            Continue
          </Button>
        )}
      </div>
    </div>
  );
}

function ProgressDots({ total, index }: { total: number; index: number }) {
  return (
    <div className="flex items-center gap-1.5" aria-hidden="true">
      {Array.from({ length: total }, (_, i) => (
        <span
          key={i}
          className={["h-1.5 flex-1 rounded-full", i <= index ? "bg-primary" : "bg-muted"].join(" ")}
        />
      ))}
    </div>
  );
}

function StepShell({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children?: React.ReactNode;
}) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-xl font-semibold">{title}</CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="flex flex-col gap-4">{children}</CardContent>
    </Card>
  );
}

function WelcomeStep() {
  return (
    <StepShell title="Let's set up your tracker">
      <p className="text-sm text-foreground">
        A few questions get you a first estimate. Every question is optional — answer
        &quot;I don&apos;t know&quot; or skip anything you&apos;d rather not answer, and
        nothing here assumes what you&apos;re using this app for.
      </p>
      <Alert>
        <AlertDescription>{DISCLAIMER}</AlertDescription>
      </Alert>
    </StepShell>
  );
}

function LastPeriodStep({
  value,
  today,
  onChange,
}: {
  value: CivilDate | null;
  today: CivilDate;
  onChange: (v: CivilDate | null) => void;
}) {
  const skipped = value === null;
  return (
    <StepShell
      title="When did your most recent period start?"
      description="This is the first day you bled, not spotting. It becomes a normal entry on your calendar, editable any time."
    >
      <FieldGroup>
        <Field>
          <FieldLabel htmlFor="last-period-date">Start date</FieldLabel>
          <Input
            id="last-period-date"
            type="date"
            className="h-11"
            max={today}
            value={value ?? ""}
            disabled={skipped}
            onChange={(e) => {
              const raw = e.target.value;
              if (!raw) {
                onChange(null);
                return;
              }
              try {
                const parsed = parseCivil(raw);
                onChange(compare(parsed, today) > 0 ? today : parsed);
              } catch {
                // Ignore an in-progress/invalid native date-input value.
              }
            }}
          />
        </Field>
        <Field orientation="horizontal">
          <Checkbox
            id="skip-last-period"
            checked={skipped}
            onCheckedChange={(checked) => onChange(checked ? null : today)}
          />
          <FieldLabel htmlFor="skip-last-period" className="font-normal">
            I&apos;ll log this later
          </FieldLabel>
        </Field>
      </FieldGroup>
    </StepShell>
  );
}

function CycleLengthStep({
  known,
  days,
  onChange,
}: {
  known: boolean;
  days: number | null;
  onChange: (known: boolean, days: number | null) => void;
}) {
  const invalid = known && days !== null && !isValidCycleLengthDays(days);
  return (
    <StepShell
      title="How long is your cycle, typically?"
      description="Counted from the first day of one period to the first day of the next. If you're not sure, say so — this app never assumes a number for you."
    >
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="cycle-length-unknown"
            checked={!known}
            onCheckedChange={(checked) => onChange(!checked, checked ? null : days)}
          />
          <FieldLabel htmlFor="cycle-length-unknown" className="font-normal">
            I don&apos;t know
          </FieldLabel>
        </Field>
        {known ? (
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor="cycle-length-days">Typical cycle length</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="cycle-length-days"
                type="number"
                inputMode="numeric"
                min={CYCLE_LENGTH_BOUNDS.min}
                max={CYCLE_LENGTH_BOUNDS.max}
                aria-invalid={invalid || undefined}
                className="h-11 w-28"
                value={days ?? ""}
                onChange={(e) => onChange(true, e.target.value === "" ? null : Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            {invalid ? (
              <FieldError>
                Enter a number between {CYCLE_LENGTH_BOUNDS.min} and {CYCLE_LENGTH_BOUNDS.max}, or choose
                &quot;I don&apos;t know&quot;.
              </FieldError>
            ) : null}
          </Field>
        ) : null}
      </FieldGroup>
    </StepShell>
  );
}

function PeriodDurationStep({
  known,
  days,
  onChange,
}: {
  known: boolean;
  days: number | null;
  onChange: (known: boolean, days: number | null) => void;
}) {
  const invalid = known && days !== null && !isValidPeriodDurationDays(days);
  return (
    <StepShell title="How many days does your period usually last?">
      <FieldGroup>
        <Field orientation="horizontal">
          <Checkbox
            id="period-duration-unknown"
            checked={!known}
            onCheckedChange={(checked) => onChange(!checked, checked ? null : days)}
          />
          <FieldLabel htmlFor="period-duration-unknown" className="font-normal">
            I don&apos;t know
          </FieldLabel>
        </Field>
        {known ? (
          <Field data-invalid={invalid || undefined}>
            <FieldLabel htmlFor="period-duration-days">Typical period length</FieldLabel>
            <div className="flex items-center gap-2">
              <Input
                id="period-duration-days"
                type="number"
                inputMode="numeric"
                min={PERIOD_DURATION_BOUNDS.min}
                max={PERIOD_DURATION_BOUNDS.max}
                aria-invalid={invalid || undefined}
                className="h-11 w-28"
                value={days ?? ""}
                onChange={(e) => onChange(true, e.target.value === "" ? null : Number(e.target.value))}
              />
              <span className="text-sm text-muted-foreground">days</span>
            </div>
            {invalid ? (
              <FieldError>
                Enter a number between {PERIOD_DURATION_BOUNDS.min} and {PERIOD_DURATION_BOUNDS.max}, or
                choose &quot;I don&apos;t know&quot;.
              </FieldError>
            ) : null}
          </Field>
        ) : null}
      </FieldGroup>
    </StepShell>
  );
}

function RegularityStep({
  value,
  onChange,
}: {
  value: Regularity;
  onChange: (v: Regularity) => void;
}) {
  return (
    <StepShell title="Are your cycles usually consistent, or do they vary?">
      <FieldSet>
        <FieldLegend variant="label">Cycle regularity</FieldLegend>
        <ToggleGroup
          aria-label="Cycle regularity"
          value={[value]}
          onValueChange={(next) => {
            const picked = next[0] as Regularity | undefined;
            if (picked) onChange(picked);
          }}
          variant="outline"
          className="w-full"
        >
          {REGULARITY_OPTIONS.map((o) => (
            <ToggleGroupItem key={o.value} value={o.value} className="h-11 flex-1 px-3 text-sm">
              {o.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </FieldSet>
    </StepShell>
  );
}

function SpecialStatesStep({
  answers,
  patch,
  today,
}: {
  answers: OnboardingAnswers;
  patch: (next: Partial<OnboardingAnswers>) => void;
  today: CivilDate;
}) {
  const preferNotToSay = answers.specialStatesPreferNotToSay;
  return (
    <StepShell
      title="Anything else going on?"
      description="These help this app avoid false alarms — e.g. it won't flag a missed period while you're pregnant. Answer as many or as few as you like."
    >
      <Field orientation="horizontal" className="rounded-lg border border-border bg-muted p-3">
        <FieldLabel htmlFor="prefer-not-to-say" className="font-normal">
          I&apos;d rather not answer these
        </FieldLabel>
        <Switch
          id="prefer-not-to-say"
          checked={preferNotToSay}
          onCheckedChange={(v) => patch({ specialStatesPreferNotToSay: v })}
        />
      </Field>

      {preferNotToSay ? null : (
        <FieldGroup>
          <YesNoRow label="Pregnant" checked={answers.pregnant} onChange={(pregnant) => patch({ pregnant })} />
          <YesNoRow
            label="Gave birth recently (postpartum)"
            checked={answers.postpartum}
            onChange={(postpartum) => patch({ postpartum, deliveryDate: postpartum ? answers.deliveryDate ?? today : null })}
          />
          {answers.postpartum ? (
            <DateField
              label="Delivery date"
              value={answers.deliveryDate}
              max={today}
              onChange={(deliveryDate) => patch({ deliveryDate })}
            />
          ) : null}
          <YesNoRow
            label="Breastfeeding"
            checked={answers.breastfeeding}
            onChange={(breastfeeding) => patch({ breastfeeding })}
          />
          <YesNoRow
            label="Using hormonal birth control"
            checked={answers.usingHormonalMethod}
            onChange={(usingHormonalMethod) => patch({ usingHormonalMethod })}
          />
          {answers.usingHormonalMethod ? (
            <div className="flex flex-col gap-4 pl-2">
              <Field>
                <FieldLabel htmlFor="hormonal-method">Method</FieldLabel>
                <Select
                  value={answers.hormonalMethodKind}
                  onValueChange={(v) => patch({ hormonalMethodKind: v })}
                >
                  <SelectTrigger id="hormonal-method" className="h-11 w-full" aria-label="Hormonal method">
                    <SelectValue placeholder="Choose one" />
                  </SelectTrigger>
                  <SelectContent>
                    {HORMONAL_METHOD_OPTIONS.map((o) => (
                      <SelectItem key={o.value} value={o.value}>
                        {o.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </Field>
              <DateField
                label="Started on"
                value={answers.hormonalMethodStartedOn}
                max={today}
                onChange={(hormonalMethodStartedOn) => patch({ hormonalMethodStartedOn })}
              />
            </div>
          ) : (
            <YesNoRow
              label="Recently stopped hormonal birth control"
              checked={answers.recentlyStoppedHormonal}
              onChange={(recentlyStoppedHormonal) => patch({ recentlyStoppedHormonal })}
            />
          )}
          {answers.recentlyStoppedHormonal && !answers.usingHormonalMethod ? (
            <DateField
              label="Stopped on"
              value={answers.stoppedHormonalOn}
              max={today}
              onChange={(stoppedHormonalOn) => patch({ stoppedHormonalOn })}
            />
          ) : null}
          <YesNoRow
            label="Using a copper IUD"
            checked={answers.usingCopperIud}
            onChange={(usingCopperIud) => patch({ usingCopperIud })}
          />
          {answers.usingCopperIud ? (
            <DateField
              label="Inserted on"
              value={answers.copperIudInsertedOn}
              max={today}
              onChange={(copperIudInsertedOn) => patch({ copperIudInsertedOn })}
            />
          ) : null}
          <YesNoRow
            label="In perimenopause"
            checked={answers.perimenopause}
            onChange={(perimenopause) => patch({ perimenopause })}
          />
          <YesNoRow
            label="Postmenopausal"
            checked={answers.menopause}
            onChange={(menopause) => patch({ menopause })}
          />
          <YesNoRow
            label="I already know my cycles are irregular"
            checked={answers.knownIrregular}
            onChange={(knownIrregular) => patch({ knownIrregular })}
          />
        </FieldGroup>
      )}
    </StepShell>
  );
}

function YesNoRow({
  label,
  checked,
  onChange,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  const id = `switch-${slugId(label)}`;
  return (
    <Field orientation="horizontal">
      <FieldLabel htmlFor={id} className="font-normal">
        {label}
      </FieldLabel>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </Field>
  );
}

function DateField({
  label,
  value,
  max,
  onChange,
}: {
  label: string;
  value: CivilDate | null;
  max: CivilDate;
  onChange: (v: CivilDate | null) => void;
}) {
  const id = `date-${slugId(label)}`;
  return (
    <Field>
      <FieldLabel htmlFor={id}>{label}</FieldLabel>
      <Input
        id={id}
        type="date"
        max={max}
        className="h-11"
        value={value ?? ""}
        onChange={(e) => {
          if (!e.target.value) {
            onChange(null);
            return;
          }
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

function FertilityStep({
  enabled,
  onChange,
}: {
  enabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <StepShell title="Fertility window estimates">
      <Alert>
        <AlertDescription>{FERTILITY_DISCLAIMER}</AlertDescription>
      </Alert>
      <p className="text-sm text-muted-foreground">
        This is off by default. If you turn it on, you can turn it off again at any time
        in Settings — turning it off removes every fertility-related screen and field, it
        doesn&apos;t just hide them.
      </p>
      <Field orientation="horizontal" className="rounded-lg border border-border bg-muted p-3">
        <FieldLabel htmlFor="fertility-enabled" className="font-normal">
          Show fertility window estimates
        </FieldLabel>
        <Switch id="fertility-enabled" checked={enabled} onCheckedChange={onChange} />
      </Field>
    </StepShell>
  );
}

function ReviewStep({ answers }: { answers: OnboardingAnswers }) {
  const rows: [string, string][] = [
    ["Last period start", answers.lastPeriodStart ?? "Not entered yet"],
    [
      "Typical cycle length",
      answers.cycleLengthKnown && answers.cycleLengthDays !== null
        ? `${answers.cycleLengthDays} days`
        : "I don't know",
    ],
    [
      "Typical period length",
      answers.periodDurationKnown && answers.periodDurationDays !== null
        ? `${answers.periodDurationDays} days`
        : "I don't know",
    ],
    [
      "Regularity",
      { consistent: "Fairly consistent", variable: "Varies a lot", unknown: "Not sure" }[answers.regularity],
    ],
    ["Fertility estimates", answers.fertilityEnabled ? "On" : "Off"],
  ];
  return (
    <StepShell title="Review" description="You can change any of this later in Settings.">
      <dl className="flex flex-col gap-2 text-sm">
        {rows.map(([label, val]) => (
          <div key={label} className="flex items-center justify-between gap-2 border-b border-border py-2 last:border-b-0">
            <dt className="text-muted-foreground">{label}</dt>
            <dd className="font-medium text-foreground">{val}</dd>
          </div>
        ))}
      </dl>
    </StepShell>
  );
}

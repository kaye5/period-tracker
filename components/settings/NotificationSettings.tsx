"use client";

/**
 * Notification toggles plus the live private-vs-detailed wording preview (SPEC.md's U1
 * brief: "notification controls per PRD §14 including a live preview of private wording
 * … versus detailed wording, with private as the default").
 */
import { Check } from "lucide-react";
import type { Settings } from "@/lib/domain/types";
import { cn } from "@/lib/utils";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";
import {
  NOTIFICATION_TOGGLES,
  notificationPreviewText,
  withNotificationToggle,
  withPrivateWording,
} from "@/components/settings/settingsHelpers";

export function NotificationSettings({
  settings,
  onChange,
}: {
  settings: Settings;
  onChange: (settings: Settings) => void;
}) {
  const { notifications } = settings;

  return (
    // The "Notifications" heading is the Settings section heading this card sits under.
    <Card>
      <CardContent>
        <FieldGroup className="gap-0 divide-y divide-border">
          <Field orientation="horizontal" className="mb-2 rounded-xl bg-muted p-4">
            <FieldContent>
              <FieldLabel htmlFor="notif-private-wording" className="text-body font-normal text-card-foreground">
                Private wording
              </FieldLabel>
              <FieldDescription>
                Notifications say only &quot;Reminder&quot; on your lock screen instead of what
                they&apos;re about.
              </FieldDescription>
              <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-2">
                <PreviewCard mode="Private" text="Reminder" active={notifications.privateWording} />
                <PreviewCard
                  mode="Detailed"
                  text={notificationPreviewText("periodReminder", false)}
                  active={!notifications.privateWording}
                />
              </div>
            </FieldContent>
            <Switch
              id="notif-private-wording"
              checked={notifications.privateWording}
              onCheckedChange={(v) => onChange(withPrivateWording(settings, v))}
            />
          </Field>

          {NOTIFICATION_TOGGLES.map(({ key, kind, label }) => (
            <Field orientation="horizontal" key={key} className="min-h-chip py-3 last:pb-0">
              <FieldContent>
                <FieldLabel htmlFor={`notif-${key}`} className="text-body font-normal text-card-foreground">
                  {label}
                </FieldLabel>
                <FieldDescription>{notificationPreviewText(kind, notifications.privateWording)}</FieldDescription>
              </FieldContent>
              <Switch
                id={`notif-${key}`}
                checked={notifications[key]}
                onCheckedChange={(v) => onChange(withNotificationToggle(settings, key, v))}
              />
            </Field>
          ))}
        </FieldGroup>
      </CardContent>
    </Card>
  );
}

function PreviewCard({ mode, text, active }: { mode: string; text: string; active: boolean }) {
  return (
    // Active preview: ink border + a check glyph, so the state never rests on colour.
    <div
      className={cn(
        "rounded-xl border bg-card px-3 py-2",
        active ? "border-primary" : "border-border opacity-60",
      )}
    >
      <p className="flex items-center gap-1 text-caption font-medium text-muted-foreground">
        {active ? <Check aria-hidden className="size-3.5 text-foreground" /> : null}
        {mode}
      </p>
      <p className="text-label font-normal text-card-foreground">{text}</p>
    </div>
  );
}

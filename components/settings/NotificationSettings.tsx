"use client";

/**
 * Notification toggles plus the live private-vs-detailed wording preview (SPEC.md's U1
 * brief: "notification controls per PRD §14 including a live preview of private wording
 * … versus detailed wording, with private as the default").
 */
import type { Settings } from "@/lib/domain/types";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
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
    <Card>
      <CardHeader>
        <CardTitle>Notifications</CardTitle>
      </CardHeader>
      <CardContent>
        <FieldGroup>
          <Field orientation="horizontal" className="rounded-lg border border-border bg-muted/40 p-3">
            <FieldContent>
              <FieldLabel htmlFor="notif-private-wording">Private wording</FieldLabel>
              <FieldDescription>
                Notifications say only &quot;Reminder&quot; on your lock screen instead of what
                they&apos;re about.
              </FieldDescription>
              <div className="mt-3 grid grid-cols-1 gap-2 text-xs sm:grid-cols-2">
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
            <Field orientation="horizontal" key={key}>
              <FieldContent>
                <FieldLabel htmlFor={`notif-${key}`}>{label}</FieldLabel>
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
    <div
      className={[
        "rounded-lg border p-2",
        active ? "border-primary bg-card" : "border-border bg-card opacity-60",
      ].join(" ")}
    >
      <p className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{mode}</p>
      <p className="text-foreground">{text}</p>
    </div>
  );
}

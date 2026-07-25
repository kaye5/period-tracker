import type { Metadata } from "next";
import { SettingsScreen } from "@/components/settings/SettingsScreen";
import { requirePageUnlock } from "@/lib/security/guard";

export const metadata: Metadata = {
  title: "Settings — Period Tracker",
};

// Server Component wrapper: enforce the screen lock before the (client) SettingsScreen —
// and its Screen-lock controls — can load.
export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  await requirePageUnlock();
  return <SettingsScreen />;
}

import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { isLocked } from "@/lib/security/guard";
import { UnlockScreen } from "@/components/security/UnlockScreen";

export const metadata: Metadata = {
  title: "Locked — Period Tracker",
};

// Reads the DB + the request's cookie every time; never statically prerender.
export const dynamic = "force-dynamic";

/**
 * The screen-lock gate. If the app isn't actually locked right now — no PIN configured, or
 * this browser already holds a valid unlock session — there is nothing to enter, so send
 * the user straight to the dashboard rather than showing a pointless PIN prompt.
 */
export default async function UnlockPage() {
  if (!(await isLocked())) {
    redirect("/");
  }
  return <UnlockScreen />;
}

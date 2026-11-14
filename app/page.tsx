import type { Metadata } from "next";
import { DashboardScreen } from "@/components/dashboard/DashboardScreen";
import { loadCycleView } from "./loadCycleView";

export const metadata: Metadata = {
  title: "Today",
};

// Render per-request, never at build time: the data is per-user and the database may be
// unreachable during a build (see loadCycleView).
export const dynamic = "force-dynamic";

/** Today — the app's home route. Onboarding redirect and screen lock happen in
 * `loadCycleView`. */
export default async function HomePage() {
  const { output, today, calendar } = await loadCycleView();
  return <DashboardScreen output={output} today={today} calendar={calendar} />;
}

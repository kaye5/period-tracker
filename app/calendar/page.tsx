import type { Metadata } from "next";
import { CalendarScreen } from "@/components/calendar/CalendarScreen";
import { loadCycleView } from "../loadCycleView";

export const metadata: Metadata = {
  title: "Calendar",
};

export const dynamic = "force-dynamic";

export default async function CalendarPage() {
  const { output, today, calendar } = await loadCycleView();
  return <CalendarScreen output={output} today={today} calendar={calendar} />;
}

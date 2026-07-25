"use client";

import { useMemo, useState } from "react";
import type { CivilDate } from "@/lib/date/civil";
import type { BleedingEpisode, Cycle, DayLog, Profile } from "@/lib/domain/types";
import { Button } from "@/components/ui/button";
import { RangePicker } from "@/components/report/RangePicker";
import { SelectionControls } from "@/components/report/SelectionControls";
import { PrintableReport } from "@/components/report/PrintableReport";
import { buildReportData } from "@/components/report/reportData";
import {
  DEFAULT_REPORT_SELECTION,
  buildExportQuery,
  effectiveSelection,
  type ReportSelection,
} from "@/components/report/reportSelection";
import { resolveReportRange, type CustomRangeInput, type ReportRangeOption } from "@/components/report/reportRange";

export interface ReportScreenProps {
  dayLogs: readonly DayLog[];
  cycles: readonly Cycle[];
  episodes: readonly BleedingEpisode[];
  profile: Profile;
  today: CivilDate;
}

/**
 * The Report screen (SPEC.md's U4 brief / PRD §10-11). Every write goes through the
 * existing `GET /api/export` for the CSV download; the on-screen/printable document is
 * rendered directly from the day logs, cycles and episodes this agent's `app/report/page.tsx`
 * already fetched server-side — no client-side recomputation of anything the engine owns
 * (SPEC.md §4.1 governs derived engine data; range/selection filtering here is
 * presentation-layer, not re-derivation).
 */
export function ReportScreen({ dayLogs, cycles, episodes, profile, today }: ReportScreenProps) {
  const [rangeOption, setRangeOption] = useState<ReportRangeOption>("3m");
  const [custom, setCustom] = useState<CustomRangeInput>({ from: null, to: null });
  const [selection, setSelection] = useState<ReportSelection>(DEFAULT_REPORT_SELECTION);

  const { range, error } = resolveReportRange(rangeOption, today, custom);
  const effSelection = effectiveSelection(selection, profile.settings.fertilityEnabled);

  const reportData = useMemo(() => {
    if (!range) return null;
    return buildReportData({ range, dayLogs, cycles, episodes, profile, selection: effSelection });
  }, [range, dayLogs, cycles, episodes, profile, effSelection]);

  const csvUrl = range ? buildExportQuery(range, effSelection, "csv") : null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-col gap-6 px-4 py-6">
      <div className="no-print flex flex-col gap-6">
        <h1 className="text-2xl font-semibold text-foreground">Report</h1>

        <RangePicker
          option={rangeOption}
          onOptionChange={setRangeOption}
          custom={custom}
          onCustomChange={setCustom}
          error={error}
        />

        <SelectionControls
          selection={selection}
          onChange={setSelection}
          fertilityEnabled={profile.settings.fertilityEnabled}
        />

        <div className="flex flex-wrap gap-2">
          <Button variant="default" onClick={() => window.print()} disabled={!reportData}>
            Print / Save as PDF
          </Button>
          {csvUrl ? (
            <Button variant="outline" render={<a href={csvUrl} />}>
              Download CSV
            </Button>
          ) : null}
        </div>
      </div>

      {reportData ? <PrintableReport data={reportData} /> : null}
    </main>
  );
}

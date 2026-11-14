import type { CycleStatistics } from "@/lib/engine/stats";
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion";
import { buildHistoryStatsViewModel } from "@/components/history/historyStats";

export interface StatsDetailsProps {
  stats: CycleStatistics;
}

/**
 * The History screen's reference-detail section (redesign spec's B3), rendered after
 * the charts: the flow tally plus the three accordion tables (symptom frequency,
 * symptoms by cycle timing, cycles with limited logging) that used to live in
 * `StatsPanel`. The headline numbers (typical cycle/period length, variability) moved
 * up into `StatsStrip` — this is the "how to read the detail" reference that doesn't
 * need to be above the fold. Same `buildHistoryStatsViewModel` view model as before;
 * nothing here is computed in the component.
 */
export function StatsDetails({ stats }: StatsDetailsProps) {
  const vm = buildHistoryStatsViewModel(stats);

  const openByDefault = vm.missingData.length > 0 ? ["missing-data"] : [];
  const hasAccordionContent =
    vm.symptomFrequency.length > 0 || vm.symptomsByCycleDay.length > 0 || vm.missingData.length > 0;

  return (
    <section className="flex flex-col gap-stack stage p-card">
      <h2 className="text-heading text-card-foreground">Details</h2>
      <div className="flex flex-col gap-1">
        <h3 className="text-label text-card-foreground">Flow</h3>
        <p className="text-label font-normal text-muted-foreground tabular-nums text-pretty">
          {vm.flow.daysWithLoggedFlow} day{vm.flow.daysWithLoggedFlow === 1 ? "" : "s"} with a flow level logged.
          Heavy-flow days: {vm.flow.heavyFlowDayCount}.
        </p>
        {vm.flow.heavyFlowDayCount > 0 ? (
          <p className="text-label font-normal text-muted-foreground tabular-nums text-pretty">{vm.flow.heavyFlowDatesText}</p>
        ) : null}
      </div>

      {hasAccordionContent ? (
        <Accordion multiple defaultValue={openByDefault} className="border-t border-border">
          {vm.symptomFrequency.length > 0 ? (
            <AccordionItem value="symptom-frequency" className="border-border">
              <AccordionTrigger className="min-h-chip items-center py-3 text-body font-medium hover:no-underline">Symptom frequency</AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max border-collapse text-left text-label font-normal tabular-nums">
                    <caption className="sr-only">How often each symptom was logged</caption>
                    <thead>
                      <tr>
                        <th scope="col" className="border-b border-border px-2 py-2 font-medium text-card-foreground">
                          Symptom
                        </th>
                        <th scope="col" className="border-b border-border px-2 py-2 font-medium text-card-foreground">
                          Frequency
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {vm.symptomFrequency.map((row) => (
                        <tr key={row.symptom}>
                          <td className="border-b border-border px-2 py-2 text-card-foreground">{row.label}</td>
                          <td className="border-b border-border px-2 py-2 text-muted-foreground">{row.rateText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {vm.symptomsByCycleDay.length > 0 ? (
            <AccordionItem value="symptoms-by-cycle-day" className="border-border">
              <AccordionTrigger className="min-h-chip items-center py-3 text-body font-medium hover:no-underline">Symptoms by cycle timing</AccordionTrigger>
              <AccordionContent>
                <div className="overflow-x-auto">
                  <table className="w-full min-w-max border-collapse text-left text-label font-normal tabular-nums">
                    <caption className="sr-only">
                      How often each symptom was logged, by cycle-day comparison window
                    </caption>
                    <thead>
                      <tr>
                        <th scope="col" className="border-b border-border px-2 py-2 font-medium text-card-foreground">
                          Symptom
                        </th>
                        <th scope="col" className="border-b border-border px-2 py-2 font-medium text-card-foreground">
                          Timing
                        </th>
                        <th scope="col" className="border-b border-border px-2 py-2 font-medium text-card-foreground">
                          Frequency
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {vm.symptomsByCycleDay.map((row) => (
                        <tr key={`${row.symptom}|${row.window}`}>
                          <td className="border-b border-border px-2 py-2 text-card-foreground">{row.label}</td>
                          <td className="border-b border-border px-2 py-2 text-muted-foreground">{row.windowLabel}</td>
                          <td className="border-b border-border px-2 py-2 text-muted-foreground">{row.rateText}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </AccordionContent>
            </AccordionItem>
          ) : null}

          {vm.missingData.length > 0 ? (
            <AccordionItem value="missing-data" className="border-border">
              <AccordionTrigger className="min-h-chip items-center py-3 text-body font-medium hover:no-underline">Cycles with limited logging</AccordionTrigger>
              <AccordionContent>
                <ul className="flex flex-col gap-1">
                  {vm.missingData.map((row) => (
                    <li key={row.startDate} className="text-label font-normal text-muted-foreground tabular-nums">
                      Cycle starting {row.startDateText}: {row.coverageText}
                    </li>
                  ))}
                </ul>
              </AccordionContent>
            </AccordionItem>
          ) : null}
        </Accordion>
      ) : null}
    </section>
  );
}

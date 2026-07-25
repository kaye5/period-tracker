import { DISCLAIMER } from "@/lib/copy/general";
import { formatReportRange } from "@/components/report/reportRange";
import type { ReportData } from "@/components/report/reportData";

export interface PrintableReportProps {
  data: ReportData;
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="report-section mb-6 break-inside-avoid">
      <h2 className="mb-2 text-base font-semibold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function Table({ columns, rows, emptyMessage }: { columns: string[]; rows: (string | number)[][]; emptyMessage: string }) {
  if (rows.length === 0) {
    return <p className="text-sm text-muted-foreground">{emptyMessage}</p>;
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-max border-collapse text-left text-sm">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c} scope="col" className="border-b border-border px-2 py-1 font-medium text-foreground">
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row, i) => (
            <tr key={i}>
              {row.map((cell, j) => (
                <td key={j} className="border-b border-border px-2 py-1 text-foreground">
                  {cell}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * The clinician-presentable document itself (SPEC.md's U4 brief: "a print stylesheet
 * good enough that 'Save as PDF' produces a clinician-presentable document"). Rendered
 * both on-screen (inside `ReportScreen`'s scrollable preview) and, via `app/report/report.css`'s
 * print media query, as the only thing left visible when the browser prints — this
 * component itself carries no nav chrome, so there is nothing extra to hide.
 */
export function PrintableReport({ data }: PrintableReportProps) {
  return (
    <article id="printable-report" className="rounded-2xl border border-border bg-card p-6 text-foreground">
      <header className="mb-6 border-b border-border pb-4">
        <h1 className="text-xl font-semibold text-foreground">Period tracker report</h1>
        <p className="text-sm text-muted-foreground">Date range: {formatReportRange(data.range)}</p>
        <p className="text-sm text-muted-foreground">A record of what was self-reported in the app during this range.</p>
      </header>

      <Section title="Periods">
        <Table
          columns={["Start", "End", "Duration", "Flow levels logged"]}
          rows={data.periods.map((p) => [p.startText, p.endText, p.durationText, p.flowLevelsText])}
          emptyMessage="No periods recorded in this range."
        />
      </Section>

      <Section title="Cycle lengths">
        <Table
          columns={["Cycle start", "Length", "Status"]}
          rows={data.cycles.map((c) => [c.startText, c.lengthText, c.statusLabel])}
          emptyMessage="No completed cycles started in this range."
        />
      </Section>

      <Section title="Pain">
        <Table
          columns={["Date", "Severity", "Location"]}
          rows={data.pain.map((p) => [p.dateText, p.severityLabel, p.sitesText ?? "Not specified"])}
          emptyMessage="No pain logged in this range."
        />
      </Section>

      <Section title="Symptoms">
        <Table
          columns={["Date", "Symptoms logged"]}
          rows={data.symptoms.map((s) => [s.dateText, s.symptomsText])}
          emptyMessage="No symptoms logged in this range."
        />
      </Section>

      <Section title="Unexpected bleeding">
        <Table
          columns={["Date", "Context"]}
          rows={data.unexpectedBleeding.map((r) => [r.dateText, r.contextLabel])}
          emptyMessage="No unexpected bleeding recorded in this range."
        />
      </Section>

      {data.sexualActivityContext !== null ? (
        <Section title="Sexual activity & bleeding context">
          <Table
            columns={["Date", "Context"]}
            rows={data.sexualActivityContext.map((r) => [r.dateText, r.contextLabel])}
            emptyMessage="Nothing recorded in this range."
          />
        </Section>
      ) : null}

      {data.fertility !== null ? (
        <Section title="Fertility & ovulation-test observations">
          <Table
            columns={["Date", "Details"]}
            rows={data.fertility.map((r) => [r.dateText, r.detailsText])}
            emptyMessage="Nothing recorded in this range."
          />
        </Section>
      ) : null}

      {data.medicationsAndContraception !== null ? (
        <Section title="Medications & contraception">
          {data.medicationsAndContraception.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-foreground">
              {data.medicationsAndContraception.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing recorded.</p>
          )}
        </Section>
      ) : null}

      {data.pregnancyAndLifeStage !== null ? (
        <Section title="Pregnancy & life-stage status">
          {data.pregnancyAndLifeStage.length > 0 ? (
            <ul className="list-disc pl-5 text-sm text-foreground">
              {data.pregnancyAndLifeStage.map((line, i) => (
                <li key={i}>{line}</li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted-foreground">Nothing recorded.</p>
          )}
        </Section>
      ) : null}

      <Section title="Notes">
        <Table
          columns={["Date", "Note"]}
          rows={data.notes.map((n) => [n.dateText, n.note])}
          emptyMessage="No notes in this range."
        />
      </Section>

      <footer className="mt-8 border-t border-border pt-4 text-xs text-muted-foreground">
        <p>This is a record of what was self-reported in the app — not a clinical assessment.</p>
        <p className="mt-1">{DISCLAIMER}</p>
      </footer>
    </article>
  );
}

"use client";

import { Checkbox } from "@/components/ui/checkbox";
import { Field, FieldDescription, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import type { ReportSelection } from "@/components/report/reportSelection";

export interface SelectionControlsProps {
  selection: ReportSelection;
  onChange: (next: ReportSelection) => void;
  /** SPEC.md §0: "When off: no fertility UI ... no fertility columns in exports" — the
   * fertility toggle itself must not render when the feature is disabled, not just be
   * disabled/unchecked. */
  fertilityEnabled: boolean;
}

/**
 * What to include in the report (SPEC.md's U4 brief: "Selective export: sexual-activity
 * and fertility data default to EXCLUDED — user must opt in to include them"). See
 * `components/report/reportSelection.ts`'s docstring for exactly what each toggle maps
 * to in the underlying data model.
 */
export function SelectionControls({ selection, onChange, fertilityEnabled }: SelectionControlsProps) {
  return (
    <FieldSet className="gap-3">
      <FieldLegend variant="label">What to include</FieldLegend>

      <Field orientation="horizontal">
        <Checkbox
          id="report-include-sexual-activity"
          checked={selection.includeSexualActivity}
          onCheckedChange={(checked) => onChange({ ...selection, includeSexualActivity: checked })}
        />
        <FieldLabel htmlFor="report-include-sexual-activity">
          Sexual activity &amp; bleeding context (postcoital, between-period bleeding)
        </FieldLabel>
      </Field>

      {fertilityEnabled ? (
        <Field orientation="horizontal">
          <Checkbox
            id="report-include-fertility"
            checked={selection.includeFertilityObservations}
            onCheckedChange={(checked) => onChange({ ...selection, includeFertilityObservations: checked })}
          />
          <FieldLabel htmlFor="report-include-fertility">Fertility &amp; ovulation-test observations</FieldLabel>
        </Field>
      ) : null}

      <Field orientation="horizontal">
        <Checkbox
          id="report-include-medications"
          checked={selection.includeMedicationsAndContraception}
          onCheckedChange={(checked) => onChange({ ...selection, includeMedicationsAndContraception: checked })}
        />
        <FieldLabel htmlFor="report-include-medications">Medications &amp; contraception</FieldLabel>
      </Field>

      <Field orientation="horizontal">
        <Checkbox
          id="report-include-pregnancy"
          checked={selection.includePregnancyAndLifeStage}
          onCheckedChange={(checked) => onChange({ ...selection, includePregnancyAndLifeStage: checked })}
        />
        <FieldLabel htmlFor="report-include-pregnancy">Pregnancy &amp; life-stage status</FieldLabel>
      </Field>

      <FieldDescription>
        Unexpected bleeding, periods, cycle lengths, flow, pain, symptoms and notes are always included
        in the range below.
      </FieldDescription>
    </FieldSet>
  );
}

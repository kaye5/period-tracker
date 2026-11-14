"use client";

import { isValid as isValidCivilDate, type CivilDate } from "@/lib/date/civil";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { ChipCheck } from "@/components/daylog/ChipGroup";
import { REPORT_RANGE_OPTIONS, type CustomRangeInput, type ReportRangeOption } from "@/components/report/reportRange";

export interface RangePickerProps {
  option: ReportRangeOption;
  onOptionChange: (option: ReportRangeOption) => void;
  custom: CustomRangeInput;
  onCustomChange: (custom: CustomRangeInput) => void;
  error: string | null;
}

/** SPEC.md's U4 brief: "range picker 3/6/12-month or custom range." Native
 * `<input type="date">` already emits "YYYY-MM-DD" — the exact `CivilDate` wire format —
 * so no `Date` parsing is needed here (SPEC.md R1); an invalid/empty value just clears
 * that bound rather than crashing. */
export function RangePicker({ option, onOptionChange, custom, onCustomChange, error }: RangePickerProps) {
  return (
    <FieldSet className="gap-stack">
      <FieldLegend variant="label">Report range</FieldLegend>
      <ToggleGroup
        variant="chip"
        size="chip"
        className="flex-wrap"
        aria-label="Report range"
        value={[option]}
        onValueChange={(values) => {
          const next = values[0] as ReportRangeOption | undefined;
          if (next) onOptionChange(next);
        }}
      >
        {REPORT_RANGE_OPTIONS.map((opt) => (
          <ToggleGroupItem key={opt.value} value={opt.value}>
            <ChipCheck />
            {opt.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
      {option === "custom" ? (
        <div className="flex flex-wrap items-end gap-stack">
          <Field className="w-auto">
            <FieldLabel htmlFor="report-range-start">Start date</FieldLabel>
            <Input
              id="report-range-start"
              type="date"
              value={custom.from ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onCustomChange({ ...custom, from: isValidCivilDate(v) ? (v as CivilDate) : null });
              }}
              className="h-11 tabular-nums"
            />
          </Field>
          <Field className="w-auto">
            <FieldLabel htmlFor="report-range-end">End date</FieldLabel>
            <Input
              id="report-range-end"
              type="date"
              value={custom.to ?? ""}
              onChange={(e) => {
                const v = e.target.value;
                onCustomChange({ ...custom, to: isValidCivilDate(v) ? (v as CivilDate) : null });
              }}
              className="h-11 tabular-nums"
            />
          </Field>
        </div>
      ) : null}
      {error ? (
        <p role="alert" className="text-label font-normal text-destructive">
          {error}
        </p>
      ) : null}
    </FieldSet>
  );
}

import { describe, expect, it } from "vitest";
import {
  bleedingContextSchema,
  clotSizeSchema,
  fastestProductChangeHoursSchema,
  fertilityObservationsSchema,
  flowLevelSchema,
  interferenceSchema,
  moodIdSchema,
  painSeveritySchema,
  painSiteSchema,
} from "@/lib/domain/schema";
import {
  BLEEDING_CONTEXT_OPTIONS,
  CERVICAL_MUCUS_OPTIONS,
  CLOT_SIZE_OPTIONS,
  FASTEST_CHANGE_OPTIONS,
  FLOW_LEVEL_OPTIONS,
  INTERFERENCE_OPTIONS,
  MOOD_OPTIONS,
  OPK_RESULT_OPTIONS,
  PAIN_SEVERITY_OPTIONS,
  PAIN_SITE_OPTIONS,
  PERIOD_BOUNDARY_OPTIONS,
} from "./daylogOptions";

function values<T>(options: { value: T }[]): T[] {
  return options.map((o) => o.value);
}

describe("daylogOptions — every option list is exhaustive and matches the domain schema", () => {
  it("PAIN_SEVERITY_OPTIONS covers PainSeverity", () => {
    expect(values(PAIN_SEVERITY_OPTIONS).sort()).toEqual([...painSeveritySchema.options].sort());
  });

  it("FLOW_LEVEL_OPTIONS covers FlowLevel", () => {
    expect(values(FLOW_LEVEL_OPTIONS).sort()).toEqual([...flowLevelSchema.options].sort());
  });

  it("CLOT_SIZE_OPTIONS covers ClotSize", () => {
    expect(values(CLOT_SIZE_OPTIONS).sort()).toEqual([...clotSizeSchema.options].sort());
  });

  it("FASTEST_CHANGE_OPTIONS covers every fastestProductChangeHours literal", () => {
    const schemaValues = fastestProductChangeHoursSchema.options.map((literal) => literal.value);
    expect(values(FASTEST_CHANGE_OPTIONS).sort()).toEqual([...schemaValues].sort());
  });

  it("BLEEDING_CONTEXT_OPTIONS covers BleedingContext", () => {
    expect(values(BLEEDING_CONTEXT_OPTIONS).sort()).toEqual([...bleedingContextSchema.options].sort());
  });

  it("PAIN_SITE_OPTIONS covers PainSite", () => {
    expect(values(PAIN_SITE_OPTIONS).sort()).toEqual([...painSiteSchema.options].sort());
  });

  it("INTERFERENCE_OPTIONS covers Interference", () => {
    expect(values(INTERFERENCE_OPTIONS).sort()).toEqual([...interferenceSchema.options].sort());
  });

  it("MOOD_OPTIONS covers MoodId", () => {
    expect(values(MOOD_OPTIONS).sort()).toEqual([...moodIdSchema.options].sort());
  });

  it("PERIOD_BOUNDARY_OPTIONS covers 'start'/'end'", () => {
    expect(values(PERIOD_BOUNDARY_OPTIONS).sort()).toEqual(["end", "start"]);
  });

  it("CERVICAL_MUCUS_OPTIONS covers FertilityObservations.cervicalMucus", () => {
    const schemaValues = fertilityObservationsSchema.shape.cervicalMucus.unwrap().options;
    expect(values(CERVICAL_MUCUS_OPTIONS).sort()).toEqual([...schemaValues].sort());
  });

  it("OPK_RESULT_OPTIONS covers FertilityObservations.opkResult", () => {
    const schemaValues = fertilityObservationsSchema.shape.opkResult.unwrap().options;
    expect(values(OPK_RESULT_OPTIONS).sort()).toEqual([...schemaValues].sort());
  });

  it("every option has a non-empty, human-readable label", () => {
    const all = [
      ...PAIN_SEVERITY_OPTIONS,
      ...PERIOD_BOUNDARY_OPTIONS,
      ...FLOW_LEVEL_OPTIONS,
      ...CLOT_SIZE_OPTIONS,
      ...FASTEST_CHANGE_OPTIONS,
      ...BLEEDING_CONTEXT_OPTIONS,
      ...PAIN_SITE_OPTIONS,
      ...INTERFERENCE_OPTIONS,
      ...MOOD_OPTIONS,
      ...CERVICAL_MUCUS_OPTIONS,
      ...OPK_RESULT_OPTIONS,
    ];
    for (const option of all) {
      expect(option.label.trim().length).toBeGreaterThan(0);
    }
  });
});

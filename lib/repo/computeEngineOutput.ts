/**
 * ============================================================================
 * SWAP POINT — read this before touching app/api/compute/route.ts
 * ============================================================================
 * lib/engine/index.ts (the real, pure `computeEverything`, SPEC.md §4.1) does not exist
 * yet as of this writing — it is agent I's integration-phase deliverable, built from
 * agents A-E's per-domain engine modules. Until it lands, this file is a placeholder
 * exporting a function with the IDENTICAL name and signature, so that wiring in the real
 * barrel is a one-line change in app/api/compute/route.ts:
 *
 *   - import { computeEverything } from "@/lib/repo/computeEngineOutput";
 *   + import { computeEverything } from "@/lib/engine";
 *
 * ...and then this file can be deleted. Do not add real derivation logic here — cycle
 * detection, prediction, insights, health rules, and stats all belong in lib/engine/**
 * (SPEC.md R3: pure, no I/O), not in the data layer. This function's only job is to
 * return a shape that satisfies `engineOutputSchema` so every API/UI consumer of
 * app/api/compute can be built and tested against the real response contract before the
 * engine exists.
 */
import type { CivilDate } from "@/lib/date/civil";
import type {
  CalibrationState,
  DayLog,
  EngineOutput,
  Profile,
  UserDecisions,
} from "@/lib/domain/types";
import { engineOutputSchema } from "@/lib/domain/schema";

export function computeEverything(input: {
  dayLogs: DayLog[];
  profile: Profile;
  today: CivilDate;
  decisions: UserDecisions;
  calibration: CalibrationState;
}): EngineOutput {
  const output: EngineOutput = {
    episodes: [],
    cycles: [],
    prediction: {
      kind: "none",
      center: null,
      low: null,
      high: null,
      predictedLengthDays: null,
      confidence: "not_enough_information",
      confidenceReason:
        "The prediction engine (lib/engine/index.ts) has not been wired up yet — this is placeholder data from lib/repo/computeEngineOutput.ts.",
      basis: {
        usableCycles: 0,
        windowCycles: 0,
        effectiveN: 0,
        sigma: 0,
        halfWidthDays: 0,
        calibrationFactor: input.calibration.cumulativeAdjustment,
      },
      suppressed: { reason: "insufficient_data" },
    },
    stats: {
      completedCycleCount: 0,
      typicalCycleLength: null,
      figoRange: null,
      medianCycleLengthDifference: null,
      regularityBand: null,
      periodDuration: null,
      heavyFlowDayCount: 0,
    },
    insights: [],
    healthMessages: [],
    performance: {
      lastSignedErrorDays: null,
      rollingMedianAbsoluteErrorDays: null,
      windowHitRate: null,
    },
  };
  // Validate our own output, same as any other boundary — catches a placeholder/schema
  // drift immediately instead of shipping a shape the UI can't parse.
  return engineOutputSchema.parse(output);
}

/**
 * Turns the persisted `decisions` collection's health-message dismissals
 * (`lib/repo/decisions.ts`'s `HealthMessageDecision[]`) into the
 * `HealthAwarenessState` shape `lib/engine/health.ts`'s `computeHealthMessages` reads
 * (SPEC.md §4.1: every screen reads a single `EngineOutput`; the dashboard's "Dismiss"
 * control has to round-trip through this so a dismissed message actually stays gone
 * after `router.refresh()` re-runs the whole computation from scratch).
 *
 * Deliberately does not attempt `nonUrgentShownThisCycle` bookkeeping (G9's "at most two
 * non-urgent messages per cycle" budget) — `lib/engine/health.ts`'s own doc comment on
 * `HealthAwarenessState.nonUrgentShownThisCycle` says that counter is "the caller's
 * (repo/UI layer's) responsibility... every time it actually displays a non-urgent
 * message". No repo route persists that counter yet (there is no PATCH/increment
 * endpoint for it), so this always passes `null` — the engine's own documented default,
 * meaning the per-cycle cap is not yet enforced end-to-end. Reported to the data-layer
 * agent in this agent's final report rather than invented here.
 */
import type { HealthAwarenessState } from "@/lib/engine";
import type { HealthMessageDecision } from "@/lib/repo/decisions";

export function buildHealthAwarenessState(
  decisions: readonly HealthMessageDecision[],
): HealthAwarenessState {
  const dismissals: HealthAwarenessState["dismissals"] = {};
  for (const decision of decisions) {
    if (!decision.dismissed) continue;
    dismissals[decision.ruleId as keyof HealthAwarenessState["dismissals"]] = {
      dismissedOn: decision.decidedOn,
    };
  }
  return { dismissals, nonUrgentShownThisCycle: null };
}

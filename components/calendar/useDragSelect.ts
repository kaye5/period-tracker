"use client";

import { useCallback, useEffect, useState } from "react";
import { compare, type CivilDate } from "@/lib/date/civil";

export interface DragRange {
  start: CivilDate;
  end: CivilDate;
}

function normalizeRange(a: CivilDate, b: CivilDate): DragRange {
  return compare(a, b) <= 0 ? { start: a, end: b } : { start: b, end: a };
}

/** Reads the civil date off the nearest `[data-civil-date]` ancestor of whatever DOM
 * node is under the pointer — used instead of relying on native pointerenter across
 * sibling cells, which mobile browsers can suppress once a pointer is implicitly
 * captured by the cell the gesture started on. */
function civilDateUnderPoint(x: number, y: number): CivilDate | null {
  if (typeof document === "undefined") return null;
  const el = document.elementFromPoint(x, y);
  const withDate = el?.closest("[data-civil-date]");
  const value = withDate?.getAttribute("data-civil-date");
  return value ? (value as CivilDate) : null;
}

/**
 * Press-and-drag selection of consecutive days (SPEC.md §2 / this agent's brief: "press-
 * and-drag to select several consecutive period days"). A plain tap (pointer down and up
 * on the same day, with no movement to a different cell) is deliberately left to the
 * cell's own onClick/keyboard handling — this hook only ever reports a *range*, and only
 * once the pointer has actually crossed into a second, different day, so a normal tap
 * never gets misread as a one-day "drag".
 */
export function useDragSelect() {
  const [anchor, setAnchor] = useState<CivilDate | null>(null);
  const [hover, setHover] = useState<CivilDate | null>(null);
  // State, not a ref: `previewRange` below reads it during render, and React's rules of
  // hooks forbid reading a ref's `.current` there (refs can change without triggering a
  // re-render, so a render-time read can silently show stale UI). Tracking this as state
  // instead means every cell the pointer crosses into predictably repaints.
  const [movedToAnotherCell, setMovedToAnotherCell] = useState(false);

  const beginAt = useCallback((date: CivilDate) => {
    setMovedToAnotherCell(false);
    setAnchor(date);
    setHover(date);
  }, []);

  const cancel = useCallback(() => {
    setMovedToAnotherCell(false);
    setAnchor(null);
    setHover(null);
  }, []);

  useEffect(() => {
    if (anchor === null) return;

    function onMove(event: PointerEvent) {
      const date = civilDateUnderPoint(event.clientX, event.clientY);
      if (!date) return;
      if (date !== anchor) setMovedToAnotherCell(true);
      setHover((prev) => (prev === date ? prev : date));
    }

    function onUp() {
      // Consumers read `pendingRange`/`didDrag` synchronously inside the pointerup
      // handler on the cell itself (which fires before this document listener in
      // capture order isn't guaranteed, so callers should call `resolve()` instead of
      // relying on ordering — see Calendar.tsx).
    }

    document.addEventListener("pointermove", onMove);
    document.addEventListener("pointerup", onUp);
    document.addEventListener("pointercancel", cancel);
    return () => {
      document.removeEventListener("pointermove", onMove);
      document.removeEventListener("pointerup", onUp);
      document.removeEventListener("pointercancel", cancel);
    };
  }, [anchor, cancel]);

  /** Call on pointerup. Returns the committed range if this gesture crossed into a
   * second day, or null if it was just a tap (caller should treat it as a click). Either
   * way, the in-progress selection state is cleared. */
  const resolve = useCallback((): DragRange | null => {
    const didDrag = movedToAnotherCell && anchor !== null && hover !== null && anchor !== hover;
    const result = didDrag && anchor !== null && hover !== null ? normalizeRange(anchor, hover) : null;
    cancel();
    return result;
  }, [anchor, hover, movedToAnotherCell, cancel]);

  const previewRange: DragRange | null =
    anchor !== null && hover !== null && movedToAnotherCell ? normalizeRange(anchor, hover) : null;

  return { beginAt, resolve, cancel, previewRange, isDragging: anchor !== null };
}

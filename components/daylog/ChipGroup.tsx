"use client";

/**
 * A labelled group of selectable options, built on shadcn's ToggleGroup (single-select,
 * clearable back to "not answered" unless `clearable: false`) or multi-select. Generic
 * over `T extends string | number` because DayLog's numeric enums
 * (fastestProductChangeHours: 0.5|1|2|4|8) need this exactly as much as its string enums
 * do — `ToggleGroupItem`'s `value` must be a string, so options are keyed by
 * `String(value)` and mapped back to their original typed value on change.
 *
 * Selection state is carried by Base UI's own `aria-pressed` on each toggle, so screen
 * readers get an accurate per-option state without this component adding anything extra.
 */
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { cn } from "@/lib/utils";

export interface ChipOption<T> {
  value: T;
  label: string;
}

interface ChipGroupBase<T extends string | number> {
  legend: string;
  options: ChipOption<T>[];
}

export interface SingleChipGroupProps<T extends string | number> extends ChipGroupBase<T> {
  mode: "single";
  value: T | undefined;
  onChange: (value: T | undefined) => void;
  /** Tapping the already-selected chip clears the selection back to "not answered",
   * rather than behaving like a mandatory radio group. Most day-log fields are
   * genuinely optional, so this defaults to true. */
  clearable?: boolean;
}

export interface MultiChipGroupProps<T extends string | number> extends ChipGroupBase<T> {
  mode: "multi";
  value: T[];
  onChange: (value: T[]) => void;
}

export type ChipGroupProps<T extends string | number> = SingleChipGroupProps<T> | MultiChipGroupProps<T>;

/** SPEC.md §4.5: every interactive target ≥44×44px, including chips — shadcn's Toggle
 * defaults are more compact (h-8) for dense inline use, so each chip is bumped to the
 * app's 44px minimum here rather than by editing the shared primitive. */
const CHIP_ITEM_CLASS =
  "h-11 rounded-full px-4 aria-pressed:border-primary aria-pressed:bg-primary aria-pressed:text-primary-foreground aria-pressed:hover:bg-primary";

function keyFor(value: string | number): string {
  return String(value);
}

export function ChipGroup<T extends string | number>(props: ChipGroupProps<T>) {
  const { legend, options } = props;
  const byKey = new Map<string, T>(options.map((option) => [keyFor(option.value), option.value]));

  if (props.mode === "single") {
    const { value, onChange, clearable = true } = props;
    const selectedKeys = value !== undefined ? [keyFor(value)] : [];
    return (
      <fieldset className="flex flex-col gap-2">
        <legend className="text-sm font-medium text-foreground">{legend}</legend>
        <ToggleGroup
          value={selectedKeys}
          onValueChange={(next) => {
            if (next.length === 0) {
              if (clearable) onChange(undefined);
              return;
            }
            const picked = byKey.get(next[next.length - 1]);
            if (picked !== undefined) onChange(picked);
          }}
          className="flex-wrap"
        >
          {options.map((option) => (
            <ToggleGroupItem
              key={keyFor(option.value)}
              value={keyFor(option.value)}
              variant="outline"
              className={cn(CHIP_ITEM_CLASS)}
            >
              {option.label}
            </ToggleGroupItem>
          ))}
        </ToggleGroup>
      </fieldset>
    );
  }

  const { value, onChange } = props;
  const selectedKeys = value.map(keyFor);
  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-foreground">{legend}</legend>
      <ToggleGroup
        value={selectedKeys}
        multiple
        onValueChange={(next) => {
          onChange(next.map((key) => byKey.get(key)).filter((v): v is T => v !== undefined));
        }}
        className="flex-wrap"
      >
        {options.map((option) => (
          <ToggleGroupItem
            key={keyFor(option.value)}
            value={keyFor(option.value)}
            variant="outline"
            className={cn(CHIP_ITEM_CLASS)}
          >
            {option.label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </fieldset>
  );
}

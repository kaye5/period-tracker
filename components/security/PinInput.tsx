"use client";

/**
 * A 6-digit PIN entry field: six visible cells backed by a single transparent, fully
 * accessible `<input>` that captures the keystrokes. Clicking anywhere in the row focuses
 * the input; the cell where the next digit will land shows a focus ring.
 *
 * Digits only (non-digits are stripped on input); `onComplete` fires when the sixth digit
 * is entered. Masked by default (shows dots), since this gates the app's screens.
 */
import { useId } from "react";
import { cn } from "@/lib/utils";

export const PIN_LENGTH = 6;

interface PinInputProps {
  value: string;
  onChange: (value: string) => void;
  onComplete?: (value: string) => void;
  /** Accessible label for the underlying input (there is no visible <label>). */
  label: string;
  id?: string;
  disabled?: boolean;
  autoFocus?: boolean;
  invalid?: boolean;
  /** Show dots instead of digits. Default true. */
  mask?: boolean;
}

export function PinInput({
  value,
  onChange,
  onComplete,
  label,
  id,
  disabled,
  autoFocus,
  invalid,
  mask = true,
}: PinInputProps) {
  const autoId = useId();
  const inputId = id ?? autoId;

  function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = e.target.value.replace(/\D/g, "").slice(0, PIN_LENGTH);
    onChange(next);
    if (next.length === PIN_LENGTH) onComplete?.(next);
  }

  return (
    <div className="relative mx-auto w-fit">
      <input
        id={inputId}
        aria-label={label}
        aria-invalid={invalid || undefined}
        inputMode="numeric"
        autoComplete="one-time-code"
        pattern="\d*"
        maxLength={PIN_LENGTH}
        value={value}
        onChange={handleChange}
        disabled={disabled}
        autoFocus={autoFocus}
        // Transparent overlay so a click anywhere in the row focuses this real input; it
        // is the `peer` the cells key their focus ring off of.
        className="peer absolute inset-0 z-10 h-full w-full cursor-pointer text-transparent caret-transparent opacity-0 outline-none disabled:cursor-not-allowed"
      />
      <div className="flex justify-center gap-2 sm:gap-3" aria-hidden>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => {
          const filled = i < value.length;
          const isNext = i === Math.min(value.length, PIN_LENGTH - 1);
          return (
            <div
              key={i}
              className={cn(
                "flex size-11 items-center justify-center rounded-md border border-input bg-transparent text-2xl leading-none tabular-nums transition-colors sm:size-12",
                filled ? "text-foreground" : "text-muted-foreground",
                invalid && "border-destructive",
                disabled && "opacity-60",
                isNext && "peer-focus-visible:border-ring peer-focus-visible:ring-[3px] peer-focus-visible:ring-ring/50",
              )}
            >
              {filled ? (mask ? "•" : value[i]) : ""}
            </div>
          );
        })}
      </div>
    </div>
  );
}

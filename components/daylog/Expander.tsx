"use client";

import { useState, type ReactNode } from "react";
import { ChevronDown } from "lucide-react";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { cn } from "@/lib/utils";

export interface ExpanderProps {
  title: string;
  children: ReactNode;
  defaultOpen?: boolean;
}

/**
 * Progressive-disclosure section for everything the day log form doesn't put at the top
 * level (SPEC.md U3 brief: "bleeding and flow first, everything else behind
 * expanders"). Built on shadcn's Collapsible (Base UI) — keyboard-operable and exposes
 * open/closed state to assistive tech via `aria-expanded` on the trigger, same guarantee
 * the previous native `<details>` implementation gave for free.
 */
export function Expander({ title, children, defaultOpen = false }: ExpanderProps) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <Collapsible open={open} onOpenChange={setOpen} className="rounded-2xl border border-border bg-card">
      <CollapsibleTrigger className="flex h-11 w-full items-center justify-between px-4 text-sm font-medium text-foreground">
        <span>{title}</span>
        <ChevronDown
          aria-hidden="true"
          size={16}
          className={cn("text-muted-foreground transition-transform", open && "rotate-180")}
        />
      </CollapsibleTrigger>
      <CollapsibleContent className="flex flex-col gap-4 px-4 pb-4 pt-1">{children}</CollapsibleContent>
    </Collapsible>
  );
}

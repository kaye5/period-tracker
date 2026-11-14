import { clsx, type ClassValue } from "clsx"
import { extendTailwindMerge } from "tailwind-merge"

// Teach tailwind-merge the app's own theme tokens (app/globals.css @theme). Without this
// it reads `text-body` as a text COLOUR and silently drops a component's `text-*-foreground`
// when both are passed — which left the primary button's label invisible.
const twMerge = extendTailwindMerge({
  extend: {
    theme: {
      text: ["display", "title", "heading", "body", "label", "caption"],
      spacing: ["gutter", "stack", "card", "section", "chip", "quicklog", "cal", "nav"],
      radius: ["stage"],
      shadow: ["float"],
    },
  },
})

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

import type { Metadata } from "next";
import "./globals.css";
import { AppNav } from "@/components/nav/AppNav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { DayLogDialogProvider } from "@/components/daylog/DayLogDialogProvider";

// Deliberately NOT using next/font/google (or any remote font): SPEC.md §0.1 requires
// this app load no font, script, or image from a remote origin. app/globals.css's
// --font-sans/--font-mono tokens are a system-font stack instead.

export const metadata: Metadata = {
  title: "Period Tracker",
  // SPEC.md §0.1 / docs/PRIVACY.md: no user-facing string may claim the app is
  // private, local-only, secure, or encrypted. Data is stored in a SQL database whose
  // location depends on DATABASE_URL (DEC-011/DEC-012), so no "private, local-only"
  // framing is made — it would be both unprovable and forbidden. This description makes
  // no privacy or storage-location claim.
  description:
    "A menstrual cycle tracker. Predictions are shown as ranges, not single dates.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full antialiased">
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <TooltipProvider>
          <DayLogDialogProvider>
            <div className="flex flex-1 flex-col">{children}</div>
            <AppNav />
          </DayLogDialogProvider>
        </TooltipProvider>
        <Toaster />
      </body>
    </html>
  );
}

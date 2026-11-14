import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import { AppNav } from "@/components/nav/AppNav";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { DayLogDialogProvider } from "@/components/daylog/DayLogDialogProvider";
import { MotionProvider } from "@/components/providers/MotionProvider";

// Manrope is self-hosted (app/fonts, OFL) through next/font/local — never next/font/google
// or any remote font: SPEC.md §0.1 requires this app load no font, script, or image from a
// remote origin (no-remote-origin.test.ts enforces it).
const manrope = localFont({
  src: "./fonts/Manrope-latin-wght.woff2",
  weight: "200 800",
  variable: "--font-manrope",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Period Tracker",
  // SPEC.md §0.1 / docs/PRIVACY.md: no user-facing string may claim the app is
  // private, local-only, secure, or encrypted. Data is stored in a SQL database whose
  // location depends on DATABASE_URL (DEC-011/DEC-012), so no "private, local-only"
  // framing is made — it would be both unprovable and forbidden. This description makes
  // no privacy or storage-location claim.
  description:
    "A menstrual cycle tracker. Predictions are shown as ranges, not single dates.",
  robots: {
    index: false,
    follow: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${manrope.variable} h-full antialiased`}>
      <body className="min-h-full flex flex-col bg-background text-foreground">
        <MotionProvider>
          <TooltipProvider>
            <DayLogDialogProvider>
              <div className="flex flex-1 flex-col">{children}</div>
              <AppNav />
            </DayLogDialogProvider>
          </TooltipProvider>
        </MotionProvider>
        <Toaster />
      </body>
    </html>
  );
}

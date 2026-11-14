import type { MetadataRoute } from "next";

/**
 * Web app manifest — makes the app installable ("Add to Home Screen"). Install-only: there
 * is no service worker and nothing is cached offline, so no health data is stored on the
 * device by this (see docs/PRIVACY.md before ever adding one).
 *
 * The name is deliberately neutral: it is the label under the icon on a home screen. The
 * icon is the cycle loop (logged period arc, today's dot, the rest of the cycle dashed as
 * an estimate), drawn inside the maskable safe zone so one file serves both purposes.
 * Colours are the Daylight background tokens (app/globals.css: --neutral-50).
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Cycle",
    short_name: "Cycle",
    description: "A menstrual cycle tracker. Predictions are shown as ranges, not single dates.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    background_color: "#f5f6f8",
    theme_color: "#f5f6f8",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/icons/icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
    ],
  };
}

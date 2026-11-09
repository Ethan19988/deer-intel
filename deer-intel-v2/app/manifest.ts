import type { MetadataRoute } from "next";

// The web app manifest that makes Deer Intel installable to a phone's home
// screen and launchable standalone (no browser chrome) — the other half of
// working in the field: paired with the service worker, the app itself loads
// with no signal, and the downloaded map tiles render inside it.
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Deer Intel",
    short_name: "Deer Intel",
    description:
      "Hunting property, map, camera, and hunt log — works offline in the field.",
    id: "/",
    start_url: "/",
    scope: "/",
    display: "standalone",
    // Match the dark tokens (--bg in globals.css, viewport themeColor in the
    // layout) so the splash screen and status bar don't flash light/green.
    background_color: "#0b0d0b",
    theme_color: "#0b0d0b",
    orientation: "portrait",
    categories: ["sports", "navigation", "utilities"],
    icons: [
      { src: "/icons/icon-192.png?v=2", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "any" },
      // Android crops maskable icons to a circle, so this copy draws the buck
      // smaller to keep the rack inside the safe zone.
      { src: "/icons/icon-maskable-512.png?v=2", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

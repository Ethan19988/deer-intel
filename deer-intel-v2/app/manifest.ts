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
    background_color: "#f6f4ec",
    theme_color: "#2f7d43",
    orientation: "portrait",
    categories: ["sports", "navigation", "utilities"],
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      // The mark sits in the maskable safe zone, so the same art doubles as
      // the maskable icon Android needs.
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}

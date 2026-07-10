"use client";

import { useEffect } from "react";

// Registers the service worker that lets the app cold-start offline. Kept as a
// tiny client component so it can live in the root layout without making the
// layout itself a client component.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    const register = () => {
      navigator.serviceWorker.register("/sw.js").catch(() => {
        // A failed registration just means no offline app shell — the app
        // still works normally online, so this is non-fatal.
      });
    };

    if (document.readyState === "complete") {
      register();
      return;
    }

    window.addEventListener("load", register, { once: true });
    return () => window.removeEventListener("load", register);
  }, []);

  return null;
}

"use client";

import { useEffect } from "react";

// Registers the service worker that lets the app cold-start offline, and makes
// sure a returning device picks up a newly deployed version instead of getting
// stuck on the cached one. Kept as a tiny client component so it can live in the
// root layout without making the layout itself a client component.
export default function ServiceWorkerRegistration() {
  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    let reloading = false;
    // If a worker was already controlling this page, a controller change means a
    // newer version just activated — reload once so the page runs the fresh
    // bundle. (Skipped on the very first install, where there was no controller.)
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (reloading || !hadController) return;
      // Reload at most once per tab session, so a misfire can never loop.
      try {
        if (sessionStorage.getItem("di-sw-reloaded")) return;
        sessionStorage.setItem("di-sw-reloaded", "1");
      } catch {
        // sessionStorage unavailable — the `reloading` flag still guards.
      }
      reloading = true;
      window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for a newer worker now and whenever the tab regains focus, so
          // fresh deploys roll out without a manual cache clear.
          registration.update().catch(() => undefined);

          const checkForUpdate = () => registration.update().catch(() => undefined);
          document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "visible") checkForUpdate();
          });
        })
        .catch(() => {
          // A failed registration just means no offline app shell — the app
          // still works normally online, so this is non-fatal.
        });
    };

    if (document.readyState === "complete") {
      register();
    } else {
      window.addEventListener("load", register, { once: true });
    }

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      window.removeEventListener("load", register);
    };
  }, []);

  return null;
}

"use client";

import { useEffect, useState, type CSSProperties } from "react";
import {
  OFFLINE_DOWNLOAD_CHANGE_EVENT,
  isOfflineDownloadRunning,
} from "@/lib/offlineMaps";

// Registers the service worker that lets the app cold-start offline, and lets a
// returning device pick up a newly deployed version instead of getting stuck on
// the cached one. Kept as a tiny client component so it can live in the root
// layout without making the layout itself a client component.
//
// A new version never reloads the page on its own: a reload in the middle of an
// offline-map download kills it, and one mid-drawing loses the outline. Instead
// a small "Update ready" prompt appears and the hunter taps it when it suits
// them — and even that waits while a download is running.
export default function ServiceWorkerRegistration() {
  const [updateReady, setUpdateReady] = useState(false);
  const [downloadRunning, setDownloadRunning] = useState(false);

  useEffect(() => {
    if (
      typeof navigator === "undefined" ||
      !("serviceWorker" in navigator)
    ) {
      return;
    }

    // If a worker was already controlling this page, a controller change means
    // a newer version just activated. (Skipped on the very first install, where
    // there was no controller and the page is already the fresh bundle.)
    const hadController = Boolean(navigator.serviceWorker.controller);
    const onControllerChange = () => {
      if (hadController) setUpdateReady(true);
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      onControllerChange,
    );

    const checkForUpdate = (registration: ServiceWorkerRegistration) =>
      registration.update().catch(() => undefined);
    let onVisible: (() => void) | null = null;

    const register = () => {
      navigator.serviceWorker
        .register("/sw.js")
        .then((registration) => {
          // Check for a newer worker now and whenever the tab regains focus, so
          // fresh deploys roll out without a manual cache clear.
          checkForUpdate(registration);
          onVisible = () => {
            if (document.visibilityState === "visible") checkForUpdate(registration);
          };
          document.addEventListener("visibilitychange", onVisible);
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

    const onDownloadChange = () => setDownloadRunning(isOfflineDownloadRunning());
    onDownloadChange();
    window.addEventListener(OFFLINE_DOWNLOAD_CHANGE_EVENT, onDownloadChange);

    return () => {
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        onControllerChange,
      );
      window.removeEventListener("load", register);
      window.removeEventListener(OFFLINE_DOWNLOAD_CHANGE_EVENT, onDownloadChange);
      if (onVisible) document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  if (!updateReady) return null;

  const refresh = () => {
    // Re-checked at tap time: a download may have started since render.
    if (isOfflineDownloadRunning()) {
      setDownloadRunning(true);
      return;
    }
    window.location.reload();
  };

  return (
    <div className="di-update-prompt" style={wrapStyle} role="status" aria-live="polite">
      <button
        type="button"
        style={downloadRunning ? { ...buttonStyle, ...waitingStyle } : buttonStyle}
        onClick={refresh}
        disabled={downloadRunning}
      >
        <span style={dotStyle} aria-hidden="true" />
        <span style={labelStyle}>
          {downloadRunning
            ? "Update ready — after your map download"
            : "Update ready — tap to refresh"}
        </span>
      </button>
      <button
        type="button"
        style={dismissStyle}
        onClick={() => setUpdateReady(false)}
        aria-label="Dismiss update notice"
      >
        ×
      </button>
    </div>
  );
}

// Sits above the mobile tab bar (≈4.4rem tall plus the home-indicator inset)
// and centred, narrow enough to leave the map controls at the edges usable.
const wrapStyle: CSSProperties = {
  position: "fixed",
  left: "50%",
  bottom: "calc(5.25rem + env(safe-area-inset-bottom))",
  transform: "translateX(-50%)",
  zIndex: 2300,
  display: "flex",
  alignItems: "stretch",
  maxWidth: "calc(100vw - 2rem)",
  border: "1px solid var(--accent-2-tint-border)",
  borderRadius: "var(--radius)",
  background: "var(--surface)",
  boxShadow: "var(--shadow-md)",
  overflow: "hidden",
};

const buttonStyle: CSSProperties = {
  display: "flex",
  alignItems: "center",
  gap: "0.5rem",
  minHeight: "44px",
  padding: "0.45rem 0.8rem",
  border: 0,
  background: "transparent",
  color: "var(--text)",
  cursor: "pointer",
  textAlign: "left",
};

const waitingStyle: CSSProperties = {
  cursor: "default",
  color: "var(--text-muted)",
};

const dotStyle: CSSProperties = {
  flex: "none",
  width: "8px",
  height: "8px",
  borderRadius: "999px",
  background: "var(--accent-2)",
};

const labelStyle: CSSProperties = {
  fontFamily: "var(--font-geist-mono), ui-monospace, monospace",
  fontSize: "0.72rem",
  letterSpacing: "0.06em",
  textTransform: "uppercase",
};

const dismissStyle: CSSProperties = {
  minWidth: "44px",
  border: 0,
  borderLeft: "1px solid var(--border)",
  background: "transparent",
  color: "var(--text-muted)",
  cursor: "pointer",
  fontSize: "1.1rem",
};

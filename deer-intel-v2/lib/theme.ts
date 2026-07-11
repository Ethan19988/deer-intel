"use client";

import { useSyncExternalStore } from "react";

// Theme is a device-local preference (a hunter may want dark on the phone in
// the field but light on the desktop), so it lives in its own localStorage key
// and is intentionally kept out of the synced DeerIntelState.
export type ThemePreference = "light" | "dark" | "night" | "auto";
export type ResolvedTheme = "light" | "dark" | "night";

export const THEME_STORAGE_KEY = "deer-intel:theme";

export const THEME_PREFERENCES: ThemePreference[] = [
  "light",
  "dark",
  "night",
  "auto",
];

export const THEME_LABELS: Record<ThemePreference, string> = {
  light: "Light",
  dark: "Dark",
  night: "Night",
  auto: "Auto",
};

export const THEME_DESCRIPTIONS: Record<ThemePreference, string> = {
  light: "Bright field theme for daylight.",
  dark: "Dim theme for low-light rooms and blinds.",
  night: "Red-on-black to protect your night vision before dawn.",
  auto: "Follow your device's light or dark setting.",
};

function isThemePreference(value: unknown): value is ThemePreference {
  return (
    value === "light" ||
    value === "dark" ||
    value === "night" ||
    value === "auto"
  );
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return "light";

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : "light";
  } catch {
    return "light";
  }
}

function prefersDark(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia?.("(prefers-color-scheme: dark)").matches === true
  );
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  if (preference === "auto") return prefersDark() ? "dark" : "light";
  return preference;
}

export function applyTheme(preference: ThemePreference): void {
  if (typeof document === "undefined") return;
  document.documentElement.dataset.theme = resolveTheme(preference);
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setThemePreference(preference: ThemePreference): void {
  try {
    window.localStorage.setItem(THEME_STORAGE_KEY, preference);
  } catch {
    // Ignore write failures (private mode / quota); the applied theme below
    // still takes effect for this session.
  }

  applyTheme(preference);
  notifyListeners();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  const media =
    typeof window !== "undefined" && window.matchMedia
      ? window.matchMedia("(prefers-color-scheme: dark)")
      : null;

  // In "auto" mode the resolved theme tracks the OS setting, so reapply when it
  // flips (e.g. the phone crosses into its night schedule).
  function handleMedia() {
    if (readThemePreference() === "auto") {
      applyTheme("auto");
      notifyListeners();
    }
  }

  // Keep other tabs/windows in step when the preference changes.
  function handleStorage(event: StorageEvent) {
    if (event.key !== THEME_STORAGE_KEY && event.key !== null) return;
    applyTheme(readThemePreference());
    notifyListeners();
  }

  media?.addEventListener?.("change", handleMedia);
  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    media?.removeEventListener?.("change", handleMedia);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): ThemePreference {
  return readThemePreference();
}

function getServerSnapshot(): ThemePreference {
  return "light";
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

"use client";

import { useSyncExternalStore } from "react";

// Theme is a device-local preference (a hunter may want dark on the phone in
// the field but light on the desktop), so it lives in its own localStorage key
// and is intentionally kept out of the synced DeerIntelState.
export type ThemePreference = "daylight" | "light" | "dark" | "night" | "auto";
export type ResolvedTheme = "light" | "dark" | "night";

export const THEME_STORAGE_KEY = "deer-intel:theme";

export const THEME_PREFERENCES: ThemePreference[] = [
  "daylight",
  "light",
  "dark",
  "night",
  "auto",
];

export const THEME_LABELS: Record<ThemePreference, string> = {
  daylight: "Follow daylight",
  light: "Light",
  dark: "Dark",
  night: "Night",
  auto: "Auto",
};

export const THEME_DESCRIPTIONS: Record<ThemePreference, string> = {
  daylight:
    "Light at midday for scouting, dark from mid-afternoon through dawn when you're in the stand.",
  light: "Bright field theme for daylight.",
  dark: "The default field theme: dark and easy on the eyes in the woods.",
  night: "Red-on-black to protect your night vision before dawn.",
  auto: "Follow your device's light or dark setting.",
};

// The default for anyone who hasn't picked a theme.
export const DEFAULT_THEME_PREFERENCE: ThemePreference = "dark";

// "Follow daylight": light in the middle of the day (good in bright sun), dark
// around the hunting windows (protects dark adaptation, and photos and maps
// look richer). Light runs from an hour after sunrise to 2.5 h before sunset.
export const SUN_STORAGE_KEY = "deer-intel:sun";
const LIGHT_AFTER_SUNRISE_MIN = 60;
const DARK_BEFORE_SUNSET_MIN = 150;
// Typical fall sunrise/sunset in Pennsylvania, used until a forecast has
// saved real times for the property.
const FALLBACK_SUN = { sunriseMin: 7 * 60 + 15, sunsetMin: 18 * 60 + 15 };

export type SunMinutes = { sunriseMin: number; sunsetMin: number };

/** Pure: which theme "Follow daylight" shows at a minute of the day. */
export function resolveDaylightTheme(
  minuteOfDay: number,
  sun: SunMinutes = FALLBACK_SUN,
): "light" | "dark" {
  const lightFrom = sun.sunriseMin + LIGHT_AFTER_SUNRISE_MIN;
  const lightUntil = sun.sunsetMin - DARK_BEFORE_SUNSET_MIN;
  return minuteOfDay >= lightFrom && minuteOfDay < lightUntil ? "light" : "dark";
}

function readSun(): SunMinutes {
  try {
    const parsed = JSON.parse(window.localStorage.getItem(SUN_STORAGE_KEY) ?? "null");
    if (
      parsed &&
      Number.isFinite(parsed.sunriseMin) &&
      Number.isFinite(parsed.sunsetMin)
    ) {
      return { sunriseMin: parsed.sunriseMin, sunsetMin: parsed.sunsetMin };
    }
  } catch {
    // Fall through to typical times.
  }
  return FALLBACK_SUN;
}

/**
 * Save today's sunrise/sunset ("YYYY-MM-DDTHH:MM" local) so "Follow daylight"
 * tracks the real day length at the property. Re-applies the theme if needed.
 */
export function rememberSunTimes(
  sunriseIso: string | undefined,
  sunsetIso: string | undefined,
): void {
  const toMinutes = (iso: string | undefined) => {
    const [h, m] = (iso?.split("T")[1] ?? "").split(":").map(Number);
    return Number.isFinite(h) && Number.isFinite(m) ? h * 60 + m : null;
  };
  const sunriseMin = toMinutes(sunriseIso);
  const sunsetMin = toMinutes(sunsetIso);
  if (sunriseMin === null || sunsetMin === null) return;

  try {
    window.localStorage.setItem(
      SUN_STORAGE_KEY,
      JSON.stringify({ sunriseMin, sunsetMin }),
    );
  } catch {
    return;
  }
  if (readThemePreference() === "daylight") applyTheme("daylight");
}

function isThemePreference(value: unknown): value is ThemePreference {
  return (
    value === "daylight" ||
    value === "light" ||
    value === "dark" ||
    value === "night" ||
    value === "auto"
  );
}

export function readThemePreference(): ThemePreference {
  if (typeof window === "undefined") return DEFAULT_THEME_PREFERENCE;

  try {
    const raw = window.localStorage.getItem(THEME_STORAGE_KEY);
    return isThemePreference(raw) ? raw : DEFAULT_THEME_PREFERENCE;
  } catch {
    return DEFAULT_THEME_PREFERENCE;
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
  if (preference === "daylight") {
    const now = new Date();
    return resolveDaylightTheme(now.getHours() * 60 + now.getMinutes(), readSun());
  }
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
  return DEFAULT_THEME_PREFERENCE;
}

export function useThemePreference(): ThemePreference {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

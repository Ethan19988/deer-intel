import type { LiveForecast } from "@/lib/liveWeather";

// The last forecast fetched for a spot, kept on this device so Today can show
// its verdict the moment it opens instead of a blank "Reading the wind" card
// while Open-Meteo answers. The fresh fetch then replaces it. Only a recent
// snapshot from the same day is used, so a stale wind never leads a sit pick.

const KEY = "deer-intel:forecast-snapshot";
export const SNAPSHOT_MAX_AGE_MS = 3 * 60 * 60 * 1000;

type Stored = { key: string; savedAt: number; day: string; forecast: LiveForecast };

function localDay(ms: number): string {
  const date = new Date(ms);
  return `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
}

export function readForecastSnapshot(key: string, nowMs = Date.now()): LiveForecast | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (stored.key !== key) return null;
    if (nowMs - stored.savedAt > SNAPSHOT_MAX_AGE_MS) return null;
    if (stored.day !== localDay(nowMs)) return null;
    return stored.forecast ?? null;
  } catch {
    return null;
  }
}

export function writeForecastSnapshot(key: string, forecast: LiveForecast, nowMs = Date.now()) {
  try {
    const stored: Stored = { key, savedAt: nowMs, day: localDay(nowMs), forecast };
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: Today just waits for the live forecast.
  }
}

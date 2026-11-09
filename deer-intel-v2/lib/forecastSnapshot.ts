import type { LiveForecast } from "@/lib/liveWeather";

// The last forecast fetched for a spot, kept on this device so Today can show
// its verdict the moment it opens instead of a blank "Reading the wind" card
// while Open-Meteo answers, and so the stand call survives a sit with no
// signal. The fresh fetch replaces it whenever one gets through.
//
// A snapshot stays usable until the end of the last day its forecast covers
// (days that have already passed are dropped, so "today" is always days[0]).
// A forecast with no day list falls back to a flat age cap.

const KEY = "deer-intel:forecast-snapshot";
/** Age cap for a snapshot whose forecast has no day list to expire by. */
export const SNAPSHOT_MAX_AGE_MS = 48 * 60 * 60 * 1000;
/** Older than this, Today notes when the forecast it's using was fetched. */
export const FORECAST_AS_OF_AFTER_MS = 60 * 60 * 1000;

type Stored = { key: string; savedAt: number; day?: string; forecast: LiveForecast };

export type ForecastSnapshot = { forecast: LiveForecast; savedAt: number };

/**
 * The snapshot key for a spot and the units its numbers are in — the same
 * `lat,lng|temp|wind` shape usePropertyToday reads, so a forecast saved by the
 * field pack is the one Today and the map pick up offline.
 */
export function forecastSnapshotKey(
  point: { lat: number; lng: number },
  units: { temperature: string; wind: string },
): string {
  return `${point.lat},${point.lng}|${units.temperature}|${units.wind}`;
}

function localDateKey(ms: number): string {
  const date = new Date(ms);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

/** Swap the date part of an Open-Meteo local time, keeping its clock time. */
function withDate(iso: string | undefined, date: string): string | undefined {
  if (!iso) return iso;
  const tIndex = iso.indexOf("T");
  return tIndex === -1 ? date : `${date}${iso.slice(tIndex)}`;
}

/**
 * The part of a saved forecast that still applies at `nowMs`, or null once it
 * has run out: past the end of its last day, or (with no day list) older than
 * SNAPSHOT_MAX_AGE_MS. Days before today are dropped so days[0] is today, and
 * today's sunrise/sunset come from the first kept day (its own times when
 * saved, else the old clock times on its date — sun times move a minute or
 * two a day). Returns the same object when nothing has rolled over.
 */
export function usableForecast(
  forecast: LiveForecast | null | undefined,
  savedAt: number,
  nowMs: number,
): LiveForecast | null {
  if (!forecast) return null;
  const days = Array.isArray(forecast.days) ? forecast.days : [];
  if (days.length === 0) {
    return nowMs - savedAt > SNAPSHOT_MAX_AGE_MS ? null : forecast;
  }

  const today = localDateKey(nowMs);
  // "YYYY-MM-DD" strings compare in date order.
  const firstCurrent = days.findIndex((day) => day.date >= today);
  if (firstCurrent === -1) return null;
  if (firstCurrent === 0) return forecast;

  const kept = days.slice(firstCurrent);
  const rolled: LiveForecast = {
    ...forecast,
    days: kept,
    // The kept day's own sun times when the snapshot has them; otherwise the
    // old clock times moved onto its date.
    sunriseIso: kept[0].sunriseIso ?? withDate(forecast.sunriseIso, kept[0].date),
    sunsetIso: kept[0].sunsetIso ?? withDate(forecast.sunsetIso, kept[0].date),
  };
  // The saved UTC offset was right on the day it was fetched, not necessarily
  // on the kept day (a DST change in between). With the IANA zone the times
  // are read per date anyway; without it, the device's own zone is the better
  // guess than a possibly stale offset.
  if (!forecast.timezone) delete rolled.utcOffsetSeconds;
  return rolled;
}

/** The saved forecast for this spot plus when it was fetched, while usable. */
export function readForecastSnapshotEntry(
  key: string,
  nowMs = Date.now(),
): ForecastSnapshot | null {
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const stored = JSON.parse(raw) as Stored;
    if (stored.key !== key || typeof stored.savedAt !== "number") return null;
    const forecast = usableForecast(stored.forecast, stored.savedAt, nowMs);
    return forecast ? { forecast, savedAt: stored.savedAt } : null;
  } catch {
    return null;
  }
}

export function readForecastSnapshot(key: string, nowMs = Date.now()): LiveForecast | null {
  return readForecastSnapshotEntry(key, nowMs)?.forecast ?? null;
}

export function writeForecastSnapshot(key: string, forecast: LiveForecast, nowMs = Date.now()) {
  try {
    const stored: Stored = { key, savedAt: nowMs, day: localDateKey(nowMs), forecast };
    window.localStorage.setItem(KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: Today just waits for the live forecast.
  }
}

/**
 * "Forecast as of 6:12 AM" (with the weekday when it's from another day) when
 * the forecast in use came from the saved snapshot or is over an hour old;
 * null when it's fresh from a live fetch.
 */
export function forecastAsOfLabel(
  savedAt: number,
  nowMs: number,
  fromSnapshot: boolean,
): string | null {
  // Only when it's old enough to matter: a fresh saved copy (shown for a
  // moment while the live forecast loads) shouldn't flash a stamp on screen.
  void fromSnapshot;
  if (nowMs - savedAt <= FORECAST_AS_OF_AFTER_MS) return null;
  const saved = new Date(savedAt);
  // Newer ICU puts a narrow no-break space before AM/PM; keep a plain space.
  const time = saved
    .toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" })
    .replace(/\s/g, " ");
  const sameDay = localDateKey(savedAt) === localDateKey(nowMs);
  const day = sameDay ? "" : `${saved.toLocaleDateString("en-US", { weekday: "short" })} `;
  return `Forecast as of ${day}${time}`;
}

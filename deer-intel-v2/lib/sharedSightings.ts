import type { SupabaseClient } from "@supabase/supabase-js";
import type { HourlyActivity } from "@/lib/hourlyActivity";
import { isBuckRecord, isTimedDeerPhoto } from "@/lib/hourlyActivity";
import { toFahrenheit, toMph } from "@/lib/movementModel";
import { lookupPaCountyAtPoint } from "@/lib/parcelLookup";
import { photoRecordTime } from "@/lib/photos";
import type { RutPhase } from "@/lib/seasonCalendar";
import type { PhotoRecord } from "@/types/photo";

// Opt-in shared movement learning. When an account turns on "Share anonymous
// sightings", each timed deer photo is reduced to region + date + hour + buck
// flag + weather/rut context and added to a shared pool. Regional hourly
// totals come back once enough hunters contribute (enforced in
// supabase/shared-sightings.sql). Photos, names, notes, and GPS never leave
// the device.

const TABLE = "movement_sightings";
const CONSENT_PREFIX = "deer-intel:share-sightings:";
const SENT_PREFIX = "deer-intel:shared-keys:";
const REGION_CACHE_KEY = "deer-intel:region-cache";
const CHUNK = 500;

export type SharingChoice = "on" | "off" | "unasked";

export type SightingRow = {
  source_key: string;
  region: string;
  sighting_date: string;
  hour: number;
  is_buck: boolean;
  temp_f: number | null;
  wind_mph: number | null;
  pressure_trend: string | null;
  rut_phase: string | null;
};

export type RegionalActivity = HourlyActivity & { contributors: number; regionLabel: string };

// --- Consent (per account, on this device) --------------------------------------

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function safeSet(key: string, value: string) {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    // Private mode or full storage: the choice holds for this session only.
  }
}

export function readSharingChoice(userId: string): SharingChoice {
  const value = safeGet(CONSENT_PREFIX + userId);
  return value === "on" || value === "off" ? value : "unasked";
}

export function writeSharingChoice(userId: string, choice: "on" | "off") {
  safeSet(CONSENT_PREFIX + userId, choice);
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent("deer-intel:sharing-changed"));
  }
}

// --- Pure helpers -----------------------------------------------------------------

/** One-way FNV-1a hash so the shared row can't be traced back to a photo id. */
export function hashKey(value: string): string {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash.toString(16).padStart(8, "0");
}

/** ~30-mile grid square, used outside Pennsylvania (no county lookup there). */
export function gridRegion(lat: number, lng: number): string {
  const snap = (v: number) => (Math.floor(v * 2) / 2).toFixed(1);
  return `grid:${snap(lat)},${snap(lng)}`;
}

export function regionLabel(region: string): string {
  if (region.startsWith("PA:")) return `${region.slice(3)} County`;
  return "your area";
}

/** Reduce timed deer photos to anonymous rows for one property's region. */
export function buildSightingRows(
  photos: PhotoRecord[],
  region: string,
  rutPhaseFor: (date: Date) => RutPhase | undefined,
): SightingRow[] {
  return photos.filter(isTimedDeerPhoto).flatMap((photo) => {
    const time = photoRecordTime(photo);
    if (!time) return [];
    const when = new Date(time);
    const month = String(when.getMonth() + 1).padStart(2, "0");
    const day = String(when.getDate()).padStart(2, "0");
    const weather = photo.weatherSnapshot;

    return [
      {
        source_key: hashKey(photo.id),
        region,
        sighting_date: `${when.getFullYear()}-${month}-${day}`,
        hour: when.getHours(),
        is_buck: isBuckRecord(photo),
        temp_f: weather ? toFahrenheit(weather.temperature, "F") : null,
        wind_mph: weather ? toMph(weather.windSpeed) : null,
        pressure_trend: null,
        rut_phase: rutPhaseFor(when) ?? null,
      },
    ];
  });
}

/** Turn regional_movement() rows into the chart's activity shape. */
export function toRegionalActivity(
  rows: Array<{ hour: number; sightings: number; bucks: number; contributors: number }>,
  region: string,
  windowDays: number,
): RegionalActivity | null {
  if (rows.length === 0) return null;
  const counts = new Array(24).fill(0);
  const bucks = new Array(24).fill(0);
  let contributors = 0;
  for (const row of rows) {
    if (row.hour < 0 || row.hour > 23) continue;
    counts[row.hour] = row.sightings;
    bucks[row.hour] = row.bucks;
    contributors = row.contributors;
  }
  const total = counts.reduce((a, b) => a + b, 0);
  let peakStartHour: number | null = null;
  let best = -1;
  for (let hour = 0; hour < 24; hour += 1) {
    const pair = counts[hour] + counts[(hour + 1) % 24];
    if (pair > best) {
      best = pair;
      peakStartHour = hour;
    }
  }
  return {
    counts,
    bucks,
    total,
    peakStartHour,
    windowDays,
    contributors,
    regionLabel: regionLabel(region),
  };
}

// --- Network ----------------------------------------------------------------------

/** PA county for a point (cached), or a grid square outside PA / when offline. */
export async function regionForPoint(lat: number, lng: number): Promise<string> {
  const cacheKey = `${lat.toFixed(2)},${lng.toFixed(2)}`;
  let cache: Record<string, string> = {};
  try {
    cache = JSON.parse(safeGet(REGION_CACHE_KEY) ?? "{}");
  } catch {
    cache = {};
  }
  if (cache[cacheKey]) return cache[cacheKey];

  let region = gridRegion(lat, lng);
  try {
    const county = await lookupPaCountyAtPoint(lat, lng);
    if (county?.countyName) region = `PA:${county.countyName.trim()}`;
  } catch {
    // Keep the grid region; it's still anonymous and useful.
  }
  safeSet(REGION_CACHE_KEY, JSON.stringify({ ...cache, [cacheKey]: region }));
  return region;
}

/** Send rows not already shared from this device. Safe to call repeatedly. */
export async function contributeSightings(
  client: SupabaseClient,
  userId: string,
  rows: SightingRow[],
): Promise<number> {
  let sent: string[] = [];
  try {
    sent = JSON.parse(safeGet(SENT_PREFIX + userId) ?? "[]");
  } catch {
    sent = [];
  }
  const sentSet = new Set(sent);
  const fresh = rows.filter((row) => !sentSet.has(row.source_key));

  for (let i = 0; i < fresh.length; i += CHUNK) {
    const chunk = fresh.slice(i, i + CHUNK);
    const { error } = await client
      .from(TABLE)
      .upsert(
        chunk.map((row) => ({ ...row, user_id: userId })),
        { onConflict: "user_id,source_key", ignoreDuplicates: true },
      );
    if (error) break;
    chunk.forEach((row) => sentSet.add(row.source_key));
    safeSet(SENT_PREFIX + userId, JSON.stringify([...sentSet]));
  }
  return fresh.length;
}

/** Turning sharing off removes everything this account contributed. */
export async function withdrawSightings(client: SupabaseClient, userId: string) {
  await client.from(TABLE).delete().eq("user_id", userId);
  safeSet(SENT_PREFIX + userId, "[]");
}

export async function fetchRegionalActivity(
  client: SupabaseClient,
  region: string,
  windowDays: number,
  now: Date = new Date(),
): Promise<RegionalActivity | null> {
  const since = new Date(now.getTime() - windowDays * 86_400_000).toISOString().slice(0, 10);
  const { data, error } = await client.rpc("regional_movement", {
    p_region: region,
    p_since: since,
  });
  if (error || !Array.isArray(data)) return null;
  return toRegionalActivity(data, region, windowDays);
}

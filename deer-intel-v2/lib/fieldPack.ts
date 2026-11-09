"use client";

// "Get ready for the field" — one tap before losing signal. Saves everything a
// sit needs with no bars: the hunt area's map tiles (satellite + topo plus
// what's on screen, parcel lines included — lib/offlineMaps), a fresh forecast
// snapshot that Today and the map read offline (lib/forecastSnapshot, which
// also carries the sunrise/sunset that legal light comes from), and a fresh
// service-worker copy of the pages a hunter opens in the field. Stands, the
// hunt log and pins are local data already, so the saved pages are all they
// need.
//
// The result is a checklist the panel shows, kept on this device (like the map
// packs, it describes what THIS device saved) with when it was made, so the
// panel can say "Field pack: saved 2 h ago" and warn once it's a day old.

import { useSyncExternalStore } from "react";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import {
  deleteOfflinePack,
  downloadOfflinePack,
  listOfflinePacks,
  matchOfflineVectorTile,
  planOfflinePack,
  type OfflineDownloadProgress,
  type OfflineMapBounds,
  type OfflinePackPlan,
  type OfflineTileSource,
} from "@/lib/offlineMaps";
import {
  fetchLiveForecast,
  PA_LEGAL_LIGHT_MINUTES,
  type LiveForecast,
  type WeatherPoint,
} from "@/lib/liveWeather";
import {
  forecastSnapshotKey,
  readForecastSnapshotEntry,
  writeForecastSnapshot,
} from "@/lib/forecastSnapshot";
import { forecastClock, parseForecastLocal } from "@/lib/forecastTime";
import type { MapLayerId } from "@/lib/propertyMap";
import type { UnitPreferences } from "@/lib/units";

export const FIELD_PACK_STORAGE_KEY = "deer-intel:field-pack";
/** Older than this, the panel warns the pack is stale. */
export const FIELD_PACK_STALE_MS = 24 * 60 * 60 * 1000;
/** Zooms saved for the hunt area — the same span as "Save this area offline". */
export const FIELD_PACK_MIN_ZOOM = 13;
export const FIELD_PACK_MAX_ZOOM = 17;
/** Pages a hunter opens in the field; all are in the service worker's PRECACHE. */
export const FIELD_PACK_PAGES = ["/", "/map", "/stands", "/hunt-log"] as const;
/** Marks the map pack a field pack saved, so the next one replaces it. */
export const FIELD_PACK_TARGET_SUFFIX = " (field pack)";
/** How long to wait on the service worker before checking the cache directly. */
const WARM_PAGES_TIMEOUT_MS = 25_000;

export type FieldPackItemId = "map" | "forecast" | "pages" | "parcels";

export type FieldPackItem = {
  id: FieldPackItemId;
  ok: boolean;
  /** Short note after the mark: "1,240 tiles", "through Wed", "need signal". */
  detail: string;
};

export type FieldPackRecord = {
  propertyId: string;
  propertyName: string;
  targetLabel: string;
  savedAt: number;
  items: FieldPackItem[];
  /** "Mon 6:12 AM – 5:28 PM" per forecast day, when the forecast was saved. */
  legalLight: string[];
};

export type FieldPackStep =
  | { step: "forecast" }
  | { step: "pages" }
  | { step: "map"; progress: OfflineDownloadProgress }
  | { step: "parcels" };

// --- Pure helpers (unit-tested) ----------------------------------------------

function sourceKey(source: OfflineTileSource): string {
  return `${source.kind ?? "xyz"}|${source.url}|${source.wms?.layers ?? ""}|${source.query ?? ""}`;
}

/**
 * The tile sources a field pack saves: satellite first (the map reads the
 * Wayback release from the first imagery source of the newest pack), then
 * topo, then whatever else is on screen (overlays, water, parcels, terrain
 * layers), without duplicates.
 */
export function fieldPackSources(
  satellite: OfflineTileSource,
  topo: OfflineTileSource,
  onScreen: readonly OfflineTileSource[],
): OfflineTileSource[] {
  const seen = new Set<string>();
  const out: OfflineTileSource[] = [];
  for (const source of [satellite, topo, ...onScreen]) {
    const key = sourceKey(source);
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(source);
  }
  return out;
}

/** Plan the field pack's tiles for an area (capped like every pack). */
export function planFieldPack(
  sources: OfflineTileSource[],
  bounds: OfflineMapBounds,
): OfflinePackPlan {
  return planOfflinePack(sources, bounds, FIELD_PACK_MIN_ZOOM, FIELD_PACK_MAX_ZOOM);
}

function weekdayOf(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return "";
  return new Date(year, month - 1, day).toLocaleDateString("en-US", { weekday: "short" });
}

/** "Wed" — the last day the forecast covers, or "" with no day list. */
export function forecastThroughLabel(forecast: LiveForecast | null | undefined): string {
  const days = forecast?.days ?? [];
  const last = days[days.length - 1];
  return last ? weekdayOf(last.date) : "";
}

/**
 * Legal shooting light per forecast day, on the property's clock:
 * "Mon 6:12 AM – 5:28 PM" (PA: 30 min before sunrise to 30 min after sunset).
 * A day with no sun times of its own uses the forecast's top-level ones for
 * day 0 only, and is skipped otherwise.
 */
export function legalLightLines(forecast: LiveForecast | null | undefined): string[] {
  if (!forecast) return [];
  const { utcOffsetSeconds, timezone } = forecast;
  const lines: string[] = [];
  (forecast.days ?? []).forEach((day, index) => {
    const sunriseIso = day.sunriseIso ?? (index === 0 ? forecast.sunriseIso : undefined);
    const sunsetIso = day.sunsetIso ?? (index === 0 ? forecast.sunsetIso : undefined);
    const sunrise = parseForecastLocal(sunriseIso, utcOffsetSeconds, timezone);
    const sunset = parseForecastLocal(sunsetIso, utcOffsetSeconds, timezone);
    if (!sunrise || !sunset) return;
    const start = new Date(sunrise.getTime() - PA_LEGAL_LIGHT_MINUTES.beforeSunrise * 60_000);
    const end = new Date(sunset.getTime() + PA_LEGAL_LIGHT_MINUTES.afterSunset * 60_000);
    lines.push(
      `${weekdayOf(day.date)} ${forecastClock(start, utcOffsetSeconds, timezone)} – ${forecastClock(end, utcOffsetSeconds, timezone)}`,
    );
  });
  return lines;
}

const ITEM_LABEL: Record<FieldPackItemId, string> = {
  map: "map",
  forecast: "forecast",
  pages: "pages",
  parcels: "parcel lines",
};

export function fieldPackItemLabel(id: FieldPackItemId): string {
  return ITEM_LABEL[id];
}

/** "map ✓ (1,240 tiles)" / "parcel lines ✗ need signal". */
export function fieldPackItemText(item: FieldPackItem): string {
  const mark = item.ok ? "✓" : "✗";
  if (!item.detail) return `${ITEM_LABEL[item.id]} ${mark}`;
  return item.ok
    ? `${ITEM_LABEL[item.id]} ${mark} (${item.detail})`
    : `${ITEM_LABEL[item.id]} ${mark} ${item.detail}`;
}

/** True when the map and forecast — what a sit can't do without — are saved. */
export function fieldPackReady(items: readonly FieldPackItem[]): boolean {
  return ["map", "forecast"].every((id) => items.find((item) => item.id === id)?.ok);
}

/**
 * "Ready for the field: map ✓ (1,240 tiles) · forecast ✓ (through Wed) ·
 * pages ✓ · parcel lines ✗ need signal".
 */
export function fieldPackSummary(items: readonly FieldPackItem[]): string {
  const head = fieldPackReady(items) ? "Ready for the field" : "Not ready for the field";
  return `${head}: ${items.map(fieldPackItemText).join(" · ")}`;
}

/** "saved 2 h ago" plus whether it's past FIELD_PACK_STALE_MS. */
export function fieldPackAge(
  savedAt: number,
  nowMs: number,
): { label: string; stale: boolean } {
  const ageMs = Math.max(0, nowMs - savedAt);
  const minutes = Math.floor(ageMs / 60_000);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const ago =
    minutes < 1
      ? "just now"
      : minutes < 60
        ? `${minutes} min ago`
        : hours < 48
          ? `${hours} h ago`
          : `${days} days ago`;
  return { label: `saved ${ago}`, stale: ageMs > FIELD_PACK_STALE_MS };
}

/** The checklist row for the parcel tiles, from the plan and a saved-tile probe. */
export function parcelItem(
  plan: OfflinePackPlan,
  mapSaved: boolean,
  probeSaved: boolean,
): FieldPackItem {
  const hasParcels = plan.sources.some((source) => source.kind === "pmtiles");
  if (!hasParcels || plan.vectorMaxZoom === undefined) {
    return { id: "parcels", ok: false, detail: "need signal" };
  }
  if (!mapSaved || !probeSaved) return { id: "parcels", ok: false, detail: "need signal" };
  return {
    id: "parcels",
    ok: true,
    detail: plan.vectorTrimmed ? `to zoom ${plan.vectorMaxZoom}` : "",
  };
}

// --- Saved record ------------------------------------------------------------

function isFieldPackRecord(value: unknown): value is FieldPackRecord {
  if (typeof value !== "object" || value === null) return false;
  const record = value as Record<string, unknown>;
  return (
    typeof record.savedAt === "number" &&
    typeof record.propertyId === "string" &&
    Array.isArray(record.items)
  );
}

export function readFieldPackRecord(): FieldPackRecord | null {
  const raw = readStorageValue(FIELD_PACK_STORAGE_KEY);
  if (!raw) return null;
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isFieldPackRecord(parsed)) return null;
    return { ...parsed, legalLight: Array.isArray(parsed.legalLight) ? parsed.legalLight : [] };
  } catch {
    return null;
  }
}

const listeners = new Set<() => void>();
let recordCache: FieldPackRecord | null | undefined;

function writeFieldPackRecord(record: FieldPackRecord): void {
  writeStorageValue(FIELD_PACK_STORAGE_KEY, JSON.stringify(record));
  recordCache = record;
  for (const listener of listeners) listener();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  const onStorage = (event: StorageEvent) => {
    if (event.key !== FIELD_PACK_STORAGE_KEY && event.key !== null) return;
    recordCache = undefined;
    listener();
  };
  if (typeof window !== "undefined") window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(listener);
    if (typeof window !== "undefined") window.removeEventListener("storage", onStorage);
  };
}

function getSnapshot(): FieldPackRecord | null {
  if (recordCache === undefined) recordCache = readFieldPackRecord();
  return recordCache;
}

/** The last field pack saved on this device, or null. */
export function useFieldPackRecord(): FieldPackRecord | null {
  return useSyncExternalStore(subscribe, getSnapshot, () => null);
}

// --- Running a pack ----------------------------------------------------------

/**
 * Ask the service worker to re-save every precached page (and its chunks)
 * now; resolves with which field pages are saved. With no controlling worker
 * (first visit, private window) or no answer in time, checks Cache Storage
 * directly — the worker's cache is visible to the page.
 */
export async function warmFieldPages(): Promise<{ saved: string[]; missing: string[] }> {
  const fromWorker = await askWorkerToWarm().catch(() => null);
  const saved: string[] = [];
  const missing: string[] = [];
  for (const path of FIELD_PACK_PAGES) {
    let ok = fromWorker?.[path];
    if (ok === undefined) ok = await isPageCached(path);
    (ok ? saved : missing).push(path);
  }
  return { saved, missing };
}

async function isPageCached(path: string): Promise<boolean> {
  if (typeof window === "undefined" || !("caches" in window)) return false;
  try {
    return Boolean(await caches.match(path, { ignoreSearch: true }));
  } catch {
    return false;
  }
}

function askWorkerToWarm(): Promise<Record<string, boolean> | null> {
  const controller =
    typeof navigator !== "undefined" ? navigator.serviceWorker?.controller : null;
  if (!controller) return Promise.resolve(null);
  return new Promise((resolve) => {
    const channel = new MessageChannel();
    const timer = setTimeout(() => {
      channel.port1.close();
      resolve(null);
    }, WARM_PAGES_TIMEOUT_MS);
    channel.port1.onmessage = (event: MessageEvent) => {
      clearTimeout(timer);
      channel.port1.close();
      const data = event.data as { type?: string; saved?: Record<string, boolean> } | null;
      resolve(data?.type === "WARM_PAGES_DONE" && data.saved ? data.saved : null);
    };
    controller.postMessage({ type: "WARM_PAGES" }, [channel.port2]);
  });
}

/** Fetch the forecast now and save it as the snapshot Today and the map read. */
async function saveFieldForecast(
  point: WeatherPoint | null,
  units: UnitPreferences,
): Promise<{ item: FieldPackItem; forecast: LiveForecast | null }> {
  if (!point) {
    return {
      item: { id: "forecast", ok: false, detail: "set a property location" },
      forecast: null,
    };
  }
  const key = forecastSnapshotKey(point, units);
  const result = await fetchLiveForecast(point, units).catch(() => null);
  if (result?.status === "ok") {
    writeForecastSnapshot(key, result.forecast);
    const through = forecastThroughLabel(result.forecast);
    return {
      item: { id: "forecast", ok: true, detail: through ? `through ${through}` : "" },
      forecast: result.forecast,
    };
  }
  // No signal now: an earlier saved forecast still counts, but say it's old.
  const held = readForecastSnapshotEntry(key);
  if (held) {
    const through = forecastThroughLabel(held.forecast);
    return {
      item: {
        id: "forecast",
        ok: true,
        detail: `earlier copy${through ? `, through ${through}` : ""}`,
      },
      forecast: held.forecast,
    };
  }
  return { item: { id: "forecast", ok: false, detail: "need signal" }, forecast: null };
}

/** Is the parcel tile under the area's center saved at the deepest planned zoom? */
async function probeParcelTile(plan: OfflinePackPlan, bounds: OfflineMapBounds): Promise<boolean> {
  const parcels = plan.sources.find((source) => source.kind === "pmtiles");
  if (!parcels || plan.vectorMaxZoom === undefined) return false;
  const zoom = plan.vectorMaxZoom;
  const lat = (bounds.north + bounds.south) / 2;
  const lng = (bounds.east + bounds.west) / 2;
  const n = 2 ** zoom;
  const x = Math.floor(((lng + 180) / 360) * n);
  const rad = (lat * Math.PI) / 180;
  const y = Math.floor(((1 - Math.log(Math.tan(rad) + 1 / Math.cos(rad)) / Math.PI) / 2) * n);
  return (await matchOfflineVectorTile(parcels.url, zoom, x, y)) !== null;
}

export type FieldPackParams = {
  propertyId: string;
  propertyName: string;
  targetLabel: string;
  bounds: OfflineMapBounds;
  /** From fieldPackSources. */
  sources: OfflineTileSource[];
  layerId: MapLayerId;
  layerLabel: string;
  weatherPoint: WeatherPoint | null;
  units: UnitPreferences;
};

/**
 * Save the field pack: forecast, pages, then the map tiles (the long part,
 * with progress), then check the parcel tiles. A failed step is recorded as ✗
 * and the rest still run; canceling (AbortError) saves no record.
 */
export async function runFieldPack(
  params: FieldPackParams,
  onStep: (step: FieldPackStep) => void,
  signal?: AbortSignal,
): Promise<FieldPackRecord> {
  const plan = planFieldPack(params.sources, params.bounds);

  onStep({ step: "forecast" });
  const forecast = await saveFieldForecast(params.weatherPoint, params.units);
  if (signal?.aborted) throw new DOMException("Field pack canceled", "AbortError");

  onStep({ step: "pages" });
  const pages = await warmFieldPages();
  if (signal?.aborted) throw new DOMException("Field pack canceled", "AbortError");
  const pagesItem: FieldPackItem =
    pages.missing.length === 0
      ? { id: "pages", ok: true, detail: "" }
      : { id: "pages", ok: false, detail: `${pages.missing.join(", ")} need signal` };

  let mapItem: FieldPackItem;
  let mapSaved = false;
  if (plan.tileCount === 0) {
    mapItem = { id: "map", ok: false, detail: "nothing to save here" };
  } else {
    onStep({ step: "map", progress: { completed: 0, total: plan.tileCount, failed: 0, bytes: 0 } });
    try {
      const pack = await downloadOfflinePack(
        {
          propertyId: params.propertyId,
          propertyName: params.propertyName,
          layerId: params.layerId,
          layerLabel: params.layerLabel,
          targetLabel: `${params.targetLabel}${FIELD_PACK_TARGET_SUFFIX}`,
          bounds: params.bounds,
          sources: plan.sources,
          minZoom: plan.minZoom,
          maxZoom: plan.maxZoom,
        },
        (progress) => onStep({ step: "map", progress }),
        signal,
      );
      mapSaved = true;
      // Replace this property's previous field-pack map rather than piling up
      // copies (shared tiles stay: the new pack still needs them).
      for (const old of listOfflinePacks()) {
        if (
          old.id !== pack.id &&
          old.propertyId === params.propertyId &&
          old.targetLabel.endsWith(FIELD_PACK_TARGET_SUFFIX)
        ) {
          await deleteOfflinePack(old.id).catch(() => undefined);
        }
      }
      const failed = pack.failedTiles ?? 0;
      mapItem = {
        id: "map",
        ok: true,
        detail:
          `${pack.tileCount.toLocaleString("en-US")} tiles` +
          (failed > 0 ? `, ${failed.toLocaleString("en-US")} missed` : ""),
      };
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") throw error;
      mapItem = { id: "map", ok: false, detail: "need signal" };
    }
  }

  onStep({ step: "parcels" });
  const probe = mapSaved ? await probeParcelTile(plan, params.bounds).catch(() => false) : false;

  const record: FieldPackRecord = {
    propertyId: params.propertyId,
    propertyName: params.propertyName,
    targetLabel: params.targetLabel,
    savedAt: Date.now(),
    items: [mapItem, forecast.item, pagesItem, parcelItem(plan, mapSaved, probe)],
    legalLight: legalLightLines(forecast.forecast),
  };
  writeFieldPackRecord(record);
  return record;
}

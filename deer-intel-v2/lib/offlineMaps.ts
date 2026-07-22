"use client";

// Offline maps — download the map tiles for a patch of ground so the map still
// works in the field with no signal. The app is local-first for its data, but
// every base map streams tiles from the network; this closes that gap.
//
// Tiles are stored in the Cache Storage API (keyed by their real URL) so a
// custom tile layer can serve them back transparently when offline. Pack
// metadata (what areas are saved, how big) lives in a device-scoped
// localStorage key that is intentionally NOT part of the cloud-synced app
// state — cached tiles belong to the device that downloaded them.

import { useSyncExternalStore } from "react";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import type { MapLayerId } from "@/lib/propertyMap";

const OFFLINE_TILE_CACHE = "deer-intel-offline-tiles-v1";
const OFFLINE_PACKS_STORAGE_KEY = "deer-intel:offline-packs";

// Keep any single download bounded so a careless drag doesn't queue a million
// tiles. The deepest zoom is trimmed until the count fits under this cap.
const MAX_TILES_PER_PACK = 6000;
// Rough per-tile weight, used only for the pre-download estimate; the real size
// is measured as tiles arrive.
const ESTIMATED_BYTES_PER_TILE = 18_000;
const DOWNLOAD_CONCURRENCY = 6;

export type OfflineMapBounds = {
  south: number;
  west: number;
  north: number;
  east: number;
};

// One tile source (a base map or one of its overlays). maxNativeZoom caps how
// deep this source has real tiles — we never fetch past it.
export type OfflineTileSource = {
  url: string;
  maxNativeZoom: number;
};

export type OfflineMapPack = {
  id: string;
  propertyId: string;
  propertyName: string;
  layerId: MapLayerId;
  layerLabel: string;
  targetLabel: string;
  bounds: OfflineMapBounds;
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  sizeBytes: number;
  createdAt: string;
  sources: OfflineTileSource[];
};

export type OfflineDownloadProgress = {
  completed: number;
  total: number;
  failed: number;
  bytes: number;
};

export type OfflinePackPlan = {
  sources: OfflineTileSource[];
  minZoom: number;
  maxZoom: number;
  tileCount: number;
  estimatedBytes: number;
  clamped: boolean;
};

function offlineCachesSupported(): boolean {
  return typeof window !== "undefined" && "caches" in window;
}

export function offlineMapsSupported(): boolean {
  return offlineCachesSupported();
}

// --- Tile math (Web Mercator / XYZ) -----------------------------------------

function lngToTileX(lng: number, zoom: number): number {
  return Math.floor(((lng + 180) / 360) * 2 ** zoom);
}

function latToTileY(lat: number, zoom: number): number {
  const clampedLat = Math.max(-85.05112878, Math.min(85.05112878, lat));
  const radians = (clampedLat * Math.PI) / 180;
  return Math.floor(
    ((1 - Math.log(Math.tan(radians) + 1 / Math.cos(radians)) / Math.PI) / 2) *
      2 ** zoom,
  );
}

function tileRangeForZoom(bounds: OfflineMapBounds, zoom: number) {
  const maxIndex = 2 ** zoom - 1;
  const clamp = (value: number) => Math.max(0, Math.min(maxIndex, value));

  const xMin = clamp(lngToTileX(bounds.west, zoom));
  const xMax = clamp(lngToTileX(bounds.east, zoom));
  // Tile Y grows southward, so the north edge is the smaller index.
  const yMin = clamp(latToTileY(bounds.north, zoom));
  const yMax = clamp(latToTileY(bounds.south, zoom));

  return { xMin, xMax, yMin, yMax };
}

function countTilesInBounds(
  bounds: OfflineMapBounds,
  minZoom: number,
  maxZoom: number,
  maxNativeZoom: number,
): number {
  let total = 0;

  for (let zoom = minZoom; zoom <= Math.min(maxZoom, maxNativeZoom); zoom += 1) {
    const { xMin, xMax, yMin, yMax } = tileRangeForZoom(bounds, zoom);
    total += (xMax - xMin + 1) * (yMax - yMin + 1);
  }

  return total;
}

function fillTemplate(
  template: string,
  zoom: number,
  x: number,
  y: number,
): string {
  return template
    .replace("{s}", "a")
    .replace("{z}", String(zoom))
    .replace("{x}", String(x))
    .replace("{y}", String(y));
}

// Every tile URL a pack needs, across all its sources and zoom levels. Each
// source only contributes zooms up to its own native depth.
function enumeratePackTileUrls(
  sources: OfflineTileSource[],
  bounds: OfflineMapBounds,
  minZoom: number,
  maxZoom: number,
): string[] {
  const urls = new Set<string>();

  for (const source of sources) {
    const deepest = Math.min(maxZoom, source.maxNativeZoom);

    for (let zoom = minZoom; zoom <= deepest; zoom += 1) {
      const { xMin, xMax, yMin, yMax } = tileRangeForZoom(bounds, zoom);

      for (let x = xMin; x <= xMax; x += 1) {
        for (let y = yMin; y <= yMax; y += 1) {
          urls.add(fillTemplate(source.url, zoom, x, y));
        }
      }
    }
  }

  return [...urls];
}

// Plan a pack for the given bounds, trimming the deepest zoom until the tile
// count fits under the cap so downloads stay bounded.
export function planOfflinePack(
  sources: OfflineTileSource[],
  bounds: OfflineMapBounds,
  minZoom: number,
  requestedMaxZoom: number,
): OfflinePackPlan {
  const deepestNative = sources.reduce(
    (deepest, source) => Math.max(deepest, source.maxNativeZoom),
    0,
  );
  let maxZoom = Math.min(requestedMaxZoom, deepestNative);
  let clamped = false;

  while (
    maxZoom > minZoom &&
    countTilesInBounds(bounds, minZoom, maxZoom, deepestNative) >
      MAX_TILES_PER_PACK
  ) {
    maxZoom -= 1;
    clamped = true;
  }

  const tileCount = enumeratePackTileUrls(
    sources,
    bounds,
    minZoom,
    maxZoom,
  ).length;

  return {
    sources,
    minZoom,
    maxZoom,
    tileCount,
    estimatedBytes: tileCount * ESTIMATED_BYTES_PER_TILE,
    clamped,
  };
}

// --- Cache storage ----------------------------------------------------------

async function fetchAndStoreTile(
  cache: Cache,
  url: string,
): Promise<number> {
  const existing = await cache.match(url);
  if (existing) {
    const blob = await existing.blob();
    return blob.size;
  }

  const response = await fetch(url, { mode: "cors", credentials: "omit" });
  if (!response.ok) {
    throw new Error(`Tile request failed (${response.status})`);
  }

  // Re-wrap the body as a clean 200 response so it is always cacheable and
  // readable back, regardless of the original headers.
  const buffer = await response.arrayBuffer();
  const contentType = response.headers.get("content-type") ?? "image/png";
  await cache.put(
    url,
    new Response(buffer, { headers: { "Content-Type": contentType } }),
  );

  return buffer.byteLength;
}

export async function downloadOfflinePack(
  params: {
    propertyId: string;
    propertyName: string;
    layerId: MapLayerId;
    layerLabel: string;
    targetLabel: string;
    bounds: OfflineMapBounds;
    sources: OfflineTileSource[];
    minZoom: number;
    maxZoom: number;
  },
  onProgress?: (progress: OfflineDownloadProgress) => void,
  signal?: AbortSignal,
): Promise<OfflineMapPack> {
  if (!offlineCachesSupported()) {
    throw new Error("Offline maps aren't supported in this browser.");
  }

  const urls = enumeratePackTileUrls(
    params.sources,
    params.bounds,
    params.minZoom,
    params.maxZoom,
  );
  const cache = await caches.open(OFFLINE_TILE_CACHE);

  const progress: OfflineDownloadProgress = {
    completed: 0,
    total: urls.length,
    failed: 0,
    bytes: 0,
  };

  let cursor = 0;

  async function worker() {
    while (cursor < urls.length) {
      if (signal?.aborted) return;

      const url = urls[cursor];
      cursor += 1;

      try {
        progress.bytes += await fetchAndStoreTile(cache, url);
      } catch {
        progress.failed += 1;
      }

      progress.completed += 1;
      onProgress?.({ ...progress });
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DOWNLOAD_CONCURRENCY, urls.length) },
      worker,
    ),
  );

  if (signal?.aborted) {
    throw new DOMException("Download canceled", "AbortError");
  }

  const pack: OfflineMapPack = {
    id: createOfflinePackId(),
    propertyId: params.propertyId,
    propertyName: params.propertyName,
    layerId: params.layerId,
    layerLabel: params.layerLabel,
    targetLabel: params.targetLabel,
    bounds: params.bounds,
    minZoom: params.minZoom,
    maxZoom: params.maxZoom,
    tileCount: progress.completed - progress.failed,
    sizeBytes: progress.bytes,
    createdAt: new Date().toISOString(),
    sources: params.sources,
  };

  saveOfflinePackRecord(pack);

  return pack;
}

// Serve a cached tile as an object URL, or null if it isn't downloaded. Called
// per tile by the cached tile layer, so it stays cheap and swallows errors.
// Memoized cache handle: the map asks for this once per tile on the offline
// path, and reopening the cache on every tile is needless work on the zoom hot
// path. The handle stays valid for the session.
let offlineTileCachePromise: Promise<Cache> | null = null;

function openOfflineTileCache(): Promise<Cache> {
  if (!offlineTileCachePromise) {
    offlineTileCachePromise = caches.open(OFFLINE_TILE_CACHE);
  }

  return offlineTileCachePromise;
}

export async function matchOfflineTile(url: string): Promise<string | null> {
  if (!offlineCachesSupported()) return null;

  try {
    const cache = await openOfflineTileCache();
    const response = await cache.match(url);
    if (!response) return null;

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// Delete a pack's metadata and any of its tiles that no other pack still needs.
async function pruneOrphanTiles(remaining: OfflineMapPack[]): Promise<void> {
  if (!offlineCachesSupported()) return;

  const cache = await caches.open(OFFLINE_TILE_CACHE);
  const keep = new Set<string>();

  for (const pack of remaining) {
    for (const url of enumeratePackTileUrls(
      pack.sources,
      pack.bounds,
      pack.minZoom,
      pack.maxZoom,
    )) {
      keep.add(url);
    }
  }

  const requests = await cache.keys();
  await Promise.all(
    requests.map((request) =>
      keep.has(request.url) ? Promise.resolve(false) : cache.delete(request),
    ),
  );
}

export async function deleteOfflinePack(id: string): Promise<void> {
  const remaining = readOfflinePacks().filter((pack) => pack.id !== id);
  writeOfflinePacks(remaining);
  await pruneOrphanTiles(remaining);
}

export async function clearAllOfflineTiles(): Promise<void> {
  writeOfflinePacks([]);
  if (offlineCachesSupported()) {
    await caches.delete(OFFLINE_TILE_CACHE);
  }
}

// --- Pack metadata store ----------------------------------------------------

function createOfflinePackId(): string {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `offline-${window.crypto.randomUUID()}`;
  }
  return `offline-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

function isOfflinePack(value: unknown): value is OfflineMapPack {
  if (typeof value !== "object" || value === null) return false;
  const pack = value as Record<string, unknown>;
  return (
    typeof pack.id === "string" &&
    typeof pack.tileCount === "number" &&
    Array.isArray(pack.sources) &&
    typeof pack.bounds === "object" &&
    pack.bounds !== null
  );
}

function readOfflinePacks(): OfflineMapPack[] {
  const raw = readStorageValue(OFFLINE_PACKS_STORAGE_KEY);
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter(isOfflinePack) : [];
  } catch {
    return [];
  }
}

function writeOfflinePacks(packs: OfflineMapPack[]): void {
  writeStorageValue(OFFLINE_PACKS_STORAGE_KEY, JSON.stringify(packs));
  packsCache = packs;
  offlineTileTotal = packs.reduce((total, pack) => total + pack.tileCount, 0);
  notifyPackListeners();
}

function saveOfflinePackRecord(pack: OfflineMapPack): void {
  writeOfflinePacks([...readOfflinePacks(), pack]);
}

// Synchronous availability flag so the tile layer can skip cache lookups
// entirely when nothing is downloaded (zero overhead for the common case).
let offlineTileTotal = readOfflinePacksTotalOnLoad();

function readOfflinePacksTotalOnLoad(): number {
  if (typeof window === "undefined") return 0;
  return readOfflinePacks().reduce((total, pack) => total + pack.tileCount, 0);
}

export function offlineTilesAvailable(): boolean {
  return offlineCachesSupported() && offlineTileTotal > 0;
}

// --- React subscription -----------------------------------------------------

const packListeners = new Set<() => void>();
let packsCache: OfflineMapPack[] | null = null;

function notifyPackListeners(): void {
  packsCache = null;
  for (const listener of packListeners) listener();
}

function subscribeToPacks(listener: () => void): () => void {
  packListeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === OFFLINE_PACKS_STORAGE_KEY) {
      packsCache = readOfflinePacks();
      offlineTileTotal = packsCache.reduce(
        (total, pack) => total + pack.tileCount,
        0,
      );
      listener();
    }
  }

  if (typeof window !== "undefined") {
    window.addEventListener("storage", handleStorage);
  }

  return () => {
    packListeners.delete(listener);
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", handleStorage);
    }
  };
}

const EMPTY_PACKS: OfflineMapPack[] = [];

function getPacksSnapshot(): OfflineMapPack[] {
  if (packsCache === null) packsCache = readOfflinePacks();
  return packsCache;
}

function getServerPacksSnapshot(): OfflineMapPack[] {
  return EMPTY_PACKS;
}

export function useOfflineMapPacks(): OfflineMapPack[] {
  return useSyncExternalStore(
    subscribeToPacks,
    getPacksSnapshot,
    getServerPacksSnapshot,
  );
}

// --- Formatting helpers -----------------------------------------------------

export function formatOfflineSize(bytes: number): string {
  if (bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

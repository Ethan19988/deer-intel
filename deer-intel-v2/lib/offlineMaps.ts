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

// One tile source a pack saves. maxNativeZoom caps how deep this source has
// real tiles — we never fetch past it — and minNativeZoom (default 0) is the
// shallowest zoom it draws at.
//
// - "xyz" (default; packs saved before `kind` existed are xyz): a {z}/{x}/{y}
//   raster template, cached under its real URL.
// - "wms": a dynamic WMS GetMap service. Leaflet builds each tile's URL from a
//   float bbox, so tiles are cached under a stable synthetic key per
//   (service, layers, z/x/y) — see offlineWmsTileKey — not the request URL.
// - "pmtiles": a PMTiles vector archive (the parcel layer). Decoded tiles are
//   cached under offlinePmtilesTileKey, so the map can draw them offline with
//   no header/directory range reads at all.
export type OfflineTileSource = {
  url: string;
  maxNativeZoom: number;
  kind?: "xyz" | "wms" | "pmtiles";
  minNativeZoom?: number;
  /** The server 404s tiles it has no data for; save those as empty tiles. */
  sparse?: boolean;
  wms?: {
    layers: string;
    styles?: string;
    version: string;
    /** Requested image width/height (supersampled layers ask for 512). */
    pixelSize?: number;
  };
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
  /** Tiles that couldn't be downloaded; saving the area again fills them in. */
  failedTiles?: number;
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

const WEB_MERCATOR_HALF_WORLD = Math.PI * 6378137;

// Stable cache key for one WMS tile, independent of the exact bbox string
// Leaflet would build (float formatting makes that unreliable to reproduce).
// Built through URL so it matches Cache Storage's canonical request.url.
export function offlineWmsTileKey(
  serviceUrl: string,
  layers: string,
  zoom: number,
  x: number,
  y: number,
): string {
  const url = new URL(serviceUrl);
  url.searchParams.set("di-offline-layers", layers);
  url.searchParams.set("z", String(zoom));
  url.searchParams.set("x", String(x));
  url.searchParams.set("y", String(y));
  return url.href;
}

// Stable cache key for one decoded vector tile of a PMTiles archive.
export function offlinePmtilesTileKey(
  archiveUrl: string,
  zoom: number,
  x: number,
  y: number,
): string {
  const url = new URL(archiveUrl);
  url.searchParams.set("z", String(zoom));
  url.searchParams.set("x", String(x));
  url.searchParams.set("y", String(y));
  return url.href;
}

// The GetMap request for one XYZ tile, in the same parameter shape Leaflet's
// WMS layer sends (EPSG:3857, x/y axis order for both 1.1.1 and 1.3.0).
function wmsTileRequestUrl(
  source: OfflineTileSource,
  zoom: number,
  x: number,
  y: number,
): string {
  const wms = source.wms ?? { layers: "", version: "1.1.1" };
  const span = (2 * WEB_MERCATOR_HALF_WORLD) / 2 ** zoom;
  const minX = -WEB_MERCATOR_HALF_WORLD + x * span;
  const maxY = WEB_MERCATOR_HALF_WORLD - y * span;
  const pixels = String(wms.pixelSize ?? 256);
  const params: Array<[string, string]> = [
    ["service", "WMS"],
    ["request", "GetMap"],
    ["layers", wms.layers],
    ["styles", wms.styles ?? ""],
    ["format", "image/png"],
    ["transparent", "true"],
    ["version", wms.version],
    ["width", pixels],
    ["height", pixels],
    [parseFloat(wms.version) >= 1.3 ? "crs" : "srs", "EPSG:3857"],
    ["bbox", [minX, maxY - span, minX + span, maxY].join(",")],
  ];
  const query = params
    .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
    .join("&");
  return `${source.url}${source.url.includes("?") ? "&" : "?"}${query}`;
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

type PackTile = {
  source: OfflineTileSource;
  zoom: number;
  x: number;
  y: number;
};

function packTileKey(
  source: OfflineTileSource,
  zoom: number,
  x: number,
  y: number,
): string {
  if (source.kind === "pmtiles") {
    return offlinePmtilesTileKey(source.url, zoom, x, y);
  }
  if (source.kind === "wms") {
    return offlineWmsTileKey(source.url, source.wms?.layers ?? "", zoom, x, y);
  }
  return fillTemplate(source.url, zoom, x, y);
}

// The zooms a source needs for a pack spanning minZoom..maxZoom, or null.
function sourceZoomRange(
  source: OfflineTileSource,
  minZoom: number,
  maxZoom: number,
): { from: number; to: number } | null {
  const shallowest = source.minNativeZoom ?? 0;
  if (maxZoom < shallowest) return null;

  // WMS layers have no native depth to overzoom from: they draw only within
  // their own zoom band, so fetch exactly that band.
  if (source.kind === "wms") {
    const from = Math.max(minZoom, shallowest);
    const to = Math.min(maxZoom, source.maxNativeZoom);
    return from <= to ? { from, to } : null;
  }

  // Tile and vector layers overzoom their deepest native level, so a pack that
  // starts past it still needs that level. protomaps-leaflet may also draw a
  // display zoom from the data zoom one level up (its levelDiff), so vector
  // packs reach one zoom shallower.
  const deepest = source.maxNativeZoom;
  const wantFrom = source.kind === "pmtiles" ? minZoom - 1 : minZoom;
  const from = Math.min(deepest, Math.max(shallowest, wantFrom));
  const to = Math.min(deepest, maxZoom);
  return from <= to ? { from, to } : null;
}

// Every tile a pack needs, across all its sources and zoom levels, keyed by
// its cache key.
function enumeratePackTiles(
  sources: OfflineTileSource[],
  bounds: OfflineMapBounds,
  minZoom: number,
  maxZoom: number,
): Map<string, PackTile> {
  const tiles = new Map<string, PackTile>();

  for (const source of sources) {
    const range = sourceZoomRange(source, minZoom, maxZoom);
    if (!range) continue;

    for (let zoom = range.from; zoom <= range.to; zoom += 1) {
      const { xMin, xMax, yMin, yMax } = tileRangeForZoom(bounds, zoom);

      for (let x = xMin; x <= xMax; x += 1) {
        for (let y = yMin; y <= yMax; y += 1) {
          tiles.set(packTileKey(source, zoom, x, y), { source, zoom, x, y });
        }
      }
    }
  }

  return tiles;
}

function enumeratePackTileUrls(
  sources: OfflineTileSource[],
  bounds: OfflineMapBounds,
  minZoom: number,
  maxZoom: number,
): string[] {
  return [...enumeratePackTiles(sources, bounds, minZoom, maxZoom).keys()];
}

// Plan a pack for the given bounds, trimming the deepest zoom until the tile
// count fits under the cap so downloads stay bounded.
export function planOfflinePack(
  sources: OfflineTileSource[],
  bounds: OfflineMapBounds,
  minZoom: number,
  requestedMaxZoom: number,
): OfflinePackPlan {
  // Depth follows the raster tile sources (the imagery); WMS and vector
  // layers just come along for whatever range that gives.
  const deepestNative = sources.reduce(
    (deepest, source) =>
      (source.kind ?? "xyz") === "xyz"
        ? Math.max(deepest, source.maxNativeZoom)
        : deepest,
    0,
  );
  let maxZoom = Math.min(requestedMaxZoom, deepestNative);
  let clamped = false;

  // Count every source (base plus overlays) so layers with reference
  // overlays can't triple the real download past the cap.
  while (
    maxZoom > minZoom &&
    enumeratePackTileUrls(sources, bounds, minZoom, maxZoom).length >
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

type TileBody = { buffer: ArrayBuffer; contentType: string };

const EMPTY_TILE: TileBody = {
  buffer: new ArrayBuffer(0),
  contentType: "application/octet-stream",
};

async function fetchRasterTile(
  url: string,
  sparse: boolean,
  signal?: AbortSignal,
): Promise<TileBody> {
  const response = await fetch(url, {
    mode: "cors",
    credentials: "omit",
    signal,
  });
  // A sparse cache 404s where it has no data: that tile is legitimately empty.
  if (sparse && response.status === 404) return EMPTY_TILE;
  if (!response.ok) {
    throw new Error(`Tile request failed (${response.status})`);
  }

  return {
    buffer: await response.arrayBuffer(),
    contentType: response.headers.get("content-type") ?? "image/png",
  };
}

type PmtilesArchive = {
  getZxy(
    z: number,
    x: number,
    y: number,
    signal?: AbortSignal,
  ): Promise<{ data: ArrayBuffer } | undefined>;
};

// One reader per archive per download, so its header and directories are read
// once and shared by every tile. Loaded lazily: only a download needs it.
async function openPmtilesArchive(url: string): Promise<PmtilesArchive> {
  const { PMTiles } = await import("pmtiles");
  return new PMTiles(url);
}

async function loadPackTile(
  tile: PackTile,
  archives: Map<string, Promise<PmtilesArchive>>,
  signal?: AbortSignal,
): Promise<TileBody> {
  const { source, zoom, x, y } = tile;

  if (source.kind === "pmtiles") {
    let archive = archives.get(source.url);
    if (!archive) {
      archive = openPmtilesArchive(source.url);
      archives.set(source.url, archive);
    }
    // getZxy returns the decompressed MVT bytes, or undefined where the
    // archive has no tile (no parcels there) — saved as an empty tile.
    const result = await (await archive).getZxy(zoom, x, y, signal);
    if (!result) return EMPTY_TILE;
    return {
      buffer: result.data,
      contentType: "application/vnd.mapbox-vector-tile",
    };
  }

  if (source.kind === "wms") {
    return fetchRasterTile(
      wmsTileRequestUrl(source, zoom, x, y),
      Boolean(source.sparse),
      signal,
    );
  }

  return fetchRasterTile(
    fillTemplate(source.url, zoom, x, y),
    Boolean(source.sparse),
    signal,
  );
}

async function fetchAndStoreTile(
  cache: Cache,
  key: string,
  load: () => Promise<TileBody>,
): Promise<number> {
  const existing = await cache.match(key);
  if (existing) {
    const blob = await existing.blob();
    return blob.size;
  }

  const { buffer, contentType } = await load();

  // Re-wrap the body as a clean 200 response so it is always cacheable and
  // readable back, regardless of the original headers.
  await cache.put(
    key,
    new Response(buffer, { headers: { "Content-Type": contentType } }),
  );

  return buffer.byteLength;
}

// Ask the browser to keep the saved maps through storage pressure (iOS Safari
// and Chrome otherwise evict "best-effort" storage). Best effort and silent:
// unsupported or denied just leaves storage as it was.
function requestPersistentStorage(): void {
  try {
    if (typeof navigator === "undefined") return;
    const storage = navigator.storage;
    if (!storage || typeof storage.persist !== "function") return;
    storage.persist().catch(() => undefined);
  } catch {
    // Ignore — persistence is a nice-to-have.
  }
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

  // First pack on this device: request persistent storage now, synchronously
  // inside the user's Download tap (Firefox prompts and wants the gesture).
  if (readOfflinePacks().length === 0) requestPersistentStorage();

  const tiles = [
    ...enumeratePackTiles(
      params.sources,
      params.bounds,
      params.minZoom,
      params.maxZoom,
    ),
  ];
  const archives = new Map<string, Promise<PmtilesArchive>>();
  const cache = await caches.open(OFFLINE_TILE_CACHE);

  const progress: OfflineDownloadProgress = {
    completed: 0,
    total: tiles.length,
    failed: 0,
    bytes: 0,
  };

  let cursor = 0;

  async function worker() {
    while (cursor < tiles.length) {
      if (signal?.aborted) return;

      const [key, tile] = tiles[cursor];
      cursor += 1;

      try {
        progress.bytes += await fetchAndStoreTile(cache, key, () =>
          loadPackTile(tile, archives, signal),
        );
      } catch {
        if (signal?.aborted) return;
        progress.failed += 1;
      }

      progress.completed += 1;
      onProgress?.({ ...progress });
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(DOWNLOAD_CONCURRENCY, tiles.length) },
      worker,
    ),
  );

  if (signal?.aborted) {
    throw new DOMException("Download canceled", "AbortError");
  }

  // Nothing saved (no signal, storage full): report a failure rather than
  // recording an empty pack the map would treat as ready.
  if (progress.completed - progress.failed <= 0) {
    throw new Error("No map tiles could be saved.");
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
    failedTiles: progress.failed,
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

// Downloads store every tile under the "a" subdomain (see fillTemplate), but the
// live layer round-robins the {s} placeholder across a/b/c, so ~2/3 of lookups
// would otherwise miss the cache. Normalize the lookup to the stored key.
function normalizeTileUrl(url: string): string {
  return url.replace(/:\/\/[abc]\.tile\./, "://a.tile.");
}

export async function matchOfflineTile(url: string): Promise<string | null> {
  if (!offlineCachesSupported()) return null;

  try {
    const cache = await openOfflineTileCache();
    const response = await cache.match(normalizeTileUrl(url));
    if (!response) return null;

    const blob = await response.blob();
    return URL.createObjectURL(blob);
  } catch {
    return null;
  }
}

// A saved vector tile's decoded bytes, or null if it isn't downloaded. An empty
// buffer means "saved, and the archive has no tile here". Used by the parcel
// layer's offline-first PMTiles reader.
export async function matchOfflineVectorTile(
  archiveUrl: string,
  zoom: number,
  x: number,
  y: number,
): Promise<ArrayBuffer | null> {
  if (!offlineCachesSupported()) return null;

  try {
    const cache = await openOfflineTileCache();
    const response = await cache.match(
      offlinePmtilesTileKey(archiveUrl, zoom, x, y),
    );
    return response ? await response.arrayBuffer() : null;
  } catch {
    return null;
  }
}

// Cache Storage reports keys as canonical request URLs; compare like with like.
function canonicalCacheKey(key: string): string {
  try {
    return new URL(key).href;
  } catch {
    return key;
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
      keep.add(canonicalCacheKey(url));
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

/**
 * The Esri Wayback imagery release the newest saved pack was downloaded with,
 * or null. Offline, the map should ask for this release so saved tiles match.
 */
export function newestSavedWaybackRelease(): string | null {
  const packs = [...readOfflinePacks()].sort((a, b) =>
    b.createdAt.localeCompare(a.createdAt),
  );

  for (const pack of packs) {
    for (const source of pack.sources) {
      const match = /\/wayback\.maptiles\.arcgis\.com\/.*\/tile\/(\d+)\//.exec(
        source.url,
      );
      if (match) return match[1];
    }
  }

  return null;
}

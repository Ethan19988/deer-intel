// Walking trails & logging roads: the live queries behind the map's Trails
// layer (components/map/TrailsLayer.tsx), shared with offline map packs so a
// saved area keeps its trails with no signal.
//
// Two sources, merged: OpenStreetMap via Overpass (POST, community mirrors)
// and the USGS National Map transportation service (GET, GeoJSON). Both are
// open data (ODbL / public domain), fine to keep on the device that fetched it.

import {
  TRAILS_OVERPASS_ENDPOINTS,
  TRAILS_USGS_BASE,
} from "@/lib/propertyMap";
import type { OfflineTileSource } from "@/lib/offlineMaps";

// Foot-only ways vs. drivable-by-nothing-but-a-quad tracks. Split so the eye can
// tell a two-track logging road from a deer-trail footpath at a glance.
export type TrailKind = "foot" | "track";

export type Trail = {
  // Source-prefixed so OSM and USGS ids can't collide ("osm-123", "usgs-37-…").
  id: string;
  kind: TrailKind;
  label: string;
  detail: string;
  positions: Array<[number, number]>;
};

const OVERPASS_TIMEOUT_S = 20;
// Give each live request this long before we give up on it, so a slow/hung
// endpoint fails over quickly instead of stalling the layer.
export const TRAIL_REQUEST_TIMEOUT_MS = 8000;

// The USGS National Map transportation sublayers that are walk-in, non-public-
// vehicle ways. Merged with OSM to fill gaps (esp. on public land).
const USGS_TRAIL_LAYERS: Array<{ id: number; kind: TrailKind; noun: string }> = [
  { id: 37, kind: "foot", noun: "Trail" }, // Trails
  { id: 35, kind: "track", noun: "4WD road" }, // 4WD Roads
  { id: 36, kind: "track", noun: "Closed / gated road" }, // Closed Roads
];

// Every OSM highway class you travel on foot, not by vehicle:
//  - track      unpaved dirt / two-track / old logging roads (often gated)
//  - path       the catch-all trail, incl. informal deer/social trails
//  - footway    built walkways and sidewalks
//  - bridleway  horse trails (walkable)
//  - steps      stairs / step runs
//  - cycleway   bike paths and rail-trails (walkable)
//  - pedestrian foot-only ways (area plazas are filtered out below)
// Public vehicle roads (residential/service/unclassified/…) are other highway
// classes and are deliberately not requested.
const HIGHWAY_FILTER =
  "^(track|path|footway|bridleway|steps|cycleway|pedestrian)$";

/** Overpass QL for every foot way in an "S,W,N,E" box. */
export function overpassQuery(bounds: string): string {
  return (
    `[out:json][timeout:${OVERPASS_TIMEOUT_S}];` +
    `way["highway"~"${HIGHWAY_FILTER}"](${bounds});` +
    `out geom;`
  );
}

// fetch() with its own timeout that still honors an outer abort (a newer fetch
// superseding this one). Throws on non-2xx, timeout, or abort.
async function fetchWithTimeout(
  url: string,
  init: RequestInit,
  outerSignal: AbortSignal | undefined,
  timeoutMs: number,
): Promise<Response> {
  const controller = new AbortController();
  const relayAbort = () => controller.abort();
  outerSignal?.addEventListener("abort", relayAbort);
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, { ...init, signal: controller.signal });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    return response;
  } finally {
    clearTimeout(timer);
    outerSignal?.removeEventListener("abort", relayAbort);
  }
}

// --- OpenStreetMap (Overpass) source ---------------------------------------

export type OverpassElement = {
  type: string;
  id: number;
  tags?: Record<string, string>;
  geometry?: Array<{ lat: number; lon: number }>;
};

function osmKind(highway: string | undefined): TrailKind {
  return highway === "track" ? "track" : "foot";
}

function osmNoun(kind: TrailKind, highway: string | undefined): string {
  if (kind === "track") return "Track / two-track road";
  if (highway === "bridleway") return "Bridleway";
  if (highway === "steps") return "Steps";
  if (highway === "footway") return "Footway";
  if (highway === "cycleway") return "Cycleway / rail-trail";
  return "Foot path";
}

function osmSurfaceDetail(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags.surface) parts.push(tags.surface.replace(/_/g, " "));
  if (tags.tracktype) parts.push(tags.tracktype);
  if (tags.sac_scale) parts.push(tags.sac_scale.replace(/_/g, " "));
  return parts.join(" · ");
}

export function elementToTrail(el: OverpassElement): Trail | null {
  if (el.type !== "way" || !el.geometry || el.geometry.length < 2) return null;

  const tags = el.tags ?? {};
  // Squares/plazas mapped as filled areas aren't routes — skip so they don't
  // draw as a stray closed outline.
  if (tags.area === "yes") return null;
  const kind = osmKind(tags.highway);
  const noun = osmNoun(kind, tags.highway);

  return {
    id: `osm-${el.id}`,
    kind,
    label: tags.name ? tags.name : noun,
    detail: tags.name ? noun : osmSurfaceDetail(tags),
    positions: el.geometry.map((point) => [point.lat, point.lon]),
  };
}

// Try each Overpass mirror in turn; the first that answers wins. Throws only if
// every mirror fails (so the caller can still fall back to the USGS source).
export async function fetchOsmTrails(
  overpassBody: string,
  signal?: AbortSignal,
  timeoutMs = TRAIL_REQUEST_TIMEOUT_MS,
): Promise<Trail[]> {
  let lastError: unknown;

  for (const endpoint of TRAILS_OVERPASS_ENDPOINTS) {
    if (signal?.aborted) throw new DOMException("aborted", "AbortError");
    try {
      const response = await fetchWithTimeout(
        endpoint,
        {
          method: "POST",
          headers: { "Content-Type": "text/plain;charset=UTF-8" },
          body: overpassBody,
        },
        signal,
        timeoutMs,
      );
      const data = (await response.json()) as { elements?: OverpassElement[] };
      return (data.elements ?? [])
        .map(elementToTrail)
        .filter((trail): trail is Trail => trail !== null);
    } catch (error) {
      if (signal?.aborted) throw error;
      lastError = error; // this mirror failed; try the next
    }
  }

  throw lastError ?? new Error("all Overpass mirrors failed");
}

// --- USGS National Map source ----------------------------------------------

type GeoJsonLine = {
  type: "LineString" | "MultiLineString" | string;
  coordinates: number[][] | number[][][];
};

export type UsgsFeature = {
  geometry?: GeoJsonLine | null;
  properties?: Record<string, unknown> | null;
};

function asString(value: unknown): string {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

export function usgsFeatureToTrails(
  feature: UsgsFeature,
  layer: { id: number; kind: TrailKind; noun: string },
): Trail[] {
  const geometry = feature.geometry;
  if (!geometry) return [];

  const props = feature.properties ?? {};
  const oid =
    (props.objectid as number | undefined) ??
    (props.OBJECTID as number | undefined) ??
    0;
  const name = asString(props.name) || asString(props.maplabel);
  const surface = asString(props.trailsurface);
  const type = asString(props.trailtype);
  const label = name || layer.noun;
  const detail = name
    ? layer.noun
    : [surface, type].filter(Boolean).join(" · ");

  // Normalize LineString and MultiLineString to a list of coordinate rings.
  const rings: number[][][] =
    geometry.type === "LineString"
      ? [geometry.coordinates as number[][]]
      : geometry.type === "MultiLineString"
        ? (geometry.coordinates as number[][][])
        : [];

  return rings
    .map((ring, index) => ({
      id: `usgs-${layer.id}-${oid}-${index}`,
      kind: layer.kind,
      label,
      detail,
      positions: ring
        .filter((c) => Array.isArray(c) && c.length >= 2)
        .map((c) => [c[1], c[0]] as [number, number]),
    }))
    .filter((trail) => trail.positions.length >= 2);
}

// Each layer is queried independently and a failing one contributes nothing,
// so USGS never breaks the OSM result. Throws only when every layer failed, so
// a caller can tell "no trails here" from "couldn't reach USGS".
export async function fetchUsgsTrails(
  envelope: string,
  signal?: AbortSignal,
  timeoutMs = TRAIL_REQUEST_TIMEOUT_MS,
): Promise<Trail[]> {
  let failures = 0;
  const perLayer = await Promise.all(
    USGS_TRAIL_LAYERS.map(async (layer) => {
      const url =
        `${TRAILS_USGS_BASE}/${layer.id}/query?` +
        `geometry=${envelope}&geometryType=esriGeometryEnvelope&inSR=4326` +
        `&outSR=4326&spatialRel=esriSpatialRelIntersects&outFields=*` +
        `&returnGeometry=true&f=geojson`;
      try {
        const response = await fetchWithTimeout(url, { method: "GET" }, signal, timeoutMs);
        const data = (await response.json()) as { features?: UsgsFeature[] };
        return (data.features ?? []).flatMap((feature) =>
          usgsFeatureToTrails(feature, layer),
        );
      } catch {
        failures += 1;
        return [] as Trail[];
      }
    }),
  );

  if (failures === USGS_TRAIL_LAYERS.length) throw new Error("USGS trails unreachable");
  return perLayer.flat();
}

// --- Merging & offline packs -------------------------------------------------

/** One copy of each trail across several results (tiles overlap at seams). */
export function mergeTrails(lists: Trail[][]): Trail[] {
  const byId = new Map<string, Trail>();
  for (const list of lists) {
    for (const trail of list) if (!byId.has(trail.id)) byId.set(trail.id, trail);
  }
  return [...byId.values()];
}

// Saved trails are rounded to ~1 m — plenty for a dashed line, and it keeps an
// offline pack's trail tiles small.
function roundTrail(trail: Trail): Trail {
  return {
    ...trail,
    positions: trail.positions.map(
      ([lat, lng]) => [Math.round(lat * 1e5) / 1e5, Math.round(lng * 1e5) / 1e5] as [number, number],
    ),
  };
}

/**
 * Offline packs save trails per zoom-13 tile (about 3.6 km across in PA):
 * coarse enough that a hunt area is a handful of queries, fine enough that a
 * tile's answer stays small. Only saved while the Trails layer is on.
 */
export const TRAILS_OFFLINE_SOURCE: OfflineTileSource = {
  kind: "query",
  query: "trails",
  url: `${TRAILS_USGS_BASE}?di-offline=trails-v1`,
  minNativeZoom: 13,
  maxNativeZoom: 13,
  // Overpass is a shared community server: a hunt area or a zoom-13 view is a
  // dozen-odd tiles; much past that the layer is left out of the pack.
  maxTiles: 40,
};

/** What one saved trails tile holds. */
export type SavedTrailsTile = { trails: Trail[] };

// Overpass mirrors allow a couple of concurrent requests per client; a pack
// download runs six workers, so its Overpass calls go one at a time.
let overpassQueue: Promise<unknown> = Promise.resolve();
function queueOverpass<T>(run: () => Promise<T>): Promise<T> {
  const next = overpassQueue.then(run, run);
  overpassQueue = next.catch(() => undefined);
  return next;
}

/**
 * Both sources for one offline tile's bbox. Throws when neither answered, so
 * the tile counts as missed and saving the area again fills it in.
 */
export async function loadTrailsForBounds(
  bounds: { south: number; west: number; north: number; east: number },
  signal?: AbortSignal,
): Promise<SavedTrailsTile> {
  const { south, west, north, east } = bounds;
  const timeoutMs = 25_000;
  const [usgs, osm] = await Promise.allSettled([
    fetchUsgsTrails(`${west},${south},${east},${north}`, signal, timeoutMs),
    queueOverpass(() =>
      fetchOsmTrails(overpassQuery(`${south},${west},${north},${east}`), signal, timeoutMs),
    ),
  ]);
  if (usgs.status === "rejected" && osm.status === "rejected") {
    throw new Error("Trails unavailable");
  }
  const lists = [usgs, osm].map((r) => (r.status === "fulfilled" ? r.value : []));
  return { trails: mergeTrails(lists).map(roundTrail) };
}

/** Trails from saved offline tiles, or [] for anything malformed. */
export function trailsFromSavedTiles(tiles: unknown[]): Trail[] {
  const lists: Trail[][] = [];
  for (const tile of tiles) {
    const trails = (tile as Partial<SavedTrailsTile> | null)?.trails;
    if (Array.isArray(trails)) {
      lists.push(
        trails.filter(
          (t): t is Trail =>
            Boolean(t) && typeof t.id === "string" && Array.isArray(t.positions) && t.positions.length >= 2,
        ),
      );
    }
  }
  return mergeTrails(lists);
}

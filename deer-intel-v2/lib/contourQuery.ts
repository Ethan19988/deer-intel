// Elevation numbers for the contour overlay: the live query behind
// components/map/ContourLabels.tsx, and the per-tile version offline packs
// save so a saved area keeps its elevation labels with no signal.
//
// The numbers come from the USGS National Map contour service's "Normal Index
// Contours" layer (public domain): index lines carry the elevations, ~100 ft
// apart on a 20-ft base.

import type { OfflineTileSource } from "@/lib/offlineMaps";

export const CONTOUR_QUERY_SERVICE =
  "https://carto.nationalmap.gov/arcgis/rest/services/contours/MapServer";
// "Normal Index Contours" (large-scale, active at zoom 16+). Field name is
// lowercase here (the 100-ft/50-ft group layers use uppercase), so it's read
// case-tolerantly.
const LAYERS = [25];

export type ContourBounds = { south: number; west: number; north: number; east: number };

/** One index-contour run: its elevation and a (generalized) line of [lng, lat]. */
export type ContourSegment = { elev: number; pts: [number, number][] };

export type ContourLabel = { id: string; lat: number; lng: number; text: string };

export function readElevation(attrs: Record<string, unknown> | undefined): number | null {
  if (!attrs) return null;
  for (const key of Object.keys(attrs)) {
    if (key.toLowerCase() === "contourelevation") {
      const v = attrs[key];
      if (typeof v === "number" && Number.isFinite(v)) return v;
    }
  }
  return null;
}

/**
 * Index-contour segments in a box. `offset` (degrees) generalizes the lines —
 * only points to place labels on are needed. Throws on network/service error.
 */
export async function fetchContourSegments(
  b: ContourBounds,
  offset: number,
  signal?: AbortSignal,
): Promise<ContourSegment[]> {
  const bbox = `${b.west},${b.south},${b.east},${b.north}`;
  const segments: ContourSegment[] = [];
  await Promise.all(
    LAYERS.map(async (layer) => {
      const url =
        `${CONTOUR_QUERY_SERVICE}/${layer}/query?where=1%3D1` +
        `&geometry=${encodeURIComponent(bbox)}` +
        `&geometryType=esriGeometryEnvelope&inSR=4326` +
        `&spatialRel=esriSpatialRelIntersects&outFields=contourelevation` +
        `&returnGeometry=true&maxAllowableOffset=${offset}` +
        `&outSR=4326&f=json&resultRecordCount=250`;
      const res = await fetch(url, { signal });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = (await res.json()) as {
        error?: unknown;
        features?: Array<{
          attributes?: Record<string, unknown>;
          geometry?: { paths?: unknown };
        }>;
      };
      if (json.error) throw new Error("contour service error");
      for (const f of json.features ?? []) {
        const elev = readElevation(f.attributes);
        const paths = f.geometry?.paths;
        if (elev == null || !Array.isArray(paths)) continue;
        for (const path of paths) {
          if (Array.isArray(path)) segments.push({ elev, pts: path as [number, number][] });
        }
      }
    }),
  );
  return segments;
}

// Keep the elevation numbers sparse so they don't crowd the map: fewer labels
// overall, spread on a coarse grid, and each distinct elevation capped so a
// single winding contour can't stamp its number across the whole view.
export const CONTOUR_MAX_LABELS = 24;
export const CONTOUR_LABEL_GRID = 6;
export const CONTOUR_MAX_PER_ELEV = 3;

/** Thin segments into at most CONTOUR_MAX_LABELS evenly spread labels for a view. */
export function pickContourLabels(segments: ContourSegment[], b: ContourBounds): ContourLabel[] {
  // Grid in degrees; close enough to even pixel spacing.
  const cellLat = (b.north - b.south) / CONTOUR_LABEL_GRID;
  const cellLng = (b.east - b.west) / CONTOUR_LABEL_GRID;
  if (!(cellLat > 0) || !(cellLng > 0)) return [];
  const seen = new Set<string>();
  const elevCount = new Map<number, number>();
  const next: ContourLabel[] = [];
  for (const seg of segments) {
    for (const pt of seg.pts) {
      const [lng, lat] = pt;
      if (lat < b.south || lat > b.north || lng < b.west || lng > b.east) continue;
      const key = `${Math.round(lat / cellLat)}_${Math.round(lng / cellLng)}`;
      if (seen.has(key)) continue;
      if ((elevCount.get(seg.elev) ?? 0) >= CONTOUR_MAX_PER_ELEV) continue;
      seen.add(key);
      elevCount.set(seg.elev, (elevCount.get(seg.elev) ?? 0) + 1);
      next.push({ id: `${seg.elev}-${key}`, lat, lng, text: `${seg.elev}` });
      if (next.length >= CONTOUR_MAX_LABELS) return next;
    }
  }
  return next;
}

/**
 * Offline packs save contour segments per zoom-15 tile (~0.9 km across): the
 * labels show from zoom 16, where a phone screen spans a tile or two, so this
 * keeps each saved answer small and the label density close to live. Only
 * saved while the Contours overlay is on.
 */
export const CONTOUR_LABELS_OFFLINE_SOURCE: OfflineTileSource = {
  kind: "query",
  query: "contour-labels",
  url: `${CONTOUR_QUERY_SERVICE}/25?di-offline=contour-labels-v1`,
  minNativeZoom: 15,
  maxNativeZoom: 15,
  // ~140 km² — well past a hunt area; a zoomed-out view leaves it out.
  maxTiles: 160,
};

/** What one saved contour tile holds. */
export type SavedContourTile = { segments: ContourSegment[] };

/** One offline tile's segments, generalized about as much as a zoom-16 view. */
export async function loadContourSegmentsForBounds(
  b: ContourBounds,
  signal?: AbortSignal,
): Promise<SavedContourTile> {
  // A zoom-16 view is ~2 tiles of this size wide; live uses width / 120.
  const offset = ((b.east - b.west) * 2) / 120;
  const segments = await fetchContourSegments(b, offset, signal);
  return {
    segments: segments.map((seg) => ({
      elev: seg.elev,
      pts: seg.pts.map(
        ([lng, lat]) => [Math.round(lng * 1e5) / 1e5, Math.round(lat * 1e5) / 1e5] as [number, number],
      ),
    })),
  };
}

/** Segments from saved offline tiles, skipping anything malformed. */
export function segmentsFromSavedTiles(tiles: unknown[]): ContourSegment[] {
  const out: ContourSegment[] = [];
  for (const tile of tiles) {
    const segments = (tile as Partial<SavedContourTile> | null)?.segments;
    if (!Array.isArray(segments)) continue;
    for (const seg of segments) {
      if (seg && typeof seg.elev === "number" && Array.isArray(seg.pts)) out.push(seg);
    }
  }
  return out;
}

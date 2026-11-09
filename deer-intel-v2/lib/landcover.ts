import type { LatLng } from "@/lib/movementGridTypes";

// USGS NLCD land cover + the movement-grid geometry it is sampled on.
// Pure and dependency-free so both /api/movement-grid (server) and
// lib/movementGridClient (browser) can share it.

// ---------------------------------------------------------------------------
// NLCD legend
// ---------------------------------------------------------------------------

export type NlcdClass = { code: number; name: string; rgb: [number, number, number] };

/**
 * CONUS NLCD classes with the colors the MRLC GeoServer renders them in
 * (from GetLegendGraphic on mrlc_display:NLCD_2021_Land_Cover_L48). Alaska-only
 * classes (51, 72–74) are left out so nothing in PA can snap to them.
 */
export const NLCD_CLASSES: readonly NlcdClass[] = [
  { code: 11, name: "Open water", rgb: [0x47, 0x6b, 0xa0] },
  { code: 12, name: "Perennial ice/snow", rgb: [0xd1, 0xdd, 0xf9] },
  { code: 21, name: "Developed, open space", rgb: [0xdd, 0xc9, 0xc9] },
  { code: 22, name: "Developed, low intensity", rgb: [0xd8, 0x93, 0x82] },
  { code: 23, name: "Developed, medium intensity", rgb: [0xed, 0x00, 0x00] },
  { code: 24, name: "Developed, high intensity", rgb: [0xaa, 0x00, 0x00] },
  { code: 31, name: "Barren land", rgb: [0xb2, 0xad, 0xa3] },
  { code: 41, name: "Deciduous forest", rgb: [0x68, 0xaa, 0x63] },
  { code: 42, name: "Evergreen forest", rgb: [0x1c, 0x63, 0x30] },
  { code: 43, name: "Mixed forest", rgb: [0xb5, 0xc9, 0x8e] },
  { code: 52, name: "Shrub/scrub", rgb: [0xcc, 0xba, 0x7c] },
  { code: 71, name: "Grassland/herbaceous", rgb: [0xe2, 0xe2, 0xc1] },
  { code: 81, name: "Pasture/hay", rgb: [0xdb, 0xd8, 0x3d] },
  { code: 82, name: "Cultivated crops", rgb: [0xaa, 0x70, 0x28] },
  { code: 90, name: "Woody wetlands", rgb: [0xba, 0xd8, 0xea] },
  { code: 95, name: "Emergent herbaceous wetlands", rgb: [0x70, 0xa3, 0xba] },
];

const BY_CODE = new Map(NLCD_CLASSES.map((c) => [c.code, c]));

export function nlcdClassName(code: number): string {
  return BY_CODE.get(code)?.name ?? "Unknown";
}

/** Upland forest (41/42/43) — bedding and travel cover. */
export function isForest(code: number): boolean {
  return code === 41 || code === 42 || code === 43;
}
/** Open food: pasture/hay, crops, grassland. */
export function isOpenFood(code: number): boolean {
  return code === 81 || code === 82 || code === 71;
}
/** Shrub/scrub — clearcut regrowth, prime bedding. */
export function isShrubRegen(code: number): boolean {
  return code === 52;
}
/** Open water. Wetlands (90/95) are cover, not water. */
export function isWater(code: number): boolean {
  return code === 11;
}
export function isDeveloped(code: number): boolean {
  return code >= 21 && code <= 24;
}

/** Squared RGB distance beyond which a pixel is "not an NLCD color" (≈ 48 per channel-ish). */
const MAX_COLOR_DIST_SQ = 60 * 60;

/**
 * NLCD class code for a rendered pixel color, or 0 when the pixel is
 * transparent (no data / outside coverage) or nowhere near a legend color.
 */
export function nlcdClassForColor(r: number, g: number, b: number, a = 255): number {
  if (a < 128) return 0;
  let best = 0;
  let bestDist = Infinity;
  for (const c of NLCD_CLASSES) {
    const dr = r - c.rgb[0];
    const dg = g - c.rgb[1];
    const db = b - c.rgb[2];
    const d = dr * dr + dg * dg + db * db;
    if (d < bestDist) {
      bestDist = d;
      best = c.code;
    }
  }
  return bestDist <= MAX_COLOR_DIST_SQ ? best : 0;
}

/**
 * Classify a decoded RGBA image (row 0 = top/north, as a map image comes back)
 * into a row-major class array with row 0 = SOUTH, matching MovementGrid.
 */
export function classifyLandcoverImage(image: {
  width: number;
  height: number;
  data: Uint8Array;
}): number[] {
  const { width, height, data } = image;
  const out = new Array<number>(width * height);
  for (let y = 0; y < height; y += 1) {
    const gridRow = height - 1 - y;
    for (let x = 0; x < width; x += 1) {
      const i = (y * width + x) * 4;
      out[gridRow * width + x] = nlcdClassForColor(data[i], data[i + 1], data[i + 2], data[i + 3]);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// MRLC WMS
// ---------------------------------------------------------------------------

/** Verified 2026-11 via GetLegendGraphic (layer exists, 16-class colormap). */
export const NLCD_WMS_URL = "https://www.mrlc.gov/geoserver/mrlc_display/wms";
export const NLCD_WMS_LAYER = "NLCD_2021_Land_Cover_L48";
export const NLCD_LABEL = "NLCD 2021";

/**
 * GetMap URL for one pixel per grid cell. WMS 1.1.1 so the EPSG:4326 bbox is
 * plain lng,lat order (1.3.0 flips it to lat,lng). transparent=true keeps
 * no-data pixels at alpha 0 instead of a white that would snap to a class.
 */
export function nlcdGetMapUrl(bbox: GridBbox, cols: number, rows: number): string {
  const params = new URLSearchParams({
    service: "WMS",
    version: "1.1.1",
    request: "GetMap",
    layers: NLCD_WMS_LAYER,
    styles: "",
    srs: "EPSG:4326",
    bbox: [bbox.minLng, bbox.minLat, bbox.maxLng, bbox.maxLat].map((v) => v.toFixed(7)).join(","),
    width: String(cols),
    height: String(rows),
    format: "image/png",
    transparent: "true",
  });
  return `${NLCD_WMS_URL}?${params.toString()}`;
}

// ---------------------------------------------------------------------------
// Grid geometry
// ---------------------------------------------------------------------------

export type GridBbox = { minLat: number; minLng: number; maxLat: number; maxLng: number };

export const MOVEMENT_GRID_LIMITS = {
  /** Preferred cell size; grows to keep within maxCells. */
  targetCellM: 40,
  /** Max rows and max cols. */
  maxCells: 40,
  /** Square read around a bare point. */
  defaultSideM: 1400,
  /** Tiny outlines are padded so routes have room to form. */
  minSideM: 500,
  /** Largest bbox side the API accepts. */
  maxSideM: 6000,
} as const;

/** Meters per degree of latitude (and of longitude at the equator). */
export const M_PER_DEG = 111_320;

export function bboxSizeM(b: GridBbox): { heightM: number; widthM: number } {
  const midLat = (b.minLat + b.maxLat) / 2;
  return {
    heightM: (b.maxLat - b.minLat) * M_PER_DEG,
    widthM: (b.maxLng - b.minLng) * M_PER_DEG * Math.cos((midLat * Math.PI) / 180),
  };
}

export type GridPlan = {
  origin: LatLng;
  cellM: number;
  cellLat: number;
  cellLng: number;
  rows: number;
  cols: number;
  /** Exact extent the cells cover (≥ the requested bbox, centered on it). */
  bbox: GridBbox;
};

/**
 * Lay a square-celled grid over the bbox (or a defaultSideM square around the
 * point): ~40 m cells, at most 40×40, centered on the request.
 */
export function planMovementGrid(center: LatLng, bbox?: GridBbox | null): GridPlan {
  const L = MOVEMENT_GRID_LIMITS;
  let centerLat = center.lat;
  let centerLng = center.lng;
  let heightM: number = L.defaultSideM;
  let widthM: number = L.defaultSideM;
  if (bbox) {
    centerLat = (bbox.minLat + bbox.maxLat) / 2;
    centerLng = (bbox.minLng + bbox.maxLng) / 2;
    const size = bboxSizeM(bbox);
    heightM = Math.max(size.heightM, L.minSideM);
    widthM = Math.max(size.widthM, L.minSideM);
  }

  // Small epsilons keep float noise (e.g. 100.0000001 m) from bumping a size up.
  const cellM = Math.ceil(
    Math.max(L.targetCellM, heightM / L.maxCells, widthM / L.maxCells) - 1e-6,
  );
  const rows = clampInt(Math.ceil(heightM / cellM - 1e-6), 1, L.maxCells);
  const cols = clampInt(Math.ceil(widthM / cellM - 1e-6), 1, L.maxCells);
  const cellLat = cellM / M_PER_DEG;
  const cellLng = cellM / (M_PER_DEG * Math.cos((centerLat * Math.PI) / 180));
  const origin = {
    lat: centerLat - (rows * cellLat) / 2,
    lng: centerLng - (cols * cellLng) / 2,
  };
  return {
    origin,
    cellM,
    cellLat,
    cellLng,
    rows,
    cols,
    bbox: {
      minLat: origin.lat,
      minLng: origin.lng,
      maxLat: origin.lat + rows * cellLat,
      maxLng: origin.lng + cols * cellLng,
    },
  };
}

/** Center of cell (r, c); row 0 = south, col 0 = west. */
export function gridCellCenter(
  plan: Pick<GridPlan, "origin" | "cellLat" | "cellLng">,
  r: number,
  c: number,
): LatLng {
  return {
    lat: plan.origin.lat + (r + 0.5) * plan.cellLat,
    lng: plan.origin.lng + (c + 0.5) * plan.cellLng,
  };
}

/** Stable cache key for a plan (same ground + same cells → same key). */
export function gridPlanKey(plan: GridPlan): string {
  return `${plan.origin.lat.toFixed(5)},${plan.origin.lng.toFixed(5)}|${plan.cellM}|${plan.rows}x${plan.cols}`;
}

function clampInt(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, Math.round(v)));
}

// ---------------------------------------------------------------------------
// Request parsing (shared by the route and its tests)
// ---------------------------------------------------------------------------

export type MovementGridQuery =
  | { ok: true; center: LatLng; bbox: GridBbox | null }
  | { ok: false; error: string };

const MAX_ABS_LAT = 85; // cos(lat) blows up near the poles

/**
 * Validate ?lat&lng[&minLat&minLng&maxLat&maxLng]. All four bbox params or
 * none; a bbox must be ordered, contain no NaN, and be ≤ maxSideM per side.
 */
export function parseMovementGridQuery(params: URLSearchParams): MovementGridQuery {
  const lat = num(params.get("lat"));
  const lng = num(params.get("lng"));
  if (!isLat(lat) || !isLng(lng)) return { ok: false, error: "Invalid coordinate." };

  const raw = ["minLat", "minLng", "maxLat", "maxLng"].map((k) => params.get(k));
  const given = raw.filter((v) => v !== null && v !== "").length;
  if (given === 0) {
    // Point reads round to ~11 m so nearby requests share a cache entry.
    return { ok: true, center: { lat: round(lat, 4), lng: round(lng, 4) }, bbox: null };
  }
  if (given !== 4) return { ok: false, error: "Bounding box needs minLat, minLng, maxLat and maxLng." };

  const [minLat, minLng, maxLat, maxLng] = raw.map(num);
  if (!isLat(minLat) || !isLat(maxLat) || !isLng(minLng) || !isLng(maxLng)) {
    return { ok: false, error: "Invalid bounding box." };
  }
  if (maxLat <= minLat || maxLng <= minLng) {
    return { ok: false, error: "Bounding box min must be below max." };
  }
  const bbox = {
    minLat: round(minLat, 5),
    minLng: round(minLng, 5),
    maxLat: round(maxLat, 5),
    maxLng: round(maxLng, 5),
  };
  const { heightM, widthM } = bboxSizeM(bbox);
  const max = MOVEMENT_GRID_LIMITS.maxSideM;
  if (heightM > max || widthM > max) {
    return { ok: false, error: `Area too large — keep it under ${max / 1000} km per side.` };
  }
  return { ok: true, center: { lat: (minLat + maxLat) / 2, lng: (minLng + maxLng) / 2 }, bbox };
}

function num(v: string | null): number {
  return v === null || v.trim() === "" ? NaN : Number(v);
}
function isLat(v: number): boolean {
  return Number.isFinite(v) && Math.abs(v) <= MAX_ABS_LAT;
}
function isLng(v: number): boolean {
  return Number.isFinite(v) && Math.abs(v) <= 180;
}
function round(v: number, places: number): number {
  const f = 10 ** places;
  return Math.round(v * f) / f;
}

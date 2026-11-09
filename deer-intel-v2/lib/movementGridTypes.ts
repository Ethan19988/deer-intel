// Shared shapes for terrain-aware deer routes (movement layer v2).
//
//   /api/movement-grid  →  MovementGrid   (elevation + land cover per cell)
//   lib/deerRoutes      →  DeerRoutePlan  (routes, funnels, stand fits)
//   components/map/MovementLayer renders a DeerRoutePlan.

/** A regular lat/lng-aligned grid over the property. Row 0 is the SOUTH edge,
 * column 0 the WEST edge; cell (r, c) center = origin + (r + 0.5, c + 0.5)
 * cells. Arrays are row-major, length rows * cols. */
export type MovementGrid = {
  /** South-west corner of the grid (corner of cell 0,0). */
  origin: { lat: number; lng: number };
  /** Cell size in meters (same north-south and east-west). */
  cellM: number;
  /** Degrees per cell, so callers never redo the projection. */
  cellLat: number;
  cellLng: number;
  rows: number;
  cols: number;
  /** Elevation in meters; NaN where unknown. */
  elevation: number[];
  /** NLCD land-cover class code per cell (11 water, 21–24 developed, 31 barren,
   * 41 deciduous, 42 evergreen, 43 mixed, 52 shrub/scrub, 71 grassland,
   * 81 pasture/hay, 82 crops, 90 woody wetland, 95 herbaceous wetland),
   * 0 where unknown. Absent when land cover couldn't be read. */
  landcover?: number[];
  /** Where the data came from, for the map's source line. */
  source: string;
};

export type LatLng = { lat: number; lng: number };

/** One predicted travel route from a bed to a food/water source. */
export type DeerRoute = {
  id: string;
  /** Polyline following the cheapest walk over the grid, bed → food. */
  path: LatLng[];
  from: { kind: "bedding"; label: string; point: LatLng; source: "terrain" | "pin" };
  to: { kind: "food" | "water"; label: string; point: LatLng; source: "landcover" | "pin" };
  lengthM: number;
  /** 0–1: how likely deer use it (shorter, easier, through cover, camera-backed). */
  strength: number;
  /** Terrain the route uses, e.g. ["bench", "saddle", "draw"]. */
  uses: string[];
  /** Camera evidence this season near the route, if any. */
  camera?: { name: string; visits: number; period?: "AM" | "PM" | "mixed" };
};

/** A spot where several routes come together (a funnel) — a likely ambush. */
export type RouteFunnel = {
  id: string;
  point: LatLng;
  /** How many distinct routes pass within the funnel radius. */
  routeCount: number;
  routeIds: string[];
  /** What makes it a funnel: "saddle", "bench", "draw", "field edge", "cover edge"... */
  feature: string;
  score: number;
  /** Next sit's wind check for a hunter sitting here. */
  wind?: { ok: boolean; note: string };
  /** Nearest saved stand, if within 300 yd. */
  nearestStand?: { id: string; name: string; yards: number };
};

/** How a saved stand sits relative to the routes. */
export type StandRouteFit = {
  standId: string;
  standName: string;
  /** Distance to the closest route, yards. */
  yardsToRoute: number;
  routeIds: string[];
  /** On the next sit's wind: does scent blow onto the route(s) it covers? */
  wind?: { ok: boolean; note: string };
};

export type DeerRoutePlan = {
  routes: DeerRoute[];
  funnels: RouteFunnel[];
  stands: StandRouteFit[];
  /** Plain-language caveats ("Land cover unavailable — food from your pins only"). */
  notes: string[];
};

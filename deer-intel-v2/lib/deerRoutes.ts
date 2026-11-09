// Terrain-aware deer routes (movement layer v2): where deer most likely walk
// between where they bed and where they feed or drink, the funnels where those
// walks come together, and how each saved stand sits against them on the next
// sit's wind. Pure — the API route supplies the MovementGrid (elevation + NLCD
// land cover) and the map renders the DeerRoutePlan.
//
// Research basis (Penn State Deer-Forest Study, GPS-collared PA big-woods deer;
// deer.psu.edu): deer "bed high, travel low" — they bed on benches, spur
// points and steep sidehills with cover, and travel along benches, up draws and
// over ridges at saddles rather than climbing straight over a crest. They lean
// on cover (cut-over regen and shrub is the thickest) and cross open ground in
// daylight only at the end of a walk into a field. Those rules become a
// walking-cost surface (lib/deerRouteCost — every weight a named constant):
//
//   1. Cost per step = distance × slope multiplier (gentle 1 + deg/50, >25°
//      2.5×, >35° 6×; the steeper of the line walked and the sidehill it's on)
//      × land-cover × landform multipliers, + 8 m per metre climbed and 2 m per
//      metre dropped. Landform bonuses: saddle 0.6, bench 0.7, draw 0.8. Land
//      cover: forest 1, shrub/regen 0.85, woody wetland 1.15, marsh 2, barren 3,
//      open fields (71/81/82) 5 — waived within 2 cells of the route's own
//      destination — developed 4–25, water and unknown elevation impassable.
//   2. Beds: the top 6 terrain-read bedding features, Bedding pins, and up to
//      two regen (52) patches. Destinations: Food/Water pins, up to 6 field
//      edges (open food cells touching cover, spaced ≥200 m) and the same
//      regen patches as browse. Pairs closer than 60 m or farther than 1.6 km
//      are skipped.
//   3. Dijkstra (8-neighbour, binary heap), run in reverse from each
//      destination so its field-edge waiver is its own; each bed is routed to
//      its cheapest pin destination (hunter-verified food beats inferred food)
//      plus the cheapest remaining destination. Strength = 0.35 efficiency
//      (straight-line ÷ walking cost) + 0.25 shortness + 0.2 cover share +
//      0.2 camera visits within 150 m. Top 16 routes kept.
//   4. Funnels: cells within 60 m of routes from ≥2 different beds (ignoring
//      the first/last 90 m of each route), scored by the summed strength of
//      those routes, landforms breaking ties, clustered 250 m apart.
//   5. Wind: a hunter at a funnel or stand is "not ok" when a covered route
//      lies inside the downwind scent cone (lib/accessScent: ±30°, 365 m).
//
// These are predictions from the shape of the land, not tracked deer — the
// plan says so in its notes.

import {
  SCENT_REACH_M,
  sampleLeg,
  scentHitAt,
} from "@/lib/accessScent";
import {
  FLAG_BENCH,
  FLAG_COVER_EDGE,
  FLAG_DRAW,
  FLAG_FIELD_EDGE,
  FLAG_SADDLE,
  NEIGHBORS,
  REGEN_CLASS,
  buildCostSurface,
  isCover,
  isOpenFood,
  isPassable,
  landClassAt,
  landMultForGoal,
  leastCostTree,
  treePath,
  type CostSurface,
  type CostTree,
} from "@/lib/deerRouteCost";
import { pointInPolygon } from "@/lib/geofence";
import { distanceMeters } from "@/lib/movementPrediction";
import type {
  DeerRoute,
  DeerRoutePlan,
  LatLng,
  MovementGrid,
  RouteFunnel,
  StandRouteFit,
} from "@/lib/movementGridTypes";
import { getStandWindCheck } from "@/lib/standWind";
import type { TerrainMovementSet } from "@/lib/terrainMovement";
import { bearingBetween, degreesToCompass, toEightWind } from "@/lib/travelDirection";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// ---- Tunables --------------------------------------------------------------

/** Terrain-read bedding features used (highest score first). */
export const TERRAIN_BED_MAX = 6;
/** Regen (shrub/scrub) patches used as beds and as browse. */
export const REGEN_PATCH_MAX = 2;
/** Smallest regen patch, in cells, worth treating as cover/browse. */
export const REGEN_MIN_CELLS = 4;
export const MAX_BEDS = 10;
/** A terrain/regen bed this close to a Bedding pin is the same bed. */
export const BED_MERGE_M = 100;
/** Field-edge food points from land cover. */
export const FOOD_EDGE_MAX = 6;
export const FOOD_EDGE_SPACING_M = 200;
/** A field edge this close to a Food pin is the pin's field. */
export const FOOD_PIN_MERGE_M = 100;
/** Bed → destination pairs outside this band are skipped. */
export const MIN_PAIR_M = 60;
export const MAX_PAIR_M = 1600;
export const DESTS_PER_BED = 2;
export const MAX_ROUTES = 16;
/** A pin or point this many cells outside the grid is dropped, not snapped. */
const SNAP_OUTSIDE_CELLS = 2;
/** How far to look for passable ground when a point lands on water. */
const SNAP_SEARCH_CELLS = 3;

/** Strength weights (sum to 1). */
export const STRENGTH_WEIGHTS = { efficiency: 0.35, shortness: 0.25, cover: 0.2, camera: 0.2 };
/** Cover share assumed when land cover is missing. */
const UNKNOWN_COVER_SHARE = 0.5;
export const CAMERA_NEAR_M = 150;
/** Camera visits at which camera evidence maxes out. */
export const CAMERA_FULL_VISITS = 10;

export const FUNNEL_RADIUS_M = 60;
/** Every route trivially converges on its own bed and food; skip those ends. */
export const FUNNEL_ENDPOINT_CLEAR_M = 90;
export const FUNNEL_CLUSTER_M = 250;
export const MAX_FUNNELS = 8;
/** Tie-break bonus so a funnel sits on the landform that makes it. */
const FUNNEL_FEATURE_BONUS = { saddle: 1.2, bench: 1.12, draw: 1.08, fieldEdge: 1.05 };
export const NEAREST_STAND_MAX_YD = 300;
export const STAND_COVER_YD = 150;
/** Trail points closer than this are under the hunter; no meaningful bearing. */
const SCENT_MIN_M = 20;
/**
 * How far downwind a trail counts as "in your scent" for a trail ambush.
 * The walk-in check (lib/accessScent) uses 365 m because a bedded deer
 * catching scent drifting in at 400 yd will slip out; a deer walking a trail
 * reacts mainly when your scent crosses it inside ~150 m (≈160 yd) — beyond
 * that the stream has spread and lifted. Using 365 m here meant no funnel
 * with three trails fanning out ever had a workable side.
 */
export const AMBUSH_SCENT_REACH_M = 150;

const METERS_TO_YARDS = 1.0936;
const BEDDING_PIN_TYPES: PinType[] = ["Bedding", "Bedding Area"];
const FOOD_PIN_TYPES: PinType[] = ["Food", "Food Source"];
const WATER_PIN_TYPES: PinType[] = ["Water", "Water Source"];

export const NOTE_NO_BEDDING = "No bedding found — drop a Bedding pin or run a terrain read";
export const NOTE_NO_LANDCOVER = "Land cover unavailable — food from your pins only";
export const NOTE_NO_FOOD = "No food or water found — drop a Food or Water pin";
export const NOTE_NO_ELEVATION = "Elevation unavailable here — can't trace routes over the ground";
export const NOTE_NO_ROUTES = "No bed and food/water within a mile of each other could be linked";
export const NOTE_PREDICTION = "Routes are predictions from terrain and land cover, not tracked deer.";

// ---- Input -----------------------------------------------------------------

export type RouteCamera = {
  name: string;
  lat: number;
  lng: number;
  visitsAM: number;
  visitsPM: number;
  visits: number;
};

export type SitWind = { fromDeg: number; label: string; period: "AM" | "PM" };

export type DeerRoutePlanInput = {
  grid: MovementGrid;
  terrain?: TerrainMovementSet | null;
  pins: MapPin[];
  stands: Stand[];
  standLocations: Record<string, LatLng>;
  cameras?: RouteCamera[];
  sitWind?: SitWind | null;
  huntArea?: LatLng[];
};

// ---- Internals -------------------------------------------------------------

type Bed = {
  id: string;
  label: string;
  point: LatLng;
  source: "terrain" | "pin";
  cell: number;
};

type Dest = {
  id: string;
  label: string;
  kind: "food" | "water";
  point: LatLng;
  source: "landcover" | "pin";
  cell: number;
};

type XY = [number, number];

type BuiltRoute = {
  route: DeerRoute;
  bedId: string;
  cells: number[];
  xy: XY[];
};

const round2 = (value: number) => Math.round(value * 100) / 100;
const clamp01 = (value: number) => Math.min(1, Math.max(0, value));
const toYards = (meters: number) => Math.round(meters * METERS_TO_YARDS);

function cellCenter(grid: MovementGrid, cell: number): LatLng {
  const r = Math.floor(cell / grid.cols);
  const c = cell % grid.cols;
  return {
    lat: grid.origin.lat + (r + 0.5) * grid.cellLat,
    lng: grid.origin.lng + (c + 0.5) * grid.cellLng,
  };
}

/** Local metres east/north of the grid origin (the grid's own projection). */
function toXY(grid: MovementGrid, point: LatLng): XY {
  return [
    ((point.lng - grid.origin.lng) / grid.cellLng) * grid.cellM,
    ((point.lat - grid.origin.lat) / grid.cellLat) * grid.cellM,
  ];
}

function segmentDistance(p: XY, a: XY, b: XY): number {
  const dx = b[0] - a[0];
  const dy = b[1] - a[1];
  const lengthSq = dx * dx + dy * dy;
  const t = lengthSq === 0 ? 0 : clamp01(((p[0] - a[0]) * dx + (p[1] - a[1]) * dy) / lengthSq);
  return Math.hypot(p[0] - (a[0] + t * dx), p[1] - (a[1] + t * dy));
}

function polylineDistance(p: XY, line: XY[]): number {
  if (line.length === 1) return Math.hypot(p[0] - line[0][0], p[1] - line[0][1]);
  let best = Infinity;
  for (let i = 0; i < line.length - 1; i += 1) {
    best = Math.min(best, segmentDistance(p, line[i], line[i + 1]));
  }
  return best;
}

/** Nearest passable cell to a point, or null when it's off the grid. */
function snapToCell(surface: CostSurface, point: LatLng): number | null {
  const { grid, rows, cols } = surface;
  const rawR = Math.floor((point.lat - grid.origin.lat) / grid.cellLat);
  const rawC = Math.floor((point.lng - grid.origin.lng) / grid.cellLng);
  if (!Number.isFinite(rawR) || !Number.isFinite(rawC)) return null;
  if (
    rawR < -SNAP_OUTSIDE_CELLS ||
    rawC < -SNAP_OUTSIDE_CELLS ||
    rawR > rows - 1 + SNAP_OUTSIDE_CELLS ||
    rawC > cols - 1 + SNAP_OUTSIDE_CELLS
  ) {
    return null;
  }
  const r0 = Math.min(rows - 1, Math.max(0, rawR));
  const c0 = Math.min(cols - 1, Math.max(0, rawC));

  let best: number | null = null;
  let bestDistance = Infinity;
  for (let r = r0 - SNAP_SEARCH_CELLS; r <= r0 + SNAP_SEARCH_CELLS; r += 1) {
    for (let c = c0 - SNAP_SEARCH_CELLS; c <= c0 + SNAP_SEARCH_CELLS; c += 1) {
      if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
      const cell = r * cols + c;
      if (!isPassable(surface, cell)) continue;
      const d = Math.hypot(r - r0, c - c0);
      if (d < bestDistance) {
        bestDistance = d;
        best = cell;
      }
    }
  }
  return best;
}

function makeAreaTest(huntArea: LatLng[] | undefined): (point: LatLng) => boolean {
  if (!huntArea || huntArea.length < 3) return () => true;
  return (point) => pointInPolygon(point.lat, point.lng, huntArea);
}

function pinLabel(pin: MapPin): string {
  const foodKind = (pin as MapPin & { foodKind?: string }).foodKind?.trim();
  return pin.name?.trim() || foodKind || pin.notes?.trim() || pin.type;
}

/** Connected regen (shrub/scrub) patches, biggest first, as their middle cell. */
function regenPatches(surface: CostSurface): Array<{ cell: number; size: number }> {
  const { grid, rows, cols } = surface;
  if (!surface.hasLandcover) return [];
  const seen = new Uint8Array(rows * cols);
  const patches: Array<{ cell: number; size: number }> = [];

  for (let start = 0; start < rows * cols; start += 1) {
    if (seen[start] || landClassAt(grid, start) !== REGEN_CLASS || !isPassable(surface, start)) {
      continue;
    }
    const members: number[] = [];
    const stack = [start];
    seen[start] = 1;
    while (stack.length > 0) {
      const cell = stack.pop() as number;
      members.push(cell);
      const r = Math.floor(cell / cols);
      const c = cell % cols;
      for (const [dr, dc] of NEIGHBORS) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        const next = nr * cols + nc;
        if (seen[next] || landClassAt(grid, next) !== REGEN_CLASS) continue;
        seen[next] = 1;
        stack.push(next);
      }
    }
    if (members.length < REGEN_MIN_CELLS) continue;

    // The member nearest the patch centroid (always inside the patch).
    const meanR = members.reduce((sum, cell) => sum + Math.floor(cell / cols), 0) / members.length;
    const meanC = members.reduce((sum, cell) => sum + (cell % cols), 0) / members.length;
    let middle = members[0];
    let bestDistance = Infinity;
    for (const cell of members) {
      const d = Math.hypot(Math.floor(cell / cols) - meanR, (cell % cols) - meanC);
      if (d < bestDistance) {
        bestDistance = d;
        middle = cell;
      }
    }
    patches.push({ cell: middle, size: members.length });
  }

  return patches.sort((a, b) => b.size - a.size).slice(0, REGEN_PATCH_MAX);
}

function collectBeds(
  surface: CostSurface,
  terrain: TerrainMovementSet | null | undefined,
  pins: MapPin[],
  regen: Array<{ cell: number; size: number }>,
  inArea: (point: LatLng) => boolean,
): Bed[] {
  const beds: Bed[] = [];
  const add = (bed: Omit<Bed, "cell">) => {
    if (beds.length >= MAX_BEDS) return;
    if (beds.some((other) => distanceMeters(other.point, bed.point) < BED_MERGE_M)) return;
    const cell = snapToCell(surface, bed.point);
    if (cell === null) return;
    beds.push({ ...bed, cell });
  };

  // Hunter-dropped beds first: they're ground truth and win any merge.
  for (const pin of pins) {
    if (!BEDDING_PIN_TYPES.includes(pin.type)) continue;
    add({ id: `pin-${pin.id}`, label: pinLabel(pin), point: { lat: pin.lat, lng: pin.lng }, source: "pin" });
  }

  const terrainBeds = (terrain?.features ?? [])
    .flatMap((feature, order) => {
      if (feature.kind !== "bedding" || feature.polygon.length === 0) return [];
      const lat = feature.polygon.reduce((sum, [pLat]) => sum + pLat, 0) / feature.polygon.length;
      const lng = feature.polygon.reduce((sum, [, pLng]) => sum + pLng, 0) / feature.polygon.length;
      const point = { lat, lng };
      // Pipeline output is already ranked; an explicit score (if present) wins.
      const score = (feature as { score?: number }).score;
      return [{ feature, point, order, score: typeof score === "number" ? score : null, inside: inArea(point) }];
    })
    .filter((bed) => snapToCell(surface, bed.point) !== null)
    .sort((a, b) => {
      if (a.inside !== b.inside) return a.inside ? -1 : 1;
      if (a.score !== null && b.score !== null && a.score !== b.score) return b.score - a.score;
      return a.order - b.order;
    })
    .slice(0, TERRAIN_BED_MAX);

  for (const bed of terrainBeds) {
    add({ id: `terrain-${bed.feature.id}`, label: bed.feature.title, point: bed.point, source: "terrain" });
  }

  regen.forEach((patch, index) => {
    add({
      id: `regen-${index + 1}`,
      label: "Regen thicket",
      point: cellCenter(surface.grid, patch.cell),
      source: "terrain",
    });
  });

  return beds;
}

const EDGE_LABEL: Record<number, string> = {
  71: "Grassy opening edge",
  81: "Hay field edge",
  82: "Crop field edge",
};

function collectDests(
  surface: CostSurface,
  pins: MapPin[],
  regen: Array<{ cell: number; size: number }>,
  inArea: (point: LatLng) => boolean,
): Dest[] {
  const { grid, rows, cols } = surface;
  const dests: Dest[] = [];

  for (const pin of pins) {
    const kind = FOOD_PIN_TYPES.includes(pin.type)
      ? "food"
      : WATER_PIN_TYPES.includes(pin.type)
        ? "water"
        : null;
    if (!kind) continue;
    const point = { lat: pin.lat, lng: pin.lng };
    const cell = snapToCell(surface, point);
    if (cell === null) continue;
    dests.push({ id: `pin-${pin.id}`, label: pinLabel(pin), kind, point, source: "pin", cell });
  }
  const foodPins = dests.filter((dest) => dest.kind === "food");

  if (!surface.hasLandcover) return dests;

  // Field edges: open food cells touching cover, ranked by how much field is
  // behind them (a bigger field draws more deer), hunt area first.
  const edges: Array<{ cell: number; point: LatLng; weight: number }> = [];
  for (let cell = 0; cell < rows * cols; cell += 1) {
    if (!isOpenFood(landClassAt(grid, cell)) || !isPassable(surface, cell)) continue;
    if (!(surface.flags[cell] & FLAG_FIELD_EDGE)) continue;
    const r = Math.floor(cell / cols);
    const c = cell % cols;
    let open = 0;
    for (let dr = -3; dr <= 3; dr += 1) {
      for (let dc = -3; dc <= 3; dc += 1) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= rows || nc >= cols) continue;
        if (isOpenFood(landClassAt(grid, nr * cols + nc))) open += 1;
      }
    }
    const point = cellCenter(grid, cell);
    edges.push({ cell, point, weight: open + (inArea(point) ? 100 : 0) });
  }
  edges.sort((a, b) => b.weight - a.weight || a.cell - b.cell);

  const picked: typeof edges = [];
  for (const edge of edges) {
    if (picked.length >= FOOD_EDGE_MAX) break;
    if (picked.some((other) => distanceMeters(other.point, edge.point) < FOOD_EDGE_SPACING_M)) continue;
    if (foodPins.some((pin) => distanceMeters(pin.point, edge.point) < FOOD_PIN_MERGE_M)) continue;
    picked.push(edge);
  }
  picked.forEach((edge, index) => {
    dests.push({
      id: `edge-${index + 1}`,
      label: EDGE_LABEL[landClassAt(grid, edge.cell)] ?? "Field edge",
      kind: "food",
      point: edge.point,
      source: "landcover",
      cell: edge.cell,
    });
  });

  regen.forEach((patch, index) => {
    const point = cellCenter(grid, patch.cell);
    if (foodPins.some((pin) => distanceMeters(pin.point, point) < FOOD_PIN_MERGE_M)) return;
    dests.push({ id: `regen-${index + 1}`, label: "Regen browse", kind: "food", point, source: "landcover", cell: patch.cell });
  });

  return dests;
}

/** Drop interior cells where the walk keeps going the same direction. */
function simplifyCells(cells: number[], cols: number): number[] {
  if (cells.length <= 2) return cells.slice();
  const kept = [cells[0]];
  const step = (a: number, b: number) =>
    `${Math.floor(b / cols) - Math.floor(a / cols)},${(b % cols) - (a % cols)}`;
  for (let i = 1; i < cells.length - 1; i += 1) {
    if (step(cells[i - 1], cells[i]) !== step(cells[i], cells[i + 1])) kept.push(cells[i]);
  }
  kept.push(cells[cells.length - 1]);
  return kept;
}

function routeUses(surface: CostSurface, cells: number[]): string[] {
  let saddle = 0;
  let bench = 0;
  let draw = 0;
  let edge = 0;
  for (const cell of cells) {
    const flag = surface.flags[cell];
    if (flag & FLAG_SADDLE) saddle += 1;
    if (flag & FLAG_BENCH) bench += 1;
    if (flag & FLAG_DRAW) draw += 1;
    if (flag & FLAG_FIELD_EDGE) edge += 1;
  }
  const uses: string[] = [];
  if (saddle >= 1) uses.push("saddle");
  if (bench >= 2) uses.push("bench");
  if (draw >= 2) uses.push("draw");
  if (edge >= 1) uses.push("field edge");
  return uses;
}

function cameraPeriod(camera: RouteCamera): "AM" | "PM" | "mixed" {
  if (camera.visitsAM > 0 && camera.visitsAM >= 2 * camera.visitsPM) return "AM";
  if (camera.visitsPM > 0 && camera.visitsPM >= 2 * camera.visitsAM) return "PM";
  return "mixed";
}

function buildRoute(
  surface: CostSurface,
  bed: Bed,
  dest: Dest,
  cells: number[],
  pathCost: number,
  cameras: RouteCamera[],
): BuiltRoute {
  const { grid } = surface;
  const vertices = simplifyCells(cells, grid.cols);
  const path: LatLng[] = vertices.map((cell) => cellCenter(grid, cell));
  path[0] = bed.point;
  path[path.length - 1] = dest.point;
  const xy = path.map((point) => toXY(grid, point));

  let lengthM = 0;
  for (let i = 0; i < path.length - 1; i += 1) lengthM += distanceMeters(path[i], path[i + 1]);

  const straight = distanceMeters(bed.point, dest.point);
  const efficiency = pathCost > 0 ? clamp01(straight / pathCost) : 1;
  const shortness = clamp01(1 - lengthM / MAX_PAIR_M);
  const cover = surface.hasLandcover
    ? cells.filter((cell) => isCover(landClassAt(grid, cell))).length / cells.length
    : UNKNOWN_COVER_SHARE;

  let visits = 0;
  let best: RouteCamera | null = null;
  for (const camera of cameras) {
    if (!(camera.visits > 0)) continue;
    if (polylineDistance(toXY(grid, camera), xy) > CAMERA_NEAR_M) continue;
    visits += camera.visits;
    if (!best || camera.visits > best.visits) best = camera;
  }

  const strength =
    STRENGTH_WEIGHTS.efficiency * efficiency +
    STRENGTH_WEIGHTS.shortness * shortness +
    STRENGTH_WEIGHTS.cover * cover +
    STRENGTH_WEIGHTS.camera * clamp01(visits / CAMERA_FULL_VISITS);

  const route: DeerRoute = {
    id: `route-${bed.id}-${dest.id}`,
    path,
    from: { kind: "bedding", label: bed.label, point: bed.point, source: bed.source },
    to: { kind: dest.kind, label: dest.label, point: dest.point, source: dest.source },
    lengthM: Math.round(lengthM),
    strength: round2(clamp01(strength)),
    uses: routeUses(surface, cells),
  };
  if (best) route.camera = { name: best.name, visits: best.visits, period: cameraPeriod(best) };

  return { route, bedId: bed.id, cells, xy };
}

/** Cheapest pin destination, then the cheapest of what's left. */
function pickDestinations(
  candidates: Array<{ dest: Dest; cost: number }>,
): Array<{ dest: Dest; cost: number }> {
  const sorted = [...candidates].sort((a, b) => a.cost - b.cost);
  const picked: typeof sorted = [];
  const firstPin = sorted.find((candidate) => candidate.dest.source === "pin");
  if (firstPin) picked.push(firstPin);
  for (const candidate of sorted) {
    if (picked.length >= DESTS_PER_BED) break;
    if (!picked.includes(candidate)) picked.push(candidate);
  }
  return picked;
}

// ---- Wind ------------------------------------------------------------------

const COMPASS_WORD: Record<string, string> = {
  N: "north",
  NE: "northeast",
  E: "east",
  SE: "southeast",
  S: "south",
  SW: "southwest",
  W: "west",
  NW: "northwest",
};

function trailsPhrase(count: number): string {
  if (count <= 1) return "the trail";
  if (count === 2) return "both trails";
  return `all ${count} trails`;
}

/** Does a hunter at `point` blow scent onto any of `routes` on this wind? */
/**
 * The part of a bed → food path that deer travel before reaching `at`
 * (the path point nearest it): bed → there in the evening, food → there in the
 * morning.
 */
function approachStretch(simplified: LatLng[], at: LatLng, period: "AM" | "PM"): LatLng[] {
  if (simplified.length < 2) return simplified;
  // Paths are simplified to their turns, so a straight trail is just two
  // points; densify first so "nearest point" is really on the trail by you.
  const path: LatLng[] = [];
  for (let i = 0; i < simplified.length - 1; i += 1) {
    path.push(...sampleLeg(simplified[i], simplified[i + 1]));
  }
  path.push(simplified[simplified.length - 1]);
  let nearest = 0;
  let best = Infinity;
  path.forEach((p, index) => {
    const meters = distanceMeters(p, at);
    if (meters < best) {
      best = meters;
      nearest = index;
    }
  });
  return period === "PM" ? path.slice(0, nearest + 1) : path.slice(nearest);
}

function windCheckAt(
  point: LatLng,
  routes: BuiltRoute[],
  sitWind: SitWind,
  /** Where deer reach the hunter (the funnel); defaults to the hunter's spot. */
  anchor?: LatLng,
): { ok: boolean; note: string } {
  const downwind = (((sitWind.fromDeg + 180) % 360) + 360) % 360;
  const samples: LatLng[] = [];
  for (const { route } of routes) {
    // Only the stretch deer walk on their way TO you matters: scent drifting
    // over trail they've already passed doesn't spook them. Paths run bed →
    // food, so on an evening sit deer come from the bed end; in the morning
    // from the food end.
    const path = approachStretch(route.path, anchor ?? point, sitWind.period);
    if (path.length === 0) continue;
    for (let i = 0; i < path.length - 1; i += 1) samples.push(...sampleLeg(path[i], path[i + 1]));
    samples.push(path[path.length - 1]);
  }
  const trail = samples.filter((sample) => {
    const meters = distanceMeters(point, sample);
    return meters >= SCENT_MIN_M && meters <= Math.min(SCENT_REACH_M, AMBUSH_SCENT_REACH_M);
  });

  const hit = scentHitAt(point, trail, downwind, { bump: false });
  if (!hit) {
    return { ok: true, note: `Scent blows away from ${trailsPhrase(routes.length)} on a ${sitWind.label} wind` };
  }
  const bearing = bearingBetween(point.lat, point.lng, hit.bed.lat, hit.bed.lng);
  const direction = COMPASS_WORD[toEightWind(degreesToCompass(bearing))] ?? degreesToCompass(bearing);
  return {
    ok: false,
    note: `${sitWind.label} wind blows your scent across the trail ${toYards(hit.meters)} yd ${direction}`,
  };
}

/** A point `meters` from `from` on a compass bearing (flat-earth; fine at <100 m). */
function offsetPoint(from: LatLng, bearingDeg: number, meters: number): LatLng {
  const rad = (bearingDeg * Math.PI) / 180;
  const dLat = (meters * Math.cos(rad)) / 111_320;
  const dLng = (meters * Math.sin(rad)) / (111_320 * Math.cos((from.lat * Math.PI) / 180));
  return { lat: from.lat + dLat, lng: from.lng + dLng };
}

const SETUP_OFFSET_M = 37; // ~40 yd: bow range off the trail

/**
 * Where to sit for a funnel on this wind. Sitting ON converging trails always
 * puts some trail downwind, so instead look ~40 yd off the funnel in each
 * direction and pick a spot whose scent clears every trail — preferring the
 * downwind side (deer come to you, your scent goes away from them) and then a
 * crosswind side.
 */
function funnelSetup(
  point: LatLng,
  routes: BuiltRoute[],
  sitWind: SitWind,
): { ok: boolean; note: string } {
  const downwind = (((sitWind.fromDeg + 180) % 360) + 360) % 360;
  // Downwind first, then the two crosswind sides, then the quartering ones.
  const order = [0, 90, -90, 45, -45, 135, -135];
  for (const turn of order) {
    const bearing = (((downwind + turn) % 360) + 360) % 360;
    const spot = offsetPoint(point, bearing, SETUP_OFFSET_M);
    if (windCheckAt(spot, routes, sitWind, point).ok) {
      const side = COMPASS_WORD[toEightWind(degreesToCompass(bearing))] ?? degreesToCompass(bearing);
      return {
        ok: true,
        note: `Sit ~40 yd ${side} of the funnel — a ${sitWind.label} wind carries your scent away from ${trailsPhrase(routes.length)}`,
      };
    }
  }
  // Not on this wind — say which winds it does work on, so the hunter knows
  // when to come back to it.
  const good = EIGHT_WINDS.filter(([, deg]) => {
    const alt: SitWind = { fromDeg: deg, label: "", period: sitWind.period };
    const altDown = (deg + 180) % 360;
    return [0, 90, -90, 45, -45, 135, -135].some((turn) => {
      const spot = offsetPoint(point, (((altDown + turn) % 360) + 360) % 360, SETUP_OFFSET_M);
      return windCheckAt(spot, routes, alt, point).ok;
    });
  }).map(([label]) => label);
  return {
    ok: false,
    note: good.length
      ? `No spot keeps scent off ${trailsPhrase(routes.length)} on a ${sitWind.label} wind — works on ${good.join(", ")}`
      : `No spot within bow range keeps scent off ${trailsPhrase(routes.length)} on any wind — trails come in from every side`,
  };
}

const EIGHT_WINDS: Array<[string, number]> = [
  ["N", 0], ["NE", 45], ["E", 90], ["SE", 135], ["S", 180], ["SW", 225], ["W", 270], ["NW", 315],
];

// ---- Funnels ---------------------------------------------------------------

function funnelFeature(surface: CostSurface, cell: number): { label: string; bonus: number } {
  const { rows, cols, flags } = surface;
  const r0 = Math.floor(cell / cols);
  const c0 = cell % cols;
  // The cell itself first, then its neighbours.
  const order = [cell];
  for (const [dr, dc] of NEIGHBORS) {
    const r = r0 + dr;
    const c = c0 + dc;
    if (r >= 0 && c >= 0 && r < rows && c < cols) order.push(r * cols + c);
  }
  const has = (flag: number, list: number[]) => list.some((index) => flags[index] & flag);
  for (const list of [[cell], order]) {
    const own = list.length === 1;
    if (has(FLAG_SADDLE, list)) return { label: "saddle", bonus: own ? FUNNEL_FEATURE_BONUS.saddle : 1 };
    if (has(FLAG_BENCH, list)) return { label: "bench", bonus: own ? FUNNEL_FEATURE_BONUS.bench : 1 };
    if (has(FLAG_DRAW, list)) return { label: "draw", bonus: own ? FUNNEL_FEATURE_BONUS.draw : 1 };
    if (has(FLAG_FIELD_EDGE, list)) return { label: "field edge", bonus: own ? FUNNEL_FEATURE_BONUS.fieldEdge : 1 };
    if (has(FLAG_COVER_EDGE, list)) return { label: "cover edge", bonus: 1 };
  }
  return { label: "converging trails", bonus: 1 };
}

function findFunnels(surface: CostSurface, routes: BuiltRoute[]): Array<{
  cell: number;
  point: LatLng;
  members: BuiltRoute[];
  score: number;
  feature: string;
}> {
  const { grid, rows, cols } = surface;
  const size = rows * cols;
  const near: number[][] = Array.from({ length: size }, () => []);
  const reach = Math.ceil(FUNNEL_RADIUS_M / grid.cellM);
  const centers: XY[] = Array.from({ length: size }, (_, cell) => toXY(grid, cellCenter(grid, cell)));

  routes.forEach((built, routeIndex) => {
    const marked = new Uint8Array(size);
    const fromXY = built.xy[0];
    const toXYPoint = built.xy[built.xy.length - 1];
    for (const pathCell of built.cells) {
      const r0 = Math.floor(pathCell / cols);
      const c0 = pathCell % cols;
      for (let r = r0 - reach; r <= r0 + reach; r += 1) {
        for (let c = c0 - reach; c <= c0 + reach; c += 1) {
          if (r < 0 || c < 0 || r >= rows || c >= cols) continue;
          const cell = r * cols + c;
          if (marked[cell]) continue;
          if (Math.hypot(r - r0, c - c0) * grid.cellM > FUNNEL_RADIUS_M) continue;
          const center = centers[cell];
          if (
            Math.hypot(center[0] - fromXY[0], center[1] - fromXY[1]) < FUNNEL_ENDPOINT_CLEAR_M ||
            Math.hypot(center[0] - toXYPoint[0], center[1] - toXYPoint[1]) < FUNNEL_ENDPOINT_CLEAR_M
          ) {
            continue;
          }
          marked[cell] = 1;
          near[cell].push(routeIndex);
        }
      }
    }
  });

  const candidates: Array<{ cell: number; members: BuiltRoute[]; score: number; rank: number; feature: string }> = [];
  for (let cell = 0; cell < size; cell += 1) {
    if (near[cell].length < 2) continue;
    const members = near[cell].map((index) => routes[index]);
    // Two routes out of the same bed share their first stretch by construction;
    // a funnel is where walks from different beds come together.
    if (new Set(members.map((member) => member.bedId)).size < 2) continue;
    const score = members.reduce((sum, member) => sum + member.route.strength, 0);
    const feature = funnelFeature(surface, cell);
    const offTrail = members.reduce((sum, member) => sum + polylineDistance(centers[cell], member.xy), 0);
    candidates.push({
      cell,
      members,
      score,
      rank: score * feature.bonus - offTrail * 1e-4,
      feature: feature.label,
    });
  }
  candidates.sort((a, b) => b.rank - a.rank || a.cell - b.cell);

  const picked: Array<{ cell: number; point: LatLng; members: BuiltRoute[]; score: number; feature: string }> = [];
  for (const candidate of candidates) {
    if (picked.length >= MAX_FUNNELS) break;
    const center = centers[candidate.cell];
    if (
      picked.some((other) => {
        const otherCenter = centers[other.cell];
        return Math.hypot(center[0] - otherCenter[0], center[1] - otherCenter[1]) < FUNNEL_CLUSTER_M;
      })
    ) {
      continue;
    }
    picked.push({ ...candidate, point: cellCenter(grid, candidate.cell) });
  }
  return picked;
}

// ---- Plan ------------------------------------------------------------------

function emptyPlan(notes: string[]): DeerRoutePlan {
  return { routes: [], funnels: [], stands: [], notes };
}

export function buildDeerRoutePlan(input: DeerRoutePlanInput): DeerRoutePlan {
  const { grid, pins, sitWind } = input;
  const stands = input.stands ?? [];
  const cameras = input.cameras ?? [];
  const notes: string[] = [];

  const size = grid.rows * grid.cols;
  if (
    !(grid.rows > 0 && grid.cols > 0 && grid.cellM > 0) ||
    grid.elevation.length !== size ||
    !grid.elevation.some((value) => Number.isFinite(value))
  ) {
    return emptyPlan([NOTE_NO_ELEVATION]);
  }

  const surface = buildCostSurface(grid);
  if (!surface.hasLandcover) notes.push(NOTE_NO_LANDCOVER);

  const inArea = makeAreaTest(input.huntArea);
  const regen = regenPatches(surface);
  const beds = collectBeds(surface, input.terrain, pins, regen, inArea);
  if (beds.length === 0) return emptyPlan([NOTE_NO_BEDDING, ...notes]);

  const dests = collectDests(surface, pins, regen, inArea);
  if (dests.length === 0) return emptyPlan([NOTE_NO_FOOD, ...notes]);

  // One reverse search per destination (each with its own field-edge waiver)
  // prices the walk from every bed to it.
  const inRange = (bed: Bed, dest: Dest) => {
    const meters = distanceMeters(bed.point, dest.point);
    return meters >= MIN_PAIR_M && meters <= MAX_PAIR_M && dest.cell !== bed.cell;
  };
  const trees = new Map<string, CostTree>();
  for (const dest of dests) {
    if (!beds.some((bed) => inRange(bed, dest))) continue;
    trees.set(
      dest.id,
      leastCostTree(surface, dest.cell, { landMult: landMultForGoal(surface, dest.cell), reverse: true }),
    );
  }

  let built: BuiltRoute[] = [];
  for (const bed of beds) {
    const reachable = dests
      .filter((dest) => inRange(bed, dest))
      .map((dest) => ({ dest, cost: trees.get(dest.id)?.cost[bed.cell] ?? Infinity }))
      .filter((candidate) => Number.isFinite(candidate.cost));

    for (const { dest, cost } of pickDestinations(reachable)) {
      const tree = trees.get(dest.id);
      const cells = tree ? treePath(tree, dest.cell, bed.cell)?.reverse() : null;
      if (!cells || cells.length < 2) continue;
      built.push(buildRoute(surface, bed, dest, cells, cost, cameras));
    }
  }

  built = built
    .sort((a, b) => b.route.strength - a.route.strength || a.route.id.localeCompare(b.route.id))
    .slice(0, MAX_ROUTES);

  if (built.length === 0) {
    notes.push(NOTE_NO_ROUTES);
    return emptyPlan(notes);
  }

  // Stand fits.
  // Only stands on this grid: a stand saved under the wrong property (or far
  // outside the area read) would otherwise read "181,122 yd to nearest route".
  const gridMaxLat = grid.origin.lat + grid.rows * grid.cellLat;
  const gridMaxLng = grid.origin.lng + grid.cols * grid.cellLng;
  const standPoints = stands
    .map((stand) => ({ stand, point: input.standLocations?.[stand.id] }))
    .filter((entry): entry is { stand: Stand; point: LatLng } => Boolean(entry.point))
    .filter(
      ({ point }) =>
        point.lat >= grid.origin.lat &&
        point.lat <= gridMaxLat &&
        point.lng >= grid.origin.lng &&
        point.lng <= gridMaxLng,
    );

  const standFits: StandRouteFit[] = standPoints.map(({ stand, point }) => {
    const here = toXY(grid, point);
    const ranked = built
      .map((route) => ({ route, meters: polylineDistance(here, route.xy) }))
      .sort((a, b) => a.meters - b.meters);
    const covered = ranked.filter((entry) => toYards(entry.meters) <= STAND_COVER_YD);
    const fit: StandRouteFit = {
      standId: stand.id,
      standName: stand.name,
      yardsToRoute: toYards(ranked[0].meters),
      routeIds: covered.map((entry) => entry.route.route.id),
    };
    if (sitWind && covered.length > 0) {
      const wind = windCheckAt(point, covered.map((entry) => entry.route), sitWind);
      const compass = degreesToCompass(sitWind.fromDeg);
      if (getStandWindCheck(stand, compass).status === "avoid") {
        wind.ok = false;
        wind.note = `${wind.note}; your stand notes say avoid ${compass}`;
      }
      fit.wind = wind;
    }
    return fit;
  });

  // Funnels.
  const funnels: RouteFunnel[] = findFunnels(surface, built).map((found, index) => {
    const funnel: RouteFunnel = {
      id: `funnel-${index + 1}`,
      point: found.point,
      routeCount: found.members.length,
      routeIds: found.members.map((member) => member.route.id),
      feature: found.feature,
      score: round2(found.score),
    };
    if (sitWind) funnel.wind = funnelSetup(found.point, found.members, sitWind);

    let nearest: { id: string; name: string; yards: number } | null = null;
    for (const { stand, point } of standPoints) {
      const yards = toYards(distanceMeters(found.point, point));
      if (yards <= NEAREST_STAND_MAX_YD && (!nearest || yards < nearest.yards)) {
        nearest = { id: stand.id, name: stand.name, yards };
      }
    }
    if (nearest) funnel.nearestStand = nearest;
    return funnel;
  });

  notes.push(NOTE_PREDICTION);
  return { routes: built.map((entry) => entry.route), funnels, stands: standFits, notes };
}

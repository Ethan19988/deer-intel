// Predictive deer-heat surface — "where should deer be RIGHT NOW".
//
// Deliberately not a black-box raster: every hot zone is one of the app's
// existing, explainable predictions — terrain-read bedding / travel / saddles /
// refuge, the hunter's own bed-to-feed pin corridors, and logged camera
// activity — re-weighted for the current movement period. The heat map is a
// VIEW of those predictions through the clock:
//  - dawn: deer drift off feed back toward beds — travel lines and saddle
//    crossings run hottest, beds warm as they fill.
//  - midday: bedded — bedding and refuge ground carries the heat, travel cools.
//  - dusk: the bed-to-feed push — travel and pinches hottest, food warms.
//  - night: on the groceries — the food/water ends of pin corridors glow.
// The day's movement outlook (weather score) scales the whole surface, so a
// dead-still day reads muted and a cold-front prime day glows.

import type {
  MovementCorridor,
  MovementPeriod,
} from "@/lib/movementPrediction";
import type { TerrainKind, TerrainMovementSet } from "@/lib/terrainMovement";
import { isBedToFeedRoute } from "@/lib/terrainMovementData";

/** [latitude, longitude] — the order Leaflet expects. */
export type HeatPoint = [number, number];

/** Where a heat contribution came from — the tap-to-explain card keys off it. */
export type HeatSourceKind =
  | TerrainKind
  | "route"
  | "corridor"
  | "bed-pin"
  | "food"
  | "water"
  | "camera";

type HeatSourceBase = {
  weight: number;
  kind: HeatSourceKind;
  /** Short human line for the "why it's hot" card. */
  title: string;
};

/** One weighted contributor to the heat surface, in map coordinates. */
export type HeatSource = HeatSourceBase &
  (
    | { shape: "polygon"; ring: HeatPoint[] }
    | { shape: "line"; line: HeatPoint[]; widthM: number }
    | { shape: "spot"; point: HeatPoint; radiusM: number }
  );

// How hot each terrain landform runs in each period (0-1). Bedding/refuge own
// midday; travel and saddle crossings own the dawn/dusk transitions.
const TERRAIN_WEIGHT: Record<MovementPeriod, Record<TerrainKind, number>> = {
  dawn: { bedding: 0.75, travel: 1.0, pinch: 1.0, refuge: 0.4 },
  midday: { bedding: 1.0, travel: 0.3, pinch: 0.35, refuge: 0.85 },
  dusk: { bedding: 0.45, travel: 1.0, pinch: 1.0, refuge: 0.35 },
  night: { bedding: 0.25, travel: 0.55, pinch: 0.5, refuge: 0.2 },
};

// The food/water end of a pin corridor: a last bite at dawn, dead at midday,
// filling from dusk through the night.
const RESOURCE_WEIGHT: Record<MovementPeriod, number> = {
  dawn: 0.5,
  midday: 0.15,
  dusk: 0.9,
  night: 1.0,
};

// The bedding end of a pin corridor mirrors terrain bedding.
const PIN_BED_WEIGHT: Record<MovementPeriod, number> = {
  dawn: 0.75,
  midday: 1.0,
  dusk: 0.45,
  night: 0.25,
};

// Bed-to-feed least-cost routes are the "deer DO move here" lines, so they run
// a notch hotter than the generic benches/draws around them.
const ROUTE_BOOST = 1.15;

// Footprints (metres) for line widths and point falloffs — sized to how wide
// the real ground feature reads, not to look dramatic.
const TRAVEL_WIDTH_M = 55;
const CORRIDOR_WIDTH_M = 45;
const PINCH_RADIUS_M = 70;
const PIN_BED_RADIUS_M = 90;
const RESOURCE_RADIUS_M = 110;
const CAMERA_RADIUS_M = 120;

export type CameraHeatSpot = {
  lat: number;
  lng: number;
  name: string;
  /** 0-1, this camera's logged deer activity relative to the busiest camera. */
  activity: number;
};

export type DeerHeatInput = {
  terrain: TerrainMovementSet | null;
  corridors: MovementCorridor[];
  cameras: CameraHeatSpot[];
  period: MovementPeriod;
};

/**
 * Assemble the weighted heat contributors for the current period. Purely
 * data-in, data-out so the weighting stays testable and the canvas renderer
 * stays dumb.
 */
export function buildDeerHeatSources(input: DeerHeatInput): HeatSource[] {
  const { terrain, corridors, cameras, period } = input;
  const weights = TERRAIN_WEIGHT[period];
  const sources: HeatSource[] = [];

  for (const feature of terrain?.features ?? []) {
    const weight = weights[feature.kind];
    if (feature.kind === "bedding" || feature.kind === "refuge") {
      sources.push({
        shape: "polygon",
        ring: feature.polygon,
        weight,
        kind: feature.kind,
        title: feature.title,
      });
    } else if (feature.kind === "travel") {
      const route = isBedToFeedRoute(feature);
      sources.push({
        shape: "line",
        line: feature.line,
        widthM: TRAVEL_WIDTH_M,
        weight: Math.min(1, weight * (route ? ROUTE_BOOST : 1)),
        kind: route ? "route" : "travel",
        title: feature.title,
      });
    } else {
      sources.push({
        shape: "spot",
        point: feature.point,
        radiusM: PINCH_RADIUS_M,
        weight,
        kind: "pinch",
        title: feature.title,
      });
    }
  }

  // Pin corridors carry heat on the path plus a blob at whichever end the
  // period says deer are headed to (or resting at).
  for (const corridor of corridors) {
    const resourceName = corridor.resourceKind === "water" ? "water" : "food";
    sources.push({
      shape: "line",
      line: [
        [corridor.bedding.lat, corridor.bedding.lng],
        [corridor.resource.lat, corridor.resource.lng],
      ],
      widthM: CORRIDOR_WIDTH_M,
      weight: weights.travel * corridor.strength,
      kind: "corridor",
      title: `Your bed-to-${resourceName} pin corridor`,
    });
    sources.push({
      shape: "spot",
      point: [corridor.bedding.lat, corridor.bedding.lng],
      radiusM: PIN_BED_RADIUS_M,
      weight: PIN_BED_WEIGHT[period] * corridor.strength,
      kind: "bed-pin",
      title: "Your bedding pin",
    });
    sources.push({
      shape: "spot",
      point: [corridor.resource.lat, corridor.resource.lng],
      radiusM: RESOURCE_RADIUS_M,
      weight: RESOURCE_WEIGHT[period] * corridor.strength,
      kind: corridor.resourceKind,
      title: `Your ${resourceName} pin`,
    });
  }

  // Camera history is direct evidence of occupancy, so it counts in every
  // period — the busiest camera anchors the hottest ground.
  for (const camera of cameras) {
    if (camera.activity <= 0) continue;
    sources.push({
      shape: "spot",
      point: [camera.lat, camera.lng],
      radiusM: CAMERA_RADIUS_M,
      weight: 0.3 + 0.6 * Math.min(1, camera.activity),
      kind: "camera",
      title: `${camera.name} — logged deer activity`,
    });
  }

  return sources.filter((source) => source.weight > 0.02);
}

/**
 * Global brightness for the whole surface from the day's movement outlook
 * score (roughly -3..+8): a Prime cold-front day glows at full strength, a
 * dead day mutes everything rather than pretending deer are on their feet.
 */
export function outlookIntensity(score: number | null): number {
  if (score === null) return 0.85;
  return Math.min(1, Math.max(0.55, 0.6 + 0.05 * score));
}

/**
 * Stacked intensity below this renders (and taps) as nothing. One faint
 * out-of-period footprint sits under it; a feature in its prime period or any
 * real stack clears it — so the map shows only the ground worth looking at
 * instead of washing the whole tract in faint red. Shared by the renderer and
 * the tap gate so nothing paints that can't explain itself, and vice versa.
 */
export const DEER_HEAT_FLOOR = 0.32;

/** One-line legend read of what the heat means right now. */
export const PERIOD_HEAT_LINE: Record<MovementPeriod, string> = {
  dawn: "Dawn — deer sliding back to beds",
  midday: "Midday — deer holding in beds",
  dusk: "Dusk — deer pushing out to feed",
  night: "Night — deer on food and water",
};

// --- Tap-to-explain -----------------------------------------------------------
// Red on the surface is emergent: it appears where several predictions stack.
// Tapping a hot spot should therefore answer "which predictions?", so this
// re-evaluates the same sources at a single point (an approximation of the
// renderer's soft footprints) and returns the contributors, strongest first.

export type HeatContributor = {
  kind: HeatSourceKind;
  title: string;
  /** This source's contribution to the stack at the tapped point, 0-1. */
  share: number;
};

export type HeatExplanation = {
  /** Stacked intensity at the point, 0-1 (before the outlook scaling). */
  total: number;
  contributors: HeatContributor[];
};

// Matches the renderer's widest pass, so anywhere that visibly glows explains.
const LINE_REACH_FACTOR = 2.25; // half-width multiplier on a line's nominal width
const SPOT_REACH_FACTOR = 1.6;
const POLYGON_FEATHER_M = 100;

/** Contribution below this is invisible on the ramp — not worth listing. */
const MIN_SHARE = 0.05;

/**
 * What makes the surface warm at `lat,lng`. Returns null when the point is
 * effectively cold, so a tap on plain ground does nothing.
 */
export function explainDeerHeatAt(
  lat: number,
  lng: number,
  sources: HeatSource[],
): HeatExplanation | null {
  const contributors: HeatContributor[] = [];

  for (const source of sources) {
    let share = 0;
    if (source.shape === "spot") {
      const reach = source.radiusM * SPOT_REACH_FACTOR;
      const d = distanceM(lat, lng, source.point[0], source.point[1]);
      share = source.weight * Math.max(0, 1 - d / reach);
    } else if (source.shape === "line") {
      if (source.line.length < 2) continue;
      const reach = source.widthM * LINE_REACH_FACTOR;
      const d = distanceToPolylineM(lat, lng, source.line);
      share = source.weight * Math.max(0, 1 - d / reach) * 0.9;
    } else {
      if (source.ring.length < 3) continue;
      if (pointInRing(lat, lng, source.ring)) {
        share = source.weight;
      } else {
        const d = distanceToPolylineM(lat, lng, [...source.ring, source.ring[0]]);
        share = source.weight * Math.max(0, 1 - d / POLYGON_FEATHER_M) * 0.4;
      }
    }
    if (share >= MIN_SHARE) {
      contributors.push({ kind: source.kind, title: source.title, share });
    }
  }

  if (contributors.length === 0) return null;

  // The same physical thing can contribute several footprints (each corridor
  // drops a blob on the shared bedding pin) — merge them so the card lists one
  // line per real-world source.
  const merged = new Map<string, HeatContributor>();
  for (const contributor of contributors) {
    const key = `${contributor.kind}|${contributor.title}`;
    const existing = merged.get(key);
    if (existing) {
      existing.share = Math.min(1, existing.share + contributor.share);
    } else {
      merged.set(key, { ...contributor });
    }
  }
  const list = [...merged.values()].sort((a, b) => b.share - a.share);
  const total = Math.min(
    1,
    list.reduce((sum, c) => sum + c.share, 0),
  );
  return { total, contributors: list };
}

// Local equirectangular metres — plenty accurate at property scale.
function distanceM(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const mPerDegLat = 110_540;
  const mPerDegLng = 111_320 * Math.cos((aLat * Math.PI) / 180);
  const dx = (bLng - aLng) * mPerDegLng;
  const dy = (bLat - aLat) * mPerDegLat;
  return Math.hypot(dx, dy);
}

function distanceToPolylineM(
  lat: number,
  lng: number,
  line: HeatPoint[],
): number {
  const mPerDegLat = 110_540;
  const mPerDegLng = 111_320 * Math.cos((lat * Math.PI) / 180);
  const px = lng * mPerDegLng;
  const py = lat * mPerDegLat;

  let best = Infinity;
  for (let i = 0; i < line.length - 1; i++) {
    const ax = line[i][1] * mPerDegLng;
    const ay = line[i][0] * mPerDegLat;
    const bx = line[i + 1][1] * mPerDegLng;
    const by = line[i + 1][0] * mPerDegLat;
    const abx = bx - ax;
    const aby = by - ay;
    const lenSq = abx * abx + aby * aby;
    const t =
      lenSq === 0
        ? 0
        : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lenSq));
    best = Math.min(best, Math.hypot(px - (ax + t * abx), py - (ay + t * aby)));
  }
  return best;
}

/** Ray-cast point-in-polygon on the [lat,lng] ring. */
function pointInRing(lat: number, lng: number, ring: HeatPoint[]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [aLat, aLng] = ring[i];
    const [bLat, bLng] = ring[j];
    if (
      aLat > lat !== bLat > lat &&
      lng < ((bLng - aLng) * (lat - aLat)) / (bLat - aLat) + aLng
    ) {
      inside = !inside;
    }
  }
  return inside;
}

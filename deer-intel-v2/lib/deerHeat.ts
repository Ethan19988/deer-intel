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

/** One weighted contributor to the heat surface, in map coordinates. */
export type HeatSource =
  | { shape: "polygon"; ring: HeatPoint[]; weight: number }
  | { shape: "line"; line: HeatPoint[]; widthM: number; weight: number }
  | { shape: "spot"; point: HeatPoint; radiusM: number; weight: number };

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
      sources.push({ shape: "polygon", ring: feature.polygon, weight });
    } else if (feature.kind === "travel") {
      sources.push({
        shape: "line",
        line: feature.line,
        widthM: TRAVEL_WIDTH_M,
        weight: Math.min(1, weight * (isBedToFeedRoute(feature) ? ROUTE_BOOST : 1)),
      });
    } else {
      sources.push({
        shape: "spot",
        point: feature.point,
        radiusM: PINCH_RADIUS_M,
        weight,
      });
    }
  }

  // Pin corridors carry heat on the path plus a blob at whichever end the
  // period says deer are headed to (or resting at).
  for (const corridor of corridors) {
    sources.push({
      shape: "line",
      line: [
        [corridor.bedding.lat, corridor.bedding.lng],
        [corridor.resource.lat, corridor.resource.lng],
      ],
      widthM: CORRIDOR_WIDTH_M,
      weight: weights.travel * corridor.strength,
    });
    sources.push({
      shape: "spot",
      point: [corridor.bedding.lat, corridor.bedding.lng],
      radiusM: PIN_BED_RADIUS_M,
      weight: PIN_BED_WEIGHT[period] * corridor.strength,
    });
    sources.push({
      shape: "spot",
      point: [corridor.resource.lat, corridor.resource.lng],
      radiusM: RESOURCE_RADIUS_M,
      weight: RESOURCE_WEIGHT[period] * corridor.strength,
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

/** One-line legend read of what the heat means right now. */
export const PERIOD_HEAT_LINE: Record<MovementPeriod, string> = {
  dawn: "Dawn — deer sliding back to beds",
  midday: "Midday — deer holding in beds",
  dusk: "Dusk — deer pushing out to feed",
  night: "Night — deer on food and water",
};

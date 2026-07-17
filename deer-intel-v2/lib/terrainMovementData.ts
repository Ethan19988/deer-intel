// Stage 5 — per-property terrain data loader + Scout Picks.
//
// The terrain pipeline emits one `TerrainMovementSet` per property
// (terrain_movement.<name>.json). They are registered here; the map resolves
// the set for wherever the hunter is looking (active property or map center) so
// the right ground lights up without hardcoding a single import. As more sets
// are generated they just get added to TERRAIN_SETS.

import type {
  LatLng,
  TerrainKind,
  TerrainMovementFeature,
  TerrainMovementSet,
} from "@/lib/terrainMovement";
import { GENERATED_TERRAIN_SETS } from "@/lib/generated/terrainSets";

// Only pipeline-generated 1 m sets are pre-registered. Each is generated for the
// property's own drawn bbox, so it already covers the whole outline. Everything
// else falls through to the live per-property read (which now sizes itself to
// the hunt-area outline), instead of a hardcoded coarse sample that would pin
// the map to one small spot.
export const TERRAIN_SETS: TerrainMovementSet[] = [...GENERATED_TERRAIN_SETS];

// How close (km) a property/map center must be to a set's center to count as
// "this ground". Big-woods tracts are a mile or two across.
const MATCH_RADIUS_KM = 6;

type Point = { lat: number; lng: number };

/** The terrain set covering `point`, or null if none is near. */
export function resolveTerrainSet(
  point: Point | null | undefined,
): TerrainMovementSet | null {
  if (!point) return null;

  let best: { set: TerrainMovementSet; km: number } | null = null;
  for (const set of TERRAIN_SETS) {
    const km = haversineKm(point, { lat: set.center[0], lng: set.center[1] });
    if (km <= MATCH_RADIUS_KM && (!best || km < best.km)) best = { set, km };
  }
  return best ? best.set : null;
}

export type ScoutPick = {
  id: string;
  kind: TerrainKind;
  title: string;
  reason: string;
  windNote?: string;
  /** Metres to the nearest road (S1 security band), when the set carries it. */
  roadDistM?: number;
  point: LatLng;
  rank: number;
};

// Rank order for "where do I go?": saddle stands first (the payoff), then the
// bed-to-feed routes (where deer actually move bed<->feed), then the beds and
// the remaining travel web you scout to confirm them, then the refuge you work
// around. Bed-to-feed routes are emitted as `travel` features but carry the
// strongest signal, so they're pulled ahead of the generic benches/draws
// instead of being buried among them.
const KIND_PRIORITY: Record<TerrainKind, number> = {
  pinch: 0,
  bedding: 2,
  travel: 3,
  refuge: 4,
};
const ROUTE_PRIORITY = 1;

/**
 * A bed-to-feed least-cost route: a `travel` feature the pipeline keys
 * `<name>-route-<n>-<m>`. It reads as generic travel to the map, but ranks
 * higher because it's the "where deer DO move" corridor, not just terrain they
 * could use.
 */
export function isBedToFeedRoute(feature: {
  kind: TerrainKind;
  id: string;
}): boolean {
  return feature.kind === "travel" && feature.id.includes("-route-");
}

function pickPriority(feature: TerrainMovementFeature): number {
  return isBedToFeedRoute(feature) ? ROUTE_PRIORITY : KIND_PRIORITY[feature.kind];
}

/** Ranked, tappable scouting picks derived from a terrain set's features. */
export function getScoutPicks(set: TerrainMovementSet): ScoutPick[] {
  // Copy before sorting — set.features belongs to the imported set and must not
  // be reordered in place. Array.sort is stable, so equal-priority features keep
  // their emitted order.
  return [...set.features]
    .sort((a, b) => pickPriority(a) - pickPriority(b))
    .map((feature, index) => ({
      id: feature.id,
      kind: feature.kind,
      title: feature.title,
      reason: feature.detail,
      windNote: feature.windNote,
      roadDistM: feature.roadDistM,
      point: featureAnchor(feature),
      rank: index + 1,
    }));
}

/** A single representative [lat,lng] to fly the map to for a feature. */
export function featureAnchor(feature: TerrainMovementFeature): LatLng {
  if (feature.kind === "pinch") return feature.point;
  if (feature.kind === "travel") {
    return feature.line[Math.floor(feature.line.length / 2)];
  }
  const ring = feature.polygon;
  const lat = ring.reduce((sum, p) => sum + p[0], 0) / ring.length;
  const lng = ring.reduce((sum, p) => sum + p[1], 0) / ring.length;
  return [lat, lng];
}

function haversineKm(a: Point, b: Point): number {
  const R = 6371;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

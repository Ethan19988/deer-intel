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
  point: LatLng;
  rank: number;
};

// Rank order for "where do I go?": saddle stands first (the payoff), then the
// beds and travel you scout to confirm them, then the refuge you work around.
const KIND_PRIORITY: Record<TerrainKind, number> = {
  pinch: 0,
  bedding: 1,
  travel: 2,
  refuge: 3,
};

/** Ranked, tappable scouting picks derived from a terrain set's features. */
export function getScoutPicks(set: TerrainMovementSet): ScoutPick[] {
  return set.features
    .map((feature) => ({
      id: feature.id,
      kind: feature.kind,
      title: feature.title,
      reason: feature.detail,
      windNote: feature.windNote,
      point: featureAnchor(feature),
    }))
    .sort((a, b) => KIND_PRIORITY[a.kind] - KIND_PRIORITY[b.kind])
    .map((pick, index) => ({ ...pick, rank: index + 1 }));
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

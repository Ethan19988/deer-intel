// Spatial facts for AI Scout, computed on the device so the model never has
// to guess distances it can't see: which cameras and predicted terrain spots
// sit near each stand, and which handful of terrain picks are worth sending.
// Pure (no DOM, no store) so it can be unit-tested.

import { findStandLocation } from "@/lib/accessScent";
import { distanceMeters } from "@/lib/movementPrediction";
import type { ScoutPick } from "@/lib/terrainMovementData";
import type { TerrainKind } from "@/lib/terrainMovement";
import type { Camera } from "@/types/camera";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";
import type {
  AiScoutNearbyCamera,
  AiScoutNearbyTerrain,
} from "@/types/aiScout";

const YARDS_PER_METRE = 1.0936133;

/** Cameras farther than this from a stand aren't "near" it. */
export const STAND_CAMERA_RADIUS_YD = 800;
/** Terrain picks farther than this from a stand aren't "near" it. */
export const STAND_TERRAIN_RADIUS_YD = 400;
const MAX_STAND_CAMERAS = 2;
const MAX_STAND_TERRAIN = 3;

/** How many terrain picks AI Scout gets, and at most how many of one kind. */
export const AI_TERRAIN_PICK_LIMIT = 14;
export const AI_TERRAIN_PICKS_PER_KIND = 4;

type Point = { lat: number; lng: number };

function yardsBetween(a: Point, b: Point): number {
  return Math.round(distanceMeters(a, b) * YARDS_PER_METRE);
}

/** A stand's map location (its source pin or a same-name stand pin), or null. */
export function standPoint(stand: Stand, pins: MapPin[]): Point | null {
  const pin = findStandLocation(stand, pins);
  if (!pin || !Number.isFinite(pin.lat) || !Number.isFinite(pin.lng)) return null;
  return { lat: pin.lat, lng: pin.lng };
}

/** Located cameras within `radiusYd` of `point`, nearest first. */
export function camerasNear(
  point: Point,
  cameras: Camera[],
  radiusYd = STAND_CAMERA_RADIUS_YD,
): Array<{ camera: Camera; yards: number }> {
  return cameras
    .filter(
      (camera): camera is Camera & { latitude: number; longitude: number } =>
        typeof camera.latitude === "number" &&
        typeof camera.longitude === "number" &&
        Number.isFinite(camera.latitude) &&
        Number.isFinite(camera.longitude),
    )
    .map((camera) => ({
      camera: camera as Camera,
      yards: yardsBetween(point, { lat: camera.latitude, lng: camera.longitude }),
    }))
    .filter((entry) => entry.yards <= radiusYd)
    .sort((a, b) => a.yards - b.yards);
}

/** Up to 2 located cameras within 800 yd of `point`, nearest first. */
export function nearestCameras(point: Point, cameras: Camera[]): AiScoutNearbyCamera[] {
  return camerasNear(point, cameras)
    .slice(0, MAX_STAND_CAMERAS)
    .map(({ camera, yards }) => ({ name: camera.name, yards }));
}

/** Up to 3 terrain picks whose anchor is within 400 yd of `point`, nearest first. */
export function nearbyTerrain(point: Point, picks: ScoutPick[]): AiScoutNearbyTerrain[] {
  return picks
    .map((pick) => ({
      kind: pick.kind,
      title: pick.title,
      yards: yardsBetween(point, { lat: pick.point[0], lng: pick.point[1] }),
    }))
    .filter((spot) => spot.yards <= STAND_TERRAIN_RADIUS_YD)
    .sort((a, b) => a.yards - b.yards)
    .slice(0, MAX_STAND_TERRAIN);
}

/**
 * The terrain picks worth spending tokens on: keep getScoutPicks' order
 * (spots with camera activity nearby first, then saddles, routes, beds…) but
 * cap each kind so 60 beds can't crowd out the saddles, and the total so the
 * request stays small.
 */
export function selectAiTerrainPicks(
  picks: ScoutPick[],
  limit = AI_TERRAIN_PICK_LIMIT,
  perKind = AI_TERRAIN_PICKS_PER_KIND,
): ScoutPick[] {
  const taken = new Map<TerrainKind, number>();
  const out: ScoutPick[] = [];
  for (const pick of picks) {
    if (out.length >= limit) break;
    const count = taken.get(pick.kind) ?? 0;
    if (count >= perKind) continue;
    taken.set(pick.kind, count + 1);
    out.push(pick);
  }
  return out;
}

export type RecommendedStandMatch =
  | { kind: "stand"; label: string; standName: string }
  | { kind: "terrain"; label: string }
  | { kind: "none"; label: string };

/**
 * Check the model's recommendedStandName against the hunter's real stands
 * (case/space-insensitive, "Stand: X" and quotes tolerated). A name that isn't
 * a saved stand is shown as a terrain pick when it matches one, else flagged —
 * never displayed as if it were a stand the hunter owns.
 */
export function matchRecommendedStand(
  name: string | undefined,
  standNames: string[],
  terrainTitles: string[] = [],
): RecommendedStandMatch {
  const raw = (name ?? "").trim();
  const norm = normalizeName(raw);
  if (!norm) return { kind: "none", label: "No stand matched" };

  const exact = standNames.find((stand) => normalizeName(stand) === norm);
  if (exact) return { kind: "stand", label: exact, standName: exact };

  // "Ridge Ladder (north end)" or "the Ridge Ladder stand" → Ridge Ladder, when
  // exactly one stand name is contained in the answer.
  const contained = standNames.filter((stand) => {
    const s = normalizeName(stand);
    return s.length >= 3 && new RegExp(`(^| )${escapeRegExp(s)}( |$)`).test(norm);
  });
  if (contained.length === 1) {
    return { kind: "stand", label: contained[0], standName: contained[0] };
  }

  const terrain = terrainTitles.find((title) => {
    const t = normalizeName(title);
    return t.length >= 3 && (norm === t || norm.includes(t));
  });
  if (terrain || standNames.length === 0) {
    return { kind: "terrain", label: `Terrain pick: ${raw}` };
  }

  return { kind: "none", label: `No stand matched · "${raw}"` };
}

function normalizeName(value: string): string {
  return value
    .toLowerCase()
    .replace(/^\s*(stand|terrain pick)\s*:\s*/i, "")
    .replace(/["'“”‘’]/g, "")
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

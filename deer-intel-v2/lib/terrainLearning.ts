// Phase 3 — the learning layer.
//
// The terrain engine proposes spots from land shape alone. This grades each
// proposed spot against what the hunter has actually recorded: trail-camera
// deer counts at known locations. A predicted bed/bench/saddle with a productive
// camera nearby is "confirmed" and ranks higher; the rest stay ordered by
// terrain logic. It's not a trained model — it's transparent, explainable
// evidence ("confirmed by Bachelor Camera, 80 yd"), and it sharpens every season
// as more checks are logged. Runs entirely on local data (no cloud needed).

import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { LatLng, TerrainMovementFeature } from "@/lib/terrainMovement";

// A camera reduced to a located, summed activity record.
export type CameraObservation = {
  lat: number;
  lng: number;
  name: string;
  bucks: number;
  does: number;
  fawns: number;
  lastMs: number;
};

// The evidence backing a predicted spot: the strongest nearby camera's counts,
// plus an aggregate score used for ranking.
export type FeatureConfirmation = {
  score: number; // buck-weighted, distance-weighted sum across nearby cameras
  cameraName: string; // the single strongest nearby camera (the headline)
  distanceM: number;
  bucks: number;
  does: number;
  fawns: number;
  deer: number; // bucks + does + fawns at that camera
  cameraCount: number; // how many cameras contribute
};

// A camera confirms terrain out to here; credit falls off linearly with
// distance. ~600 m (~0.37 mi) is about the range over which a camera's deer
// activity speaks to the same hillside/drainage of predicted spots.
const RADIUS_M = 600;

/** Sum each camera's logged deer counts and pair them with its location. Cameras
 *  without coordinates can't confirm ground, so they're dropped. */
export function aggregateCameraActivity(
  cameras: Camera[],
  checks: CameraCheck[],
): CameraObservation[] {
  const byCam = new Map<string, { bucks: number; does: number; fawns: number; lastMs: number }>();
  for (const c of checks) {
    const e = byCam.get(c.cameraId) ?? { bucks: 0, does: 0, fawns: 0, lastMs: 0 };
    e.bucks += c.bucks || 0;
    e.does += c.does || 0;
    e.fawns += c.fawns || 0;
    const t = Date.parse(c.date);
    if (Number.isFinite(t)) e.lastMs = Math.max(e.lastMs, t);
    byCam.set(c.cameraId, e);
  }

  const out: CameraObservation[] = [];
  for (const cam of cameras) {
    if (typeof cam.latitude !== "number" || typeof cam.longitude !== "number") continue;
    const a = byCam.get(cam.id) ?? { bucks: 0, does: 0, fawns: 0, lastMs: 0 };
    out.push({
      lat: cam.latitude,
      lng: cam.longitude,
      name: cam.name,
      bucks: a.bucks,
      does: a.does,
      fawns: a.fawns,
      lastMs: a.lastMs,
    });
  }
  return out;
}

/** The points that make up a feature — a saddle's point, a corridor's whole
 *  line, a bed/refuge's ring — so a camera near ANY part of it counts (a route
 *  passing a camera shouldn't be missed because its midpoint is far away). */
function featurePoints(feature: TerrainMovementFeature): LatLng[] {
  if (feature.kind === "pinch") return [feature.point];
  if (feature.kind === "travel") return feature.line;
  return feature.polygon;
}

/** Grade a predicted spot by nearby recorded activity, or null if no camera with
 *  deer sits close enough to say anything. Bucks count double (mature-buck focus)
 *  and closer cameras count more; distance is to the nearest point of the spot. */
export function confirmFeature(
  feature: TerrainMovementFeature,
  observations: CameraObservation[],
): FeatureConfirmation | null {
  return confirmToPoints(featurePoints(feature), observations);
}

/** Confirm a single point (used for a spot's anchor / a coordinate). */
export function confirmAt(
  point: LatLng,
  observations: CameraObservation[],
): FeatureConfirmation | null {
  return confirmToPoints([point], observations);
}

function confirmToPoints(
  points: LatLng[],
  observations: CameraObservation[],
): FeatureConfirmation | null {
  let score = 0;
  let count = 0;
  let best: { contrib: number; o: CameraObservation; d: number } | null = null;

  for (const o of observations) {
    const weight = o.bucks * 2 + o.does + o.fawns;
    if (weight <= 0) continue;
    let d = Infinity;
    for (const p of points) {
      const dd = haversineM(p[0], p[1], o.lat, o.lng);
      if (dd < d) d = dd;
    }
    if (d >= RADIUS_M) continue;
    const contrib = weight * (1 - d / RADIUS_M);
    if (contrib <= 0) continue;
    score += contrib;
    count += 1;
    if (!best || contrib > best.contrib) best = { contrib, o, d };
  }

  if (score <= 0 || !best) return null;
  const { o } = best;
  return {
    score: Math.round(score * 10) / 10,
    cameraName: o.name,
    distanceM: Math.round(best.d),
    bucks: o.bucks,
    does: o.does,
    fawns: o.fawns,
    deer: o.bucks + o.does + o.fawns,
    cameraCount: count,
  };
}

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(s)));
}

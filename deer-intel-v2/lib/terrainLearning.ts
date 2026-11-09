// Phase 3 — the learning layer.
//
// The terrain engine proposes spots from land shape alone. This grades each
// proposed spot against what the hunter has actually recorded: trail-camera
// deer counts at known locations. A predicted bed/bench/saddle with a productive
// camera close by (this or last season) shows "camera activity nearby" and
// ranks higher; the rest stay ordered by terrain logic. It's not a trained
// model — it's transparent evidence ("Bachelor Camera, 80 yd"), and it updates every season
// as more checks are logged. Runs entirely on local data (no cloud needed).

import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { LatLng, TerrainMovementFeature } from "@/lib/terrainMovement";
import { dateInputTime } from "@/lib/photos";

// A camera reduced to a located, summed activity record.
export type CameraObservation = {
  lat: number;
  lng: number;
  name: string;
  /** All-time counts (the heat layers read these). */
  bucks: number;
  does: number;
  fawns: number;
  lastMs: number;
  /**
   * Age-decayed, buck-weighted activity used to grade terrain: this season's
   * checks count fully, last season's half, older ones not at all (deer shift
   * with food, cover and pressure, so a 3-year-old tally says little about now).
   * Optional so hand-built observations still work (all-time weight then).
   */
  recentWeight?: number;
  /** This + last season's raw counts, for the "camera activity nearby" line. */
  recentBucks?: number;
  recentDoes?: number;
  recentFawns?: number;
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

// A camera counts toward terrain out to here; credit falls off linearly with
// distance. ~200 m (~220 yd) keeps it to the same piece of hillside — a camera
// a third of a mile away says little about whether deer use THIS bench.
export const CAMERA_ACTIVITY_RADIUS_M = 200;
const RADIUS_M = CAMERA_ACTIVITY_RADIUS_M;

/**
 * Hunting-season year a date belongs to: July–June, so a January check counts
 * with the fall it follows.
 */
export function huntingSeasonYear(date: Date): number {
  return date.getMonth() >= 6 ? date.getFullYear() : date.getFullYear() - 1;
}

/** 1 this season, 0.5 last season, 0 older (and 0 for undated / future-dated). */
export function seasonDecayWeight(checkMs: number, now: Date): number {
  if (!Number.isFinite(checkMs) || checkMs > now.getTime() + 36 * 3600_000) return 0;
  const age = huntingSeasonYear(now) - huntingSeasonYear(new Date(checkMs));
  if (age <= 0) return 1;
  if (age === 1) return 0.5;
  return 0;
}

type CameraTally = {
  bucks: number;
  does: number;
  fawns: number;
  lastMs: number;
  recentWeight: number;
  recentBucks: number;
  recentDoes: number;
  recentFawns: number;
};

const emptyTally = (): CameraTally => ({
  bucks: 0, does: 0, fawns: 0, lastMs: 0,
  recentWeight: 0, recentBucks: 0, recentDoes: 0, recentFawns: 0,
});

/** Sum each camera's logged deer counts and pair them with its location. Cameras
 *  without coordinates can't confirm ground, so they're dropped. `now` sets the
 *  season the decay is measured from. */
export function aggregateCameraActivity(
  cameras: Camera[],
  checks: CameraCheck[],
  now: Date = new Date(),
): CameraObservation[] {
  const byCam = new Map<string, CameraTally>();
  for (const c of checks) {
    const e = byCam.get(c.cameraId) ?? emptyTally();
    const bucks = c.bucks || 0;
    const does = c.does || 0;
    const fawns = c.fawns || 0;
    e.bucks += bucks;
    e.does += does;
    e.fawns += fawns;
    // "YYYY-MM-DD" is local midnight, not UTC.
    const t = dateInputTime(c.date);
    if (Number.isFinite(t)) e.lastMs = Math.max(e.lastMs, t);
    const w = seasonDecayWeight(t, now);
    if (w > 0) {
      e.recentWeight += (bucks * 2 + does + fawns) * w;
      e.recentBucks += bucks;
      e.recentDoes += does;
      e.recentFawns += fawns;
    }
    byCam.set(c.cameraId, e);
  }

  const out: CameraObservation[] = [];
  for (const cam of cameras) {
    if (typeof cam.latitude !== "number" || typeof cam.longitude !== "number") continue;
    const a = byCam.get(cam.id) ?? emptyTally();
    out.push({
      lat: cam.latitude,
      lng: cam.longitude,
      name: cam.name,
      ...a,
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

/** Grade a predicted spot by nearby recent recorded activity, or null if no
 *  camera with recent deer sits close enough to say anything. Bucks count double
 *  (mature-buck focus), recent seasons count more, and closer cameras count
 *  more; distance is to the nearest point of the spot. This is "camera activity
 *  nearby", not proof deer use the spot itself. */
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
    const weight = o.recentWeight ?? o.bucks * 2 + o.does + o.fawns;
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
  const bucks = o.recentBucks ?? o.bucks;
  const does = o.recentDoes ?? o.does;
  const fawns = o.recentFawns ?? o.fawns;
  return {
    score: Math.round(score * 10) / 10,
    cameraName: o.name,
    distanceM: Math.round(best.d),
    bucks,
    does,
    fawns,
    deer: bucks + does + fawns,
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

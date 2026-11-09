// Sighting heat — where deer have ACTUALLY shown up on a property, from the
// hunter's own records (not the predictive Deer Heat surface in lib/deerHeat):
//  - hunt sits, placed at the stand's map pin, weighted by deer seen PER SIT
//    (so a stand sat 20 times doesn't outshine a better one sat twice);
//  - trail-camera photos, placed at the camera site, one hit per deer VISIT
//    (a burst of photos within 10 minutes on one camera is one visit);
//  - camera checks (card-swap tallies) for cameras that have no individual
//    photos logged, so the same deer are never counted twice.
// Stands and cameras measure different things (deer per sit vs. visits on a
// card), so each kind's intensity is scaled against its own hottest spot.
// Filterable by time of day and rut phase. Timed photos can be split morning /
// evening / night; date-only photos and checks (swap date only) count under
// "any time" and are left out whenever a time-of-day filter is on.

import { findStandLocation } from "@/lib/accessScent";
import { isBuckRecord, isDeerPhotoRecord, isTimedDeerPhoto } from "@/lib/hourlyActivity";
import { photoRecordTime } from "@/lib/photos";
import type { RutPhase } from "@/lib/seasonCalendar";
import {
  lightPeriod,
  toSitRecord,
  type LightPeriod,
  type StatsContext,
} from "@/lib/standStats";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

export type HeatTimeFilter = "all" | LightPeriod;
export type HeatPhaseFilter = "all" | RutPhase;
export type HeatWeight = "deer" | "bucks";

export const HEAT_TIME_OPTIONS: Array<{ id: HeatTimeFilter; label: string }> = [
  { id: "all", label: "Any time" },
  { id: "morning", label: "Morning" },
  { id: "evening", label: "Evening" },
  { id: "night", label: "Night" },
];

export type HeatFilters = {
  time: HeatTimeFilter;
  phase: HeatPhaseFilter;
  weight: HeatWeight;
  /** Inclusive local date keys ("YYYY-MM-DD"); omit for all seasons. */
  from?: string;
  to?: string;
};

export type HeatSpotKind = "stand" | "camera";

export type HeatSpot = {
  id: string;
  kind: HeatSpotKind;
  name: string;
  lat: number;
  lng: number;
  deer: number;
  bucks: number;
  /** Sits (stand) or photo hits / checks (camera) behind this spot. */
  observations: number;
  /**
   * Raw weight under the chosen weighting (deer or bucks): per sit for a
   * stand, per visit/tally for a camera.
   */
  weight: number;
  /** weight relative to the hottest spot of the same kind, 0-1. */
  intensity: number;
};

export type HeatInput = {
  stands: Stand[];
  pins: MapPin[];
  hunts: HuntLogEntry[];
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  photos: PhotoRecord[];
};

/** Photos on one camera closer together than this are a single visit. */
export const PHOTO_BURST_MS = 10 * 60_000;

export const STAND_HEAT_RADIUS_M = 90;
export const CAMERA_HEAT_RADIUS_M = 110;

function dateKeyOf(time: number): string {
  const d = new Date(time);
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function inRange(dateKey: string, filters: HeatFilters): boolean {
  const key = dateKey.slice(0, 10);
  if (filters.from && key < filters.from) return false;
  if (filters.to && key > filters.to) return false;
  return true;
}

function hasCoords(camera: Camera): camera is Camera & { latitude: number; longitude: number } {
  return (
    typeof camera.latitude === "number" &&
    typeof camera.longitude === "number" &&
    Number.isFinite(camera.latitude) &&
    Number.isFinite(camera.longitude)
  );
}

/** Every located stand and camera, whatever the filter — a stable map extent. */
export function heatExtentPoints(input: HeatInput): Array<[number, number]> {
  const points: Array<[number, number]> = [];
  for (const stand of input.stands) {
    const pin = findStandLocation(stand, input.pins);
    if (pin) points.push([pin.lat, pin.lng]);
  }
  for (const camera of input.cameras) {
    if (hasCoords(camera)) points.push([camera.latitude, camera.longitude]);
  }
  return points;
}

export function buildSightingHeat(
  input: HeatInput,
  filters: HeatFilters,
  ctx: StatsContext,
): HeatSpot[] {
  const spots: HeatSpot[] = [];
  const weightOf = (deer: number, bucks: number) =>
    filters.weight === "bucks" ? bucks : deer + bucks; // bucks count double in "deer"

  // Stands — sits at the stand pin.
  for (const stand of input.stands) {
    const pin = findStandLocation(stand, input.pins);
    if (!pin) continue;
    let deer = 0;
    let bucks = 0;
    let sits = 0;
    for (const hunt of input.hunts) {
      if (hunt.standId !== stand.id || !hunt.date || !inRange(hunt.date, filters)) continue;
      const record = toSitRecord(hunt, ctx);
      if (filters.phase !== "all" && record.phase !== filters.phase) continue;
      if (filters.time !== "all" && record.time !== filters.time) continue;
      sits += 1;
      deer += record.deer;
      bucks += record.bucks;
    }
    if (sits === 0) continue;
    spots.push({
      id: `stand:${stand.id}`,
      kind: "stand",
      name: stand.name,
      lat: pin.lat,
      lng: pin.lng,
      deer,
      bucks,
      observations: sits,
      // Per sit: effort-normalized, so more sits alone don't make a hot stand.
      weight: weightOf(deer, bucks) / sits,
      intensity: 0,
    });
  }

  // Cameras — photos when the site has any, else its check tallies.
  const photosByCamera = new Map<string, PhotoRecord[]>();
  for (const photo of input.photos) {
    if (!photo.cameraSiteId) continue;
    const list = photosByCamera.get(photo.cameraSiteId) ?? [];
    list.push(photo);
    photosByCamera.set(photo.cameraSiteId, list);
  }

  for (const camera of input.cameras) {
    if (!hasCoords(camera)) continue;
    const photos = photosByCamera.get(camera.id) ?? [];
    let deer = 0;
    let bucks = 0;
    let observations = 0;

    if (photos.length > 0) {
      // Timed photos in time order, so a burst can be folded into one visit.
      const ordered = [...photos].sort((a, b) => photoRecordTime(a) - photoRecordTime(b));
      let lastTimedVisit = -Infinity;
      let lastVisitWasBuck = false;
      for (const photo of ordered) {
        // A time-of-day filter needs a real capture time; "any time" also
        // counts date-only deer photos (the season report's rule).
        if (filters.time !== "all" ? !isTimedDeerPhoto(photo) : !isDeerPhotoRecord(photo)) continue;
        const time = photoRecordTime(photo);
        if (!time) continue;
        const dateKey = dateKeyOf(time);
        if (!inRange(dateKey, filters)) continue;
        if (filters.phase !== "all" && ctx.phaseFor(dateKey) !== filters.phase) continue;
        if (filters.time !== "all") {
          const sun = ctx.sunFor(dateKey);
          if (!sun) continue;
          const date = new Date(time);
          if (lightPeriod(date.getHours() * 60 + date.getMinutes(), sun) !== filters.time) continue;
        }
        const isBuck = isBuckRecord(photo);
        if (isTimedDeerPhoto(photo)) {
          if (time - lastTimedVisit <= PHOTO_BURST_MS) {
            // Same visit: a buck in any frame makes it a buck visit.
            if (isBuck && !lastVisitWasBuck) {
              bucks += 1;
              deer -= 1;
              lastVisitWasBuck = true;
            }
            continue;
          }
          lastTimedVisit = time;
          lastVisitWasBuck = isBuck;
        }
        observations += 1;
        if (isBuck) bucks += 1;
        else deer += 1;
      }
    } else if (filters.time === "all") {
      for (const check of input.cameraChecks) {
        if (check.cameraId !== camera.id || !check.date || !inRange(check.date, filters)) continue;
        if (filters.phase !== "all" && ctx.phaseFor(check.date) !== filters.phase) continue;
        observations += 1;
        const checkBucks = Math.max(0, check.bucks || 0);
        bucks += checkBucks;
        deer += Math.max(0, check.does || 0) + Math.max(0, check.fawns || 0);
      }
    }

    // `deer` above holds the non-buck count; the spot reports all deer.
    const allDeer = deer + bucks;
    if (observations === 0 || allDeer === 0) continue;
    spots.push({
      id: `camera:${camera.id}`,
      kind: "camera",
      name: camera.name,
      lat: camera.latitude,
      lng: camera.longitude,
      deer: allDeer,
      bucks,
      observations,
      weight: weightOf(allDeer, bucks),
      intensity: 0,
    });
  }

  const maxByKind: Record<HeatSpotKind, number> = { stand: 0, camera: 0 };
  for (const spot of spots) {
    maxByKind[spot.kind] = Math.max(maxByKind[spot.kind], spot.weight);
  }
  return spots
    .filter((spot) => spot.weight > 0)
    .map((spot) => {
      const max = maxByKind[spot.kind];
      return { ...spot, intensity: max > 0 ? spot.weight / max : 0 };
    })
    .sort((a, b) => b.intensity - a.intensity || b.weight - a.weight);
}

/** Short line for a spot's popup: "6 sits · 14 deer (3 bucks)". */
export function heatSpotLine(spot: HeatSpot): string {
  const unit =
    spot.kind === "stand"
      ? spot.observations === 1
        ? "sit"
        : "sits"
      : spot.observations === 1
        ? "record"
        : "records";
  return `${spot.observations} ${unit} · ${spot.deer} deer${
    spot.bucks ? ` (${spot.bucks} ${spot.bucks === 1 ? "buck" : "bucks"})` : ""
  }`;
}

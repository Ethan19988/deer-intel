import type { WalkTrackPoint } from "@/types/walkTrack";

// Helpers for recorded walk trails: how far you walked and how to phrase it, plus
// the jitter filter that keeps a stationary GPS from padding the trail with noise.

const EARTH_RADIUS_METERS = 6_378_137;
const METERS_PER_MILE = 1609.344;
const METERS_PER_FOOT = 0.3048;

// The smallest move (in meters) that counts as a new step on the trail. GPS
// wanders a few meters even while you stand still; ignoring sub-threshold moves
// keeps a parked track from creeping and smooths out the drawn line.
export const MIN_TRACK_POINT_METERS = 5;

// Great-circle distance between two lat/lng points, in meters. Accurate to well
// within a stride at the scale of a walk across a hunting property.
export function distanceBetweenMeters(
  first: WalkTrackPoint,
  second: WalkTrackPoint,
): number {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const lat1 = toRadians(first.lat);
  const lat2 = toRadians(second.lat);
  const deltaLat = toRadians(second.lat - first.lat);
  const deltaLng = toRadians(second.lng - first.lng);

  const a =
    Math.sin(deltaLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLng / 2) ** 2;

  return EARTH_RADIUS_METERS * 2 * Math.asin(Math.min(1, Math.sqrt(a)));
}

// Total length of a trail, summing the distance between each consecutive point.
export function walkTrackDistanceMeters(points: WalkTrackPoint[]): number {
  let total = 0;

  for (let index = 1; index < points.length; index += 1) {
    total += distanceBetweenMeters(points[index - 1], points[index]);
  }

  return total;
}

// A short, field-friendly distance label — feet up close, miles once it's a real
// walk — so the recording readout stays readable at a glance.
export function formatWalkDistance(meters: number): string {
  if (meters <= 0) return "0 ft";

  if (meters < METERS_PER_MILE * 0.1) {
    return `${Math.round(meters / METERS_PER_FOOT)} ft`;
  }

  return `${(meters / METERS_PER_MILE).toFixed(2)} mi`;
}

// Duration between two ISO timestamps as a compact "1h 4m" / "12m" / "45s".
export function formatWalkDuration(startedAt: string, endedAt: string): string {
  const seconds = Math.max(
    0,
    Math.round(
      (new Date(endedAt).getTime() - new Date(startedAt).getTime()) / 1000,
    ),
  );

  if (!Number.isFinite(seconds) || seconds < 60) return `${seconds}s`;

  const minutes = Math.floor(seconds / 60);

  if (minutes < 60) return `${minutes}m`;

  const hours = Math.floor(minutes / 60);

  return `${hours}h ${minutes % 60}m`;
}

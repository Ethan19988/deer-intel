import type { HuntAreaPoint } from "@/types/property";

// Geofence math for the party location tracker. A "geofence" here is simply the
// hunt-area polygon already drawn on a property (Property.huntArea) — so a
// member's dot goes live only while they are standing inside that saved ground,
// and clears when they leave. All pure functions, no map/Leaflet dependency, so
// this is easy to reason about and unit-test.

export type BBox = {
  minLat: number;
  minLng: number;
  maxLat: number;
  maxLng: number;
};

// A polygon needs at least three points to enclose any area.
export function isValidArea(polygon: HuntAreaPoint[] | undefined): boolean {
  return Array.isArray(polygon) && polygon.length >= 3;
}

export function boundingBox(polygon: HuntAreaPoint[]): BBox | null {
  if (polygon.length === 0) return null;

  let minLat = polygon[0].lat;
  let maxLat = polygon[0].lat;
  let minLng = polygon[0].lng;
  let maxLng = polygon[0].lng;

  for (const p of polygon) {
    if (p.lat < minLat) minLat = p.lat;
    if (p.lat > maxLat) maxLat = p.lat;
    if (p.lng < minLng) minLng = p.lng;
    if (p.lng > maxLng) maxLng = p.lng;
  }

  return { minLat, maxLat, minLng, maxLng };
}

/**
 * True when (lat, lng) is inside the polygon. Uses the standard ray-casting
 * algorithm with a bounding-box quick-reject first. Longitude is treated as x
 * and latitude as y; over a single hunt area the flat-earth approximation is
 * well within GPS accuracy.
 */
export function pointInPolygon(
  lat: number,
  lng: number,
  polygon: HuntAreaPoint[],
): boolean {
  if (!isValidArea(polygon)) return false;

  const bbox = boundingBox(polygon);
  if (
    !bbox ||
    lat < bbox.minLat ||
    lat > bbox.maxLat ||
    lng < bbox.minLng ||
    lng > bbox.maxLng
  ) {
    return false;
  }

  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const yi = polygon[i].lat;
    const xi = polygon[i].lng;
    const yj = polygon[j].lat;
    const xj = polygon[j].lng;

    const intersects =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;

    if (intersects) inside = !inside;
  }

  return inside;
}

export type GeofenceArea = {
  name: string;
  polygon: HuntAreaPoint[];
};

/**
 * Return the first area that contains the point, or null when the point is
 * outside every area. Lets a property with several drawn hunt areas act as one
 * combined geofence.
 */
export function findContainingArea(
  lat: number,
  lng: number,
  areas: GeofenceArea[],
): GeofenceArea | null {
  for (const area of areas) {
    if (pointInPolygon(lat, lng, area.polygon)) return area;
  }
  return null;
}

const EARTH_RADIUS_M = 6_371_000;

/**
 * Shortest distance in meters from (lat, lng) to the polygon's outline (any
 * edge, including the closing one), whether the point is inside or outside.
 * Uses a local flat projection around the point, which is well within GPS
 * accuracy over a hunt area. Null for an invalid polygon.
 */
export function distanceToPolygonEdgeMeters(
  lat: number,
  lng: number,
  polygon: HuntAreaPoint[] | undefined,
): number | null {
  if (!polygon || !isValidArea(polygon)) return null;

  const metersPerDegLat = (Math.PI / 180) * EARTH_RADIUS_M;
  const metersPerDegLng = metersPerDegLat * Math.cos((lat * Math.PI) / 180);
  const project = (p: HuntAreaPoint) => ({
    x: (p.lng - lng) * metersPerDegLng,
    y: (p.lat - lat) * metersPerDegLat,
  });

  let best = Infinity;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const a = project(polygon[j]);
    const b = project(polygon[i]);
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const lengthSq = dx * dx + dy * dy;
    // Closest point on segment a→b to the origin (the user).
    const t =
      lengthSq === 0 ? 0 : Math.max(0, Math.min(1, -(a.x * dx + a.y * dy) / lengthSq));
    const cx = a.x + dx * t;
    const cy = a.y + dy * t;
    best = Math.min(best, Math.hypot(cx, cy));
  }

  return Number.isFinite(best) ? best : null;
}

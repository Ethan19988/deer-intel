import type { HuntAreaPoint } from "@/types/property";

// Geometry helpers for a property's drawn hunt area: how big it is and where its
// middle sits. Area uses a spherical-excess approximation, which is plenty
// accurate at the scale of a hunting property.

const EARTH_RADIUS_METERS = 6_378_137;
const SQUARE_METERS_PER_ACRE = 4046.8564224;

export function huntAreaIsValid(
  points: HuntAreaPoint[] | undefined,
): points is HuntAreaPoint[] {
  return Array.isArray(points) && points.length >= 3;
}

export function huntAreaAcres(points: HuntAreaPoint[] | undefined): number {
  if (!huntAreaIsValid(points)) return 0;

  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  let total = 0;

  for (let index = 0; index < points.length; index += 1) {
    const current = points[index];
    const next = points[(index + 1) % points.length];

    total +=
      toRadians(next.lng - current.lng) *
      (2 + Math.sin(toRadians(current.lat)) + Math.sin(toRadians(next.lat)));
  }

  const areaSquareMeters = Math.abs(
    (total * EARTH_RADIUS_METERS * EARTH_RADIUS_METERS) / 2,
  );

  return areaSquareMeters / SQUARE_METERS_PER_ACRE;
}

export function formatHuntAreaAcres(
  points: HuntAreaPoint[] | undefined,
): string {
  const acres = huntAreaAcres(points);

  if (acres <= 0) return "";
  if (acres < 10) return `${acres.toFixed(1)} acres`;

  return `${Math.round(acres)} acres`;
}

/**
 * Is (lat, lng) inside the drawn hunt area? Ray-casting point-in-polygon on the
 * lat/lng ring (treating lng as x, lat as y). Used to keep terrain predictions
 * to the ground the hunter actually marked. Returns false for an invalid area.
 */
export function huntAreaContains(
  points: HuntAreaPoint[] | undefined,
  lat: number,
  lng: number,
): boolean {
  if (!huntAreaIsValid(points)) return false;

  let inside = false;
  for (let i = 0, j = points.length - 1; i < points.length; j = i, i += 1) {
    const yi = points[i].lat;
    const xi = points[i].lng;
    const yj = points[j].lat;
    const xj = points[j].lng;
    const crosses =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (crosses) inside = !inside;
  }
  return inside;
}

export function huntAreaCentroid(
  points: HuntAreaPoint[] | undefined,
): HuntAreaPoint | null {
  if (!huntAreaIsValid(points)) return null;

  const total = points.reduce(
    (sum, point) => ({ lat: sum.lat + point.lat, lng: sum.lng + point.lng }),
    { lat: 0, lng: 0 },
  );

  return { lat: total.lat / points.length, lng: total.lng / points.length };
}

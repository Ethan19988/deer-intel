import { distanceMeters, type LatLng } from "@/lib/movementPrediction";

// Review checks for staged waypoint imports: a waypoint already on the map
// (re-importing the same export) and one far from the property (wrong file,
// or a waypoint from another hunting spot).

/** Same name within this distance counts as the pin already being on the map. */
export const DUPLICATE_PIN_METERS = 1;
/** Waypoints farther than this from the property center get a warning. */
export const FAR_FROM_PROPERTY_METERS = 5000;

type NamedPoint = LatLng & { name?: string };

function sameName(a: string | undefined, b: string | undefined): boolean {
  return (a ?? "").trim().toLowerCase() === (b ?? "").trim().toLowerCase();
}

/** True when an existing pin has the same name and sits within ~1 m. */
export function isAlreadyOnMap(
  waypoint: NamedPoint,
  existingPins: readonly NamedPoint[],
  toleranceMeters = DUPLICATE_PIN_METERS,
): boolean {
  return existingPins.some(
    (pin) =>
      sameName(pin.name, waypoint.name) &&
      Number.isFinite(pin.lat) &&
      Number.isFinite(pin.lng) &&
      distanceMeters(pin, waypoint) <= toleranceMeters,
  );
}

/**
 * Distance from the property center in meters when it's beyond the warning
 * radius, else null (also null when the property has no known center).
 */
export function farFromPropertyMeters(
  waypoint: LatLng,
  center: LatLng | null | undefined,
  limitMeters = FAR_FROM_PROPERTY_METERS,
): number | null {
  if (!center) return null;
  const meters = distanceMeters(center, waypoint);
  return meters > limitMeters ? meters : null;
}

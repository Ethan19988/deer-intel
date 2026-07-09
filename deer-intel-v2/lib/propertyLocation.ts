import type { Property } from "@/types/property";

// A property can carry an optional center coordinate so weather, the map, and
// future location-aware features have an exact point to work from even before
// any cameras or pins are placed. Coordinates are entered as a "lat, lng" (or
// "lat lng") string in the form and parsed to numbers on save.

export type PropertyCoordinate = {
  latitude: number;
  longitude: number;
};

export function hasPropertyCoordinate(
  property: Pick<Property, "latitude" | "longitude">,
): property is Property & PropertyCoordinate {
  return (
    typeof property.latitude === "number" &&
    typeof property.longitude === "number" &&
    Number.isFinite(property.latitude) &&
    Number.isFinite(property.longitude)
  );
}

export function parsePropertyCoordinate(
  input: string,
): PropertyCoordinate | null {
  const match = input
    .trim()
    .match(/^\s*(-?\d+(?:\.\d+)?)\s*(?:,\s*|\s+)(-?\d+(?:\.\d+)?)\s*$/);

  if (!match) return null;

  const latitude = Number(match[1]);
  const longitude = Number(match[2]);

  if (
    !Number.isFinite(latitude) ||
    !Number.isFinite(longitude) ||
    latitude < -90 ||
    latitude > 90 ||
    longitude < -180 ||
    longitude > 180
  ) {
    return null;
  }

  return { latitude, longitude };
}

export function formatPropertyCoordinate(
  property: Pick<Property, "latitude" | "longitude">,
): string {
  if (!hasPropertyCoordinate(property)) return "";

  return `${property.latitude.toFixed(5)}, ${property.longitude.toFixed(5)}`;
}

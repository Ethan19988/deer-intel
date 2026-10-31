// Compass math for deer travel learning: turning the AI's frame-relative read
// ("walking left to right") into a real-world heading using the camera's
// facing direction, plus the bearing between two camera sites for
// camera-to-camera travel legs.

import { compassToDegrees, degreesToCompass } from "@/lib/compass";

// The 16-wind list and point/degree conversions live in lib/compass; they are
// re-exported here because many screens import them from this module.
export { COMPASS_16, compassToDegrees, degreesToCompass } from "@/lib/compass";

const COMPASS_8: readonly string[] = [
  "N",
  "NE",
  "E",
  "SE",
  "S",
  "SW",
  "W",
  "NW",
];

// How the AI reports an animal's movement across the photo. Must match the
// travelDirectionInFrame enum the vision tool offers.
export const FRAME_DIRECTION_VALUES: readonly string[] = [
  "Left to right",
  "Right to left",
  "Toward camera",
  "Away from camera",
];

/**
 * Collapse a 16-wind point to its nearest 8-wind sector ("NNE" → "NE" side of
 * N... rounded to the closest of N/NE/E/...). Patterns group on 8 sectors so
 * one point of camera error doesn't split "his" direction into two buckets.
 */
export function toEightWind(point: string): string {
  const degrees = compassToDegrees(point);

  if (degrees === null) return "";

  return COMPASS_8[Math.round(degrees / 45) % 8];
}

/**
 * Convert the AI's frame-relative movement into a compass heading. A trail-cam
 * image is not mirrored, so an animal crossing left-to-right is moving toward
 * the camera's right-hand side (facing + 90°); toward the camera is the
 * reciprocal of where the lens points. Returns "" when the camera's facing
 * direction is unknown — there is no honest conversion without it.
 */
export function frameDirectionToHeading(
  frameDirection: string,
  cameraFacing: string,
): string {
  const facing = compassToDegrees(cameraFacing);

  if (facing === null) return "";

  switch (frameDirection.trim()) {
    case "Left to right":
      return degreesToCompass(facing + 90);
    case "Right to left":
      return degreesToCompass(facing - 90);
    case "Toward camera":
      return degreesToCompass(facing + 180);
    case "Away from camera":
      return degreesToCompass(facing);
    default:
      return "";
  }
}

/** Initial great-circle bearing from one point to another, in degrees. */
export function bearingBetween(
  fromLat: number,
  fromLng: number,
  toLat: number,
  toLng: number,
): number {
  const fromLatRad = (fromLat * Math.PI) / 180;
  const toLatRad = (toLat * Math.PI) / 180;
  const deltaLngRad = ((toLng - fromLng) * Math.PI) / 180;
  const y = Math.sin(deltaLngRad) * Math.cos(toLatRad);
  const x =
    Math.cos(fromLatRad) * Math.sin(toLatRad) -
    Math.sin(fromLatRad) * Math.cos(toLatRad) * Math.cos(deltaLngRad);
  const bearing = (Math.atan2(y, x) * 180) / Math.PI;

  return (bearing + 360) % 360;
}

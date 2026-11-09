import { degreesToCompass } from "@/lib/compass";
import { distanceMeters, type LatLng } from "@/lib/movementPrediction";
import { bearingBetween } from "@/lib/travelDirection";

// Field navigation on the map: "Guide me" (distance, bearing and a heading-
// relative arrow from your GPS fix to a pin) and the hunt-area edge warning.
// Pure helpers so the map component only wires GPS/compass state to them.

export const METERS_PER_YARD = 0.9144;
const YARDS_PER_MILE = 1760;

/** Guidance ends (with a buzz) once you're this close to the target. */
export const GUIDE_ARRIVE_YARDS = 15;

/** "8 yd", "240 yd", "1.3 mi", "12 mi" — yards under 1000, else miles. */
export function formatGuideDistance(meters: number): string {
  const yards = meters / METERS_PER_YARD;
  if (yards < 100) return `${Math.max(0, Math.round(yards))} yd`;
  if (yards < 1000) return `${Math.round(yards / 10) * 10} yd`;
  const miles = yards / YARDS_PER_MILE;
  return miles < 10 ? `${miles.toFixed(1)} mi` : `${Math.round(miles)} mi`;
}

function normalizeDegrees(degrees: number): number {
  return ((degrees % 360) + 360) % 360;
}

export type GuideReading = {
  meters: number;
  distanceLabel: string;
  /** True bearing from you to the target, whole degrees 0-359. */
  bearing: number;
  /** 16-wind point of that bearing, e.g. "NNE". */
  compass: string;
  /** "Head NNE (23°)" — the fallback when there's no compass heading. */
  headText: string;
  /**
   * Arrow rotation relative to the phone (bearing − heading), or null with no
   * compass heading. 0 = straight ahead.
   */
  arrowRotation: number | null;
  arrived: boolean;
};

export function guideReading(
  from: LatLng,
  to: LatLng,
  heading: number | null,
): GuideReading {
  const meters = distanceMeters(from, to);
  const bearing = Math.round(normalizeDegrees(bearingBetween(from.lat, from.lng, to.lat, to.lng))) % 360;
  const compass = degreesToCompass(bearing);

  return {
    meters,
    distanceLabel: formatGuideDistance(meters),
    bearing,
    compass,
    headText: `Head ${compass} (${bearing}°)`,
    arrowRotation:
      heading === null || !Number.isFinite(heading)
        ? null
        : Math.round(normalizeDegrees(bearing - heading)),
    arrived: meters / METERS_PER_YARD <= GUIDE_ARRIVE_YARDS,
  };
}

// --- Hunt-area edge warning --------------------------------------------------

/** Warn inside this distance of the outline... */
export const EDGE_WARN_YARDS = 50;
/** ...and only re-arm the warning once you're back this far inside. */
export const EDGE_CLEAR_YARDS = 70;

export type EdgeAlertState = "off" | "clear" | "near" | "outside";

export type EdgeReading = {
  inside: boolean;
  /** Distance to the nearest edge of the outline, in meters. */
  edgeMeters: number;
};

/**
 * Next edge-alert state from the last one and a fresh GPS reading (null when
 * the warning isn't running). `buzz` is true only on the transition into a
 * warning — approaching the edge from inside, or stepping out — so walking
 * along the line doesn't vibrate on every fix. Coming back in from outside
 * never buzzes, and neither does the very first reading outside (you started
 * following from off your ground).
 */
export function nextEdgeAlert(
  prev: EdgeAlertState,
  reading: EdgeReading | null,
): { state: EdgeAlertState; buzz: boolean } {
  if (!reading) return { state: "off", buzz: false };

  if (!reading.inside) {
    return {
      state: "outside",
      buzz: prev === "clear" || prev === "near",
    };
  }

  const yards = reading.edgeMeters / METERS_PER_YARD;

  if (yards <= EDGE_WARN_YARDS) {
    return { state: "near", buzz: prev === "clear" || prev === "off" };
  }

  if (yards <= EDGE_CLEAR_YARDS && (prev === "near" || prev === "outside")) {
    return { state: "near", buzz: false };
  }

  return { state: "clear", buzz: false };
}

/** Banner text for an edge-alert state, or null when there's nothing to say. */
export function edgeAlertLabel(
  state: EdgeAlertState,
  edgeMeters: number | null,
): string | null {
  if (state === "outside") return "Outside your hunt area";
  if (state === "near" && edgeMeters !== null) {
    const yards = Math.max(5, Math.round(edgeMeters / METERS_PER_YARD / 5) * 5);
    return `Hunt area edge · ${yards} yd`;
  }
  return null;
}

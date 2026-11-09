import { degreesToCompass } from "@/lib/compass";
import { DECISION_MAX_ACCURACY_M, isDecisionFix } from "@/lib/gpsFix";
import { distanceMeters, type LatLng } from "@/lib/movementPrediction";
import { bearingBetween } from "@/lib/travelDirection";

// Field navigation on the map: "Guide me" (distance, bearing and a heading-
// relative arrow from your GPS fix to a pin) and the hunt-area edge warning.
// Pure helpers so the map component only wires GPS/compass state to them.

export const METERS_PER_YARD = 0.9144;
const YARDS_PER_MILE = 1760;

/** Guidance ends (with a buzz) once you're this close to the target. */
export const GUIDE_ARRIVE_YARDS = 15;
/** A loose fix widens the arrival circle, but never past this. */
export const GUIDE_ARRIVE_MAX_ACCURACY_M = 20;
/** Good fixes in a row inside the arrival circle before guidance ends. */
export const GUIDE_ARRIVE_FIXES = 2;

/**
 * Arrival radius for a fix: 15 yd, widened to the fix's accuracy (capped at
 * 20 m) so a ±18 m fix can still say you're there.
 */
export function guideArriveMeters(accuracy: number | null | undefined): number {
  const base = GUIDE_ARRIVE_YARDS * 0.9144;
  if (typeof accuracy !== "number" || !Number.isFinite(accuracy)) return base;
  return Math.max(base, Math.min(accuracy, GUIDE_ARRIVE_MAX_ACCURACY_M));
}

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
   * compass heading. 0 = straight ahead. `heading` must be a TRUE heading
   * (lib/deviceHeading corrects the phone's magnetic reading); a raw magnetic
   * one would skew the arrow by the declination (~10° in PA).
   */
  arrowRotation: number | null;
  /** Inside the arrival radius on this fix (see nextGuideArrival for when guidance ends). */
  arrived: boolean;
  /**
   * The target is closer than the fix's accuracy: the arrow could point any
   * way, so the HUD says to look around instead.
   */
  withinAccuracy: boolean;
};

export function guideReading(
  from: LatLng & { accuracy?: number | null },
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
    arrived: meters <= guideArriveMeters(from.accuracy),
    withinAccuracy:
      typeof from.accuracy === "number" && Number.isFinite(from.accuracy) && meters < from.accuracy,
  };
}

/**
 * Count good fixes in a row inside the arrival radius. Fixes worse than
 * DECISION_MAX_ACCURACY_M are ignored (the streak holds), a good fix outside
 * resets it, and guidance ends after GUIDE_ARRIVE_FIXES in a row — one lucky
 * fix that wanders onto the pin doesn't end it.
 */
export function nextGuideArrival(
  streak: number,
  reading: Pick<GuideReading, "arrived">,
  accuracy: number | null | undefined,
): { streak: number; arrived: boolean } {
  if (!isDecisionFix(accuracy)) return { streak, arrived: false };
  const next = reading.arrived ? streak + 1 : 0;
  return { streak: next, arrived: next >= GUIDE_ARRIVE_FIXES };
}

// --- Hunt-area edge warning --------------------------------------------------

/** Warn inside this distance of the outline... */
export const EDGE_WARN_YARDS = 50;
/** ...and only re-arm the warning once you're back this far inside. */
export const EDGE_CLEAR_YARDS = 70;
/** One fix outside counts as stepping out only when it's this far out (or the fix's accuracy, if larger). */
export const EDGE_OUTSIDE_MIN_M = 10;
/** Further out than this you're not on your ground at all (scouting from home): no banner. */
export const EDGE_FAR_METERS = 800;

export type EdgeAlertState = "off" | "clear" | "near" | "outside";

export type EdgeReading = {
  inside: boolean;
  /** Distance to the nearest edge of the outline, in meters. */
  edgeMeters: number;
  /** Accuracy of the fix, meters (null/undefined = unknown, treated as good). */
  accuracy?: number | null;
};

/**
 * Edge-alert memory between fixes. `nearArmed` / `outsideArmed` say whether
 * the next approach / step-out may buzz; both re-arm only once you're back in
 * the clear, so GPS jitter across a line buzzes once, not on every wobble.
 */
export type EdgeTracker = {
  state: EdgeAlertState;
  outsideStreak: number;
  nearArmed: boolean;
  outsideArmed: boolean;
};

export const EDGE_TRACKER_OFF: EdgeTracker = {
  state: "off",
  outsideStreak: 0,
  nearArmed: false,
  outsideArmed: false,
};

/**
 * Next edge-alert tracker from the last one and a fresh GPS reading (null
 * when the warning isn't running). `buzz` is true only on an armed transition
 * into a warning: approaching the edge from the clear, or stepping out.
 *
 * - Turning the alert on never buzzes (off → near / outside), so re-enabling
 *   it next to the line isn't a "new approach". Starting near the edge still
 *   arms the step-out buzz; starting outside arms nothing until you're clear.
 * - Stepping out needs a fix more than max(10 m, accuracy) outside, or two
 *   outside fixes in a row; a single shallow outside fix just reads "near".
 * - Fixes worse than DECISION_MAX_ACCURACY_M are ignored (state held).
 * - More than EDGE_FAR_METERS outside reads as "off" (not on your ground).
 */
export function nextEdgeAlert(
  prev: EdgeTracker,
  reading: EdgeReading | null,
): { tracker: EdgeTracker; buzz: boolean } {
  if (!reading) return { tracker: EDGE_TRACKER_OFF, buzz: false };

  const accuracy =
    typeof reading.accuracy === "number" && Number.isFinite(reading.accuracy)
      ? reading.accuracy
      : null;
  if (accuracy !== null && accuracy > DECISION_MAX_ACCURACY_M) {
    return { tracker: prev, buzz: false };
  }

  if (!reading.inside && reading.edgeMeters > EDGE_FAR_METERS) {
    return { tracker: EDGE_TRACKER_OFF, buzz: false };
  }

  const wasOff = prev.state === "off";

  if (!reading.inside) {
    const outsideStreak = prev.outsideStreak + 1;
    const confirmed =
      prev.state === "outside" ||
      reading.edgeMeters > Math.max(EDGE_OUTSIDE_MIN_M, accuracy ?? 0) ||
      outsideStreak >= 2;

    if (confirmed) {
      const buzz = !wasOff && prev.state !== "outside" && prev.outsideArmed;
      return {
        tracker: {
          state: "outside",
          outsideStreak,
          nearArmed: false,
          outsideArmed: prev.outsideArmed && !buzz && !wasOff,
        },
        buzz,
      };
    }

    // One shallow fix past the line: you're at the edge, not out yet.
    const buzz = !wasOff && prev.state === "clear" && prev.nearArmed;
    return {
      tracker: {
        state: "near",
        outsideStreak,
        nearArmed: wasOff ? false : prev.nearArmed && !buzz,
        outsideArmed: wasOff ? true : prev.outsideArmed,
      },
      buzz,
    };
  }

  const yards = reading.edgeMeters / METERS_PER_YARD;

  if (
    yards <= EDGE_WARN_YARDS ||
    (yards <= EDGE_CLEAR_YARDS && (prev.state === "near" || prev.state === "outside"))
  ) {
    const buzz = !wasOff && prev.state === "clear" && prev.nearArmed;
    return {
      tracker: {
        state: "near",
        outsideStreak: 0,
        nearArmed: wasOff ? false : prev.nearArmed && !buzz,
        // Starting next to the line still warns if you then step out.
        outsideArmed: wasOff ? true : prev.outsideArmed,
      },
      buzz,
    };
  }

  return {
    tracker: { state: "clear", outsideStreak: 0, nearArmed: true, outsideArmed: true },
    buzz: false,
  };
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

import { distanceMeters, type LatLng } from "@/lib/movementPrediction";
import { bearingBetween, compassToDegrees } from "@/lib/travelDirection";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// Does the walk to a stand blow your scent into bedding? A stand can have a
// perfect wind at the tree and still get busted on the way in, because the
// access route crosses upwind of where deer are lying. This traces the walk
// from the nearest parking or gate, through any access-route pins, to the
// stand, and checks each bedding pin against the downwind cone along it.
//
// It's a straight-line approximation of the route between pins, and wind only
// (no thermals), so it flags likely problems rather than proving a route safe.

export type AccessScentStatus = "clear" | "risk" | "unknown";

export type AccessScentCheck = {
  status: AccessScentStatus;
  label: string;
  /** Plain-language reason, e.g. which bedding pin and from where. */
  detail: string;
};

const BEDDING_TYPES: PinType[] = ["Bedding", "Bedding Area"];
const START_TYPES: PinType[] = ["Parking", "Gate"];
const STAND_PIN_TYPES: PinType[] = ["Stand", "Treestand"];

// How far scent realistically carries to a bedded deer on a steady wind, and
// how wide the downwind plume spreads either side of straight downwind.
export const SCENT_REACH_M = 365; // ~400 yd
export const SCENT_CONE_HALF_ANGLE = 30;
// Walking this close to a bed bumps deer whatever the wind does.
export const BUMP_DISTANCE_M = 60; // ~65 yd
// Spacing of the points checked along each leg of the walk.
const SAMPLE_STEP_M = 40;

const METERS_TO_YARDS = 1.0936;

function yards(meters: number): number {
  return Math.round((meters * METERS_TO_YARDS) / 5) * 5;
}

function pinLabel(pin: MapPin): string {
  return pin.name?.trim() || pin.notes?.trim() || pin.type;
}

function angleDiff(a: number, b: number): number {
  const diff = Math.abs(a - b) % 360;
  return diff > 180 ? 360 - diff : diff;
}

/** The map pin a stand sits on: the one it was promoted from, else a name match. */
export function findStandLocation(stand: Stand, pins: MapPin[]): MapPin | null {
  if (stand.sourcePinId) {
    const source = pins.find((pin) => pin.id === stand.sourcePinId);
    if (source) return source;
  }

  const name = stand.name.trim().toLowerCase();
  return (
    pins.find(
      (pin) =>
        pin.propertyId === stand.propertyId &&
        STAND_PIN_TYPES.includes(pin.type) &&
        pinLabel(pin).toLowerCase() === name,
    ) ?? null
  );
}

type RoutePoint = LatLng & { atStand: boolean };

/** Points along nearest parking/gate → access-route pins → stand. */
export function buildAccessRoute(
  standPoint: LatLng,
  pins: MapPin[],
): { route: RoutePoint[]; startLabel: string | null } {
  const starts = pins
    .filter((pin) => START_TYPES.includes(pin.type))
    .map((pin) => ({ pin, distance: distanceMeters(pin, standPoint) }))
    .sort((a, b) => a.distance - b.distance);
  const start = starts[0];

  if (!start) {
    return { route: [{ ...standPoint, atStand: true }], startLabel: null };
  }

  // Access-route pins that sit between the start and the stand, walked in
  // order of getting closer to the stand.
  const waypoints = pins
    .filter(
      (pin) =>
        pin.type === "Access Route" &&
        distanceMeters(pin, standPoint) < start.distance,
    )
    .sort((a, b) => distanceMeters(b, standPoint) - distanceMeters(a, standPoint));

  const legs: LatLng[] = [start.pin, ...waypoints, standPoint];
  const route: RoutePoint[] = [];

  for (let index = 0; index < legs.length - 1; index += 1) {
    const from = legs[index];
    const to = legs[index + 1];
    const steps = Math.max(1, Math.ceil(distanceMeters(from, to) / SAMPLE_STEP_M));

    for (let step = 0; step < steps; step += 1) {
      const t = step / steps;
      route.push({
        lat: from.lat + (to.lat - from.lat) * t,
        lng: from.lng + (to.lng - from.lng) * t,
        atStand: false,
      });
    }
  }

  route.push({ ...standPoint, atStand: true });

  return { route, startLabel: pinLabel(start.pin) };
}

export function getAccessScentCheck(
  stand: Stand,
  propertyPins: MapPin[],
  windCompass: string | undefined,
): AccessScentCheck {
  const windFrom = windCompass ? compassToDegrees(windCompass.toUpperCase()) : null;

  if (windFrom === null) {
    return { status: "unknown", label: "Wind unknown", detail: "" };
  }

  const standPin = findStandLocation(stand, propertyPins);

  if (!standPin) {
    return {
      status: "unknown",
      label: "Not on the map",
      detail: "Place this stand on the map to check your walk in.",
    };
  }

  const beds = propertyPins.filter((pin) => BEDDING_TYPES.includes(pin.type));

  if (beds.length === 0) {
    return {
      status: "unknown",
      label: "No bedding pins",
      detail: "Drop bedding pins on the map to check your walk in.",
    };
  }

  const { route, startLabel } = buildAccessRoute(standPin, propertyPins);
  const downwind = (windFrom + 180) % 360;

  // Closest problem wins: a bump beats a scent plume, nearer beats farther.
  let worst: { kind: "bump" | "scent"; meters: number; bed: MapPin; atStand: boolean } | null =
    null;

  for (const point of route) {
    for (const bed of beds) {
      const meters = distanceMeters(point, bed);

      if (meters <= BUMP_DISTANCE_M && !point.atStand) {
        if (!worst || worst.kind !== "bump" || meters < worst.meters) {
          worst = { kind: "bump", meters, bed, atStand: false };
        }
        continue;
      }

      if (meters > SCENT_REACH_M) continue;

      const toBed = bearingBetween(point.lat, point.lng, bed.lat, bed.lng);

      if (
        angleDiff(toBed, downwind) <= SCENT_CONE_HALF_ANGLE &&
        (!worst || (worst.kind === "scent" && meters < worst.meters))
      ) {
        worst = { kind: "scent", meters, bed, atStand: point.atStand };
      }
    }
  }

  const wind = windCompass!.toUpperCase();

  if (!worst) {
    return {
      status: "clear",
      label: "Walk in is clear",
      detail: startLabel
        ? `${wind} wind keeps your scent off bedding from ${startLabel} to the stand.`
        : `${wind} wind keeps your scent off bedding at the stand. Add a parking or gate pin to check the walk in.`,
    };
  }

  const bedName = pinLabel(worst.bed);
  const distance = `${yards(worst.meters)} yd`;

  if (worst.kind === "bump") {
    return {
      status: "risk",
      label: "Walk passes bedding",
      detail: `Your route from ${startLabel} passes within ${distance} of ${bedName}.`,
    };
  }

  return {
    status: "risk",
    label: worst.atStand ? "Scent into bedding" : "Walk in blows scent",
    detail: worst.atStand
      ? `${wind} wind carries scent from the stand toward ${bedName} (${distance}).`
      : `${wind} wind carries scent from your walk in toward ${bedName} (${distance}).`,
  };
}

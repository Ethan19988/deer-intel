import { findStandLocation } from "@/lib/accessScent";
import { distanceMeters } from "@/lib/movementPrediction";
import { bearingBetween } from "@/lib/travelDirection";
import { emptyWindMarks, WIND_POINTS, type WindMarks } from "@/lib/windPicker";
import type { MapPin, PinType } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// Suggest a stand's good and avoid winds from the map, so the hunter doesn't
// have to work out compass bearings in their head. Deer come from bedding, and
// a wind is named for where it comes FROM: a wind blowing from the bedding
// toward the stand carries your scent away behind you (good), and the opposite
// wind carries it straight into the beds (avoid).

const BEDDING_TYPES: PinType[] = ["Bedding", "Bedding Area"];
// Bedding farther than this isn't what a stand is set up on.
export const SUGGEST_REACH_M = 800;
const METERS_TO_YARDS = 1.0936;

export type StandWindSuggestion =
  | { marks: WindMarks; reason: string }
  | { marks: null; reason: string };

function sectorOf(bearing: number): number {
  return Math.round(bearing / 45) % 8;
}

function label(pin: MapPin): string {
  return pin.name?.trim() || pin.notes?.trim() || "Bedding";
}

export function suggestStandWinds(stand: Stand, pins: MapPin[]): StandWindSuggestion {
  const location = findStandLocation(stand, pins);
  if (!location) {
    return {
      marks: null,
      reason: "Place this stand on the map to get a wind suggestion.",
    };
  }

  const beds = pins
    .filter((pin) => pin.propertyId === stand.propertyId && BEDDING_TYPES.includes(pin.type))
    .map((pin) => ({
      pin,
      distance: distanceMeters(location, pin),
      sector: sectorOf(bearingBetween(location.lat, location.lng, pin.lat, pin.lng)),
    }))
    .filter((bed) => bed.distance <= SUGGEST_REACH_M)
    .sort((a, b) => a.distance - b.distance);

  if (beds.length === 0) {
    return {
      marks: null,
      reason: "Mark a bedding area within about 900 yards of this stand to get a wind suggestion.",
    };
  }

  const marks = emptyWindMarks();
  const bedSectors = new Set(beds.map((bed) => bed.sector));

  // Good: the wind coming from each bed, and one point either side.
  for (const sector of bedSectors) {
    for (const offset of [-1, 0, 1]) {
      marks[WIND_POINTS[(sector + offset + 8) % 8]] = "good";
    }
  }
  // Avoid: winds blowing from the stand toward any bed. These win over good —
  // with beds on both sides, a wind that's safe for one still busts the other.
  for (const sector of bedSectors) {
    for (const offset of [3, 4, 5]) {
      marks[WIND_POINTS[(sector + offset) % 8]] = "avoid";
    }
  }

  const nearest = beds[0];
  const yards = Math.round((nearest.distance * METERS_TO_YARDS) / 10) * 10;
  const from = WIND_POINTS[nearest.sector];
  const more = beds.length > 1 ? ` (plus ${beds.length - 1} more bedding pin${beds.length === 2 ? "" : "s"})` : "";
  return {
    marks,
    reason: `${label(nearest.pin)} is ${yards} yd ${from} of this stand${more}. A ${from} wind carries your scent away from it; the opposite wind blows straight into it.`,
  };
}

/** Pins worth showing around a stand on the wind map. */
export const WIND_MAP_PIN_TYPES: PinType[] = [
  "Bedding",
  "Bedding Area",
  "Food",
  "Food Source",
  "Parking",
  "Gate",
  "Water",
  "Water Source",
];

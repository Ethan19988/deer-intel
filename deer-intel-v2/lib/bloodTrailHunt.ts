import { findStandLocation } from "@/lib/accessScent";
import { degreesToCompass } from "@/lib/compass";
import { createHuntFromValues, formatTimeInput, newHuntFormValues } from "@/lib/huntFormValues";
import { distanceMeters, type LatLng } from "@/lib/movementPrediction";
import { bearingBetween } from "@/lib/travelDirection";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// "Save to Hunt Log" for a finished blood trail: a hunt record for the
// property, filed under the stand nearest the hit site, with notes that sum up
// the recovery.

const YARDS_PER_METER = 1.09361;

function formatCoordinate(value: number): string {
  return value.toFixed(5);
}

/**
 * The property's stand nearest `point`, located through its map pin. With no
 * stand on the map, a property with exactly one stand still uses it (meters
 * null). Null when there's no stand to file under.
 */
export function nearestStandTo(
  point: LatLng,
  stands: Stand[],
  pins: MapPin[],
): { stand: Stand; meters: number | null } | null {
  let best: { stand: Stand; meters: number } | null = null;

  for (const stand of stands) {
    const pin = findStandLocation(stand, pins);
    if (!pin) continue;
    const meters = distanceMeters(point, pin);
    if (!best || meters < best.meters) best = { stand, meters };
  }

  if (best) return best;
  return stands.length === 1 ? { stand: stands[0], meters: null } : null;
}

export type BloodTrailSummary = {
  marks: LatLng[];
  /** Length walked along the marks (the trail line), meters. */
  trailMeters: number;
  recovered: boolean;
};

export function bloodTrailNotes({ marks, trailMeters, recovered }: BloodTrailSummary): string {
  const hit = marks[0];
  const last = marks[marks.length - 1];
  const lines = [
    `Blood trail · recovered: ${recovered ? "yes" : "no"}`,
    `Hit site: ${formatCoordinate(hit.lat)}, ${formatCoordinate(hit.lng)}`,
  ];

  if (marks.length >= 2) {
    const straight = distanceMeters(hit, last);
    const direction = degreesToCompass(bearingBetween(hit.lat, hit.lng, last.lat, last.lng));
    lines.push(
      `Trail: ${Math.round(trailMeters * YARDS_PER_METER)} yd tracked, ` +
        `${Math.round(straight * YARDS_PER_METER)} yd straight-line ${direction} from the hit`,
    );
    lines.push(
      recovered
        ? `Recovered at: ${formatCoordinate(last.lat)}, ${formatCoordinate(last.lng)}`
        : `Last blood: ${formatCoordinate(last.lat)}, ${formatCoordinate(last.lng)}`,
    );
  }

  lines.push(`${marks.length} mark${marks.length === 1 ? "" : "s"} on the map`);
  return lines.join("\n");
}

export type BloodTrailHuntResult =
  | { ok: true; hunt: HuntLogEntry; standName: string }
  | { ok: false; reason: string };

export function buildBloodTrailHunt(input: {
  id: string;
  propertyId: string;
  stands: Stand[];
  pins: MapPin[];
  summary: BloodTrailSummary;
  startedAt: Date;
  endedAt: Date;
  windDirection?: string;
  windSpeed?: string;
}): BloodTrailHuntResult {
  const { id, propertyId, summary, startedAt, endedAt } = input;
  if (summary.marks.length === 0) {
    return { ok: false, reason: "Mark the hit site before saving the trail." };
  }

  const stands = input.stands.filter((stand) => stand.propertyId === propertyId);
  const pins = input.pins.filter((pin) => pin.propertyId === propertyId);
  const nearest = nearestStandTo(summary.marks[0], stands, pins);
  if (!nearest) {
    return {
      ok: false,
      reason:
        stands.length === 0
          ? "The Hunt Log files every entry under a stand. Add a stand to this property, then save the trail."
          : "The Hunt Log files every entry under a stand. Place this property's stands on the map so the nearest one to the hit can be used.",
    };
  }

  const values = {
    ...newHuntFormValues(startedAt, { propertyId, standId: nearest.stand.id }),
    endTime: formatTimeInput(endedAt),
    windDirection: input.windDirection ?? "",
    windSpeed: input.windSpeed ?? "",
    shotOpportunity: "Yes" as const,
    harvest: summary.recovered ? ("Yes" as const) : ("No" as const),
    notes: bloodTrailNotes(summary),
  };
  const hunt = createHuntFromValues({ id, values, stands });
  if (!hunt) return { ok: false, reason: "Couldn't build a Hunt Log entry for this trail." };

  return { ok: true, hunt, standName: nearest.stand.name };
}

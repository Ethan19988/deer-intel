import { findStandLocation } from "@/lib/accessScent";
import type { MovementPeriod } from "@/lib/movementPrediction";
import type { StandCheckRow } from "@/lib/standCheck";
import { getStandWindCheck, type StandWindStatus } from "@/lib/standWind";
import type { SitPeriodKey } from "@/lib/todayVerdict";
import { clockToMinutes } from "@/lib/windViz";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// The map's "Today's play" list. Right now it is the Today verdict's own
// ranking (lib/usePropertyToday → verdict.check.rows), so the map, Today and
// Stands can't disagree; with a future timeline window picked it ranks on that
// window's forecast wind instead.

export type StandPlay = {
  id: string;
  name: string;
  standType: string;
  status: StandWindStatus;
  label: string;
  accessNote: string;
  assetId: string | null;
  /** The verdict's pick for the sit. */
  isPick?: boolean;
  /** Extra caution, e.g. "Walk in blows scent" or "Burned · 3 sits this week". */
  caution?: string;
};

const SIT_SHORT: Record<SitPeriodKey, string> = {
  morning: "This AM",
  evening: "Tonight",
  tomorrow: "Tomorrow AM",
};

/** "Tomorrow AM · WNW", "Tonight · Calm", "This AM · wind pending". */
export function sitPlayLabel(
  period: SitPeriodKey,
  wind: string | undefined,
  calm = false,
): string {
  const windPart = calm ? "Calm" : wind || "wind pending";
  return `${SIT_SHORT[period]} · ${windPart}`;
}

function representativeMinutes(
  period: MovementPeriod,
  sunriseMin: number,
  sunsetMin: number,
): number {
  switch (period) {
    case "dawn":
      return sunriseMin + 30;
    case "midday":
      return Math.round((sunriseMin + sunsetMin) / 2);
    case "dusk":
      return sunsetMin - 30;
    case "night":
      return Math.min(sunsetMin + 120, 23 * 60 + 30);
  }
}

/** Minutes past midnight → "5 PM" / "6:30 AM" (to the nearest half hour). */
export function halfHourClock(minutes: number): string {
  const rounded = ((Math.round(minutes / 30) * 30) % 1440 + 1440) % 1440;
  const hour24 = Math.floor(rounded / 60);
  const minute = rounded % 60;
  const hour12 = hour24 % 12 === 0 ? 12 : hour24 % 12;
  const suffix = hour24 < 12 ? "AM" : "PM";
  return minute === 0 ? `${hour12} ${suffix}` : `${hour12}:${String(minute).padStart(2, "0")} ${suffix}`;
}

/**
 * "Forecast · 5 PM" for a timeline window today, "Forecast · Thu 7 AM" for a
 * later day. Falls back to the window name without sun times.
 */
export function forecastSlotLabel(
  slot: { period: MovementPeriod; dayIndex: number; dayLabel: string },
  sunrise: string | undefined,
  sunset: string | undefined,
): string {
  const sunriseMin = sunrise ? clockToMinutes(sunrise) : null;
  const sunsetMin = sunset ? clockToMinutes(sunset) : null;
  const when =
    sunriseMin !== null && sunsetMin !== null
      ? halfHourClock(representativeMinutes(slot.period, sunriseMin, sunsetMin))
      : slot.period;
  const day =
    slot.dayIndex > 0 && slot.dayLabel
      ? `${slot.dayLabel.charAt(0)}${slot.dayLabel.slice(1, 3).toLowerCase()} `
      : "";
  return `Forecast · ${day}${when}`;
}

/**
 * Stand id → map asset id, matched through the stand's map pin
 * (stand.sourcePinId, else a name match — lib/accessScent.findStandLocation)
 * so renaming a stand or its pin doesn't drop the link.
 */
export function standAssetIds(
  stands: Stand[],
  pins: MapPin[],
  assets: Array<{ id: string; pinId?: string }>,
): Map<string, string> {
  const assetByPin = new Map<string, string>();
  for (const asset of assets) {
    if (asset.pinId) assetByPin.set(asset.pinId, asset.id);
  }

  const result = new Map<string, string>();
  for (const stand of stands) {
    const pin = findStandLocation(stand, pins);
    const assetId = pin ? assetByPin.get(pin.id) : undefined;
    if (assetId) result.set(stand.id, assetId);
  }
  return result;
}

/** Pin id → the stand record placed on it (inverse of findStandLocation). */
export function standsByPinId(stands: Stand[], pins: MapPin[]): Map<string, Stand> {
  const result = new Map<string, Stand>();
  for (const stand of stands) {
    const pin = findStandLocation(stand, pins);
    if (pin && !result.has(pin.id)) result.set(pin.id, stand);
  }
  return result;
}

function basePlay(stand: Stand, assetIds: Map<string, string>) {
  return {
    id: stand.id,
    name: stand.name || "Unnamed stand",
    standType: stand.standType,
    accessNote: stand.accessRouteNotes.trim(),
    assetId: assetIds.get(stand.id) ?? null,
  };
}

/** The Today verdict's rows, in its order (pick first), as map plays. */
export function playsFromCheckRows(
  rows: StandCheckRow[],
  pickId: string | null,
  assetIds: Map<string, string>,
): StandPlay[] {
  return rows.map((row) => {
    const cautions: string[] = [];
    if (row.scent.status === "risk") cautions.push(row.scent.label);
    if (row.pressure.level !== "fresh") cautions.push(row.pressure.label);
    return {
      ...basePlay(row.stand, assetIds),
      status: row.wind.status,
      label: row.wind.label,
      isPick: row.stand.id === pickId,
      caution: cautions.join(" · ") || undefined,
    };
  });
}

const STATUS_ORDER: Record<StandWindStatus, number> = {
  good: 0,
  marginal: 1,
  unknown: 2,
  avoid: 3,
};

/** Stands ranked on one forecast wind: good first, wrong wind last. */
export function playsForWind(
  stands: Stand[],
  wind: string | undefined,
  assetIds: Map<string, string>,
): StandPlay[] {
  return stands
    .map((stand) => {
      const check = getStandWindCheck(stand, wind);
      return { ...basePlay(stand, assetIds), status: check.status, label: check.label };
    })
    .sort(
      (a, b) => STATUS_ORDER[a.status] - STATUS_ORDER[b.status] || a.name.localeCompare(b.name),
    );
}

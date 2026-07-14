// Wind + thermal map viz helpers. Turns the live wind reading (a compass string
// like "NW" plus a speed) into on-map geometry: a downwind "scent cone" from a
// stand showing where a deer would wind you, plus a simple time-of-day thermal
// cue. Kept framework-free so it's easy to unit-test and reuse.

const COMPASS_16 = [
  "N",
  "NNE",
  "NE",
  "ENE",
  "E",
  "ESE",
  "SE",
  "SSE",
  "S",
  "SSW",
  "SW",
  "WSW",
  "W",
  "WNW",
  "NW",
  "NNW",
];

export type LatLng = { lat: number; lng: number };

/** Compass point ("NW") → bearing in degrees (0 = N), or null if unrecognized. */
export function compassToBearing(compass: string): number | null {
  const index = COMPASS_16.indexOf(compass.toUpperCase().trim());
  return index < 0 ? null : index * 22.5;
}

/** Pull the leading number out of a speed label like "8 mph" or "12 km/h". */
export function parseWindSpeed(speed: string): number | null {
  const match = speed.match(/(\d+(?:\.\d+)?)/);
  return match ? Number(match[1]) : null;
}

const EARTH_RADIUS_M = 6371000;

/** Point reached from an origin heading `bearingDeg` for `distanceM` metres. */
function destination(
  origin: LatLng,
  bearingDeg: number,
  distanceM: number,
): [number, number] {
  const bearing = (bearingDeg * Math.PI) / 180;
  const lat1 = (origin.lat * Math.PI) / 180;
  const lng1 = (origin.lng * Math.PI) / 180;
  const angular = distanceM / EARTH_RADIUS_M;

  const lat2 = Math.asin(
    Math.sin(lat1) * Math.cos(angular) +
      Math.cos(lat1) * Math.sin(angular) * Math.cos(bearing),
  );
  const lng2 =
    lng1 +
    Math.atan2(
      Math.sin(bearing) * Math.sin(angular) * Math.cos(lat1),
      Math.cos(angular) - Math.sin(lat1) * Math.sin(lat2),
    );

  return [
    (lat2 * 180) / Math.PI,
    (((lng2 * 180) / Math.PI + 540) % 360) - 180,
  ];
}

export type ScentConeOptions = {
  /** Down-wind reach of the cone in metres. */
  lengthM: number;
  /** Total angular width of the cone in degrees. */
  spreadDeg: number;
};

/**
 * A polygon fanning down-wind from `origin`: apex at the stand, arc out where
 * the scent drifts. Wind is reported as the direction it blows *from*, so scent
 * travels toward `from + 180`. Returns null when the wind direction is unknown.
 */
export function scentConePolygon(
  origin: LatLng,
  windFromCompass: string,
  options: ScentConeOptions,
): Array<[number, number]> | null {
  const from = compassToBearing(windFromCompass);
  if (from === null) return null;

  const downwind = (from + 180) % 360;
  const half = options.spreadDeg / 2;
  const steps = 8;
  const points: Array<[number, number]> = [[origin.lat, origin.lng]];

  for (let i = 0; i <= steps; i += 1) {
    const offset = -half + (options.spreadDeg * i) / steps;
    points.push(destination(origin, downwind + offset, options.lengthM));
  }

  return points;
}

/**
 * A filled arrow polygon pointing the way the wind blows (down-wind), apex tail
 * at `origin`. Reuses the cone's length so the arrow grows with wind speed.
 * Returns null when the wind direction is unknown.
 */
export function windArrowPolygon(
  origin: LatLng,
  windFromCompass: string,
  options: ScentConeOptions,
): Array<[number, number]> | null {
  const from = compassToBearing(windFromCompass);
  if (from === null) return null;

  const downwind = (from + 180) % 360;
  const length = options.lengthM;
  const shaftHalf = length * 0.05;
  const headHalf = length * 0.13;
  const shaftEnd = length * 0.62;

  // Map a local (forward along the wind, right across it) offset in metres to a
  // lat/lng: step down-wind, then step across. Negative `right` goes left.
  const local = (forward: number, right: number): [number, number] => {
    const [lat, lng] = destination(origin, downwind, forward);
    return destination({ lat, lng }, (downwind + 90) % 360, right);
  };

  return [
    local(0, -shaftHalf),
    local(shaftEnd, -shaftHalf),
    local(shaftEnd, -headHalf),
    local(length, 0),
    local(shaftEnd, headHalf),
    local(shaftEnd, shaftHalf),
    local(0, shaftHalf),
  ];
}

/** Cone reach + spread from wind speed: stronger wind carries scent farther and
 *  tighter; light/variable wind spreads wider. */
export function scentConeOptionsForSpeed(speedMph: number | null): ScentConeOptions {
  const speed = speedMph ?? 4;
  const lengthM = Math.max(120, Math.min(420, 120 + speed * 18));
  const spreadDeg = speed < 5 ? 64 : speed < 12 ? 46 : 36;
  return { lengthM, spreadDeg };
}

export type ThermalPhase = "downhill" | "uphill" | "neutral";

export type ThermalCue = {
  phase: ThermalPhase;
  label: string;
  hint: string;
};

/**
 * Minutes past local midnight for a sun time. Accepts what the live-weather
 * layer actually hands us — a localized clock string like "6:12 AM" or "18:45" —
 * and also a full ISO datetime, so callers don't have to care which. Null if it
 * can't be parsed.
 */
export function clockToMinutes(value: string): number | null {
  if (!value) return null;
  const trimmed = value.trim();

  const twelveHour = /^(\d{1,2}):(\d{2})\s*([AaPp][Mm])$/.exec(trimmed);
  if (twelveHour) {
    let hour = Number(twelveHour[1]) % 12;
    if (/[Pp]/.test(twelveHour[3])) hour += 12;
    return hour * 60 + Number(twelveHour[2]);
  }

  if (/\d{4}-\d{2}-\d{2}T/.test(trimmed)) {
    const date = new Date(trimmed);
    if (!Number.isNaN(date.getTime())) {
      return date.getHours() * 60 + date.getMinutes();
    }
  }

  const twentyFour = /^(\d{1,2}):(\d{2})$/.exec(trimmed);
  if (twentyFour) {
    const hour = Number(twentyFour[1]);
    const minute = Number(twentyFour[2]);
    if (hour <= 23 && minute <= 59) return hour * 60 + minute;
  }

  return null;
}

/**
 * Rough time-of-day thermal drift. Cold air sinks, so around sunrise and again
 * near sunset thermals fall downslope; through the warm middle of the day they
 * rise upslope. Directions still depend on the actual terrain, so this is a cue,
 * not an arrow. Times come from the day's sunrise/sunset (clock string or ISO).
 */
export function thermalCue(
  now: Date,
  sunrise: string,
  sunset: string,
): ThermalCue {
  const sunriseMin = clockToMinutes(sunrise);
  const sunsetMin = clockToMinutes(sunset);

  if (sunriseMin === null || sunsetMin === null) {
    return {
      phase: "neutral",
      label: "Thermals unknown",
      hint: "No sunrise/sunset for this spot.",
    };
  }

  const nowMin = now.getHours() * 60 + now.getMinutes();
  const risingStart = sunriseMin + 90; // ~90 min after sunrise
  const fallingStart = sunsetMin - 60; // ~1 h before sunset

  if (nowMin < sunriseMin) {
    return {
      phase: "downhill",
      label: "Thermals falling (pre-dawn)",
      hint: "Cold air sinks downhill — expect scent to pull toward low ground.",
    };
  }

  if (nowMin < risingStart) {
    return {
      phase: "downhill",
      label: "Thermals falling (morning)",
      hint: "Ground's still cold — thermals drift downslope until it warms.",
    };
  }

  if (nowMin < fallingStart) {
    return {
      phase: "uphill",
      label: "Thermals rising (midday)",
      hint: "Warming air lifts scent upslope — favor stands below the deer.",
    };
  }

  return {
    phase: "downhill",
    label: "Thermals falling (evening)",
    hint: "Cooling air sinks downhill again — scent pulls toward the valley.",
  };
}

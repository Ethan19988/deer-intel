import { COMPASS_16, isCompassPoint, parseCompassPoints } from "@/lib/compass";
import type { Stand } from "@/types/stand";

// Whether today's wind favors sitting a stand: compare the current wind
// direction against the stand's saved best / avoid winds. A stand is usually
// listed with the wind directions that keep your scent off the deer, so an
// exact or one-point-adjacent match reads as a real signal.

export type StandWindStatus = "good" | "avoid" | "marginal" | "unknown";

export type StandWindCheck = {
  status: StandWindStatus;
  label: string;
  /** Wind under CALM_WIND_MPH: graded marginal as "Light & variable". */
  calm?: boolean;
};

/** Pull the compass points out of a free-text wind note like "NW, N or W". */
export const parseWindDirections = parseCompassPoints;

// Below this the wind has no real direction: air drifts and swirls with the
// thermals, so a stand's best / avoid winds don't predict where scent goes.
export const CALM_WIND_MPH = 3;
const KMH_PER_MPH = 1.609344;

/**
 * Wind speed in mph from a number (already mph) or a label like "8 mph",
 * "12 km/h" or "SW 2 mph". Null when there's no number to read.
 */
export function windSpeedMph(speed: string | number | undefined | null): number | null {
  if (typeof speed === "number") return Number.isFinite(speed) ? speed : null;
  if (!speed) return null;

  const match = /(\d+(?:\.\d+)?)\s*(km\/?h|kph|kmh)?/i.exec(speed);
  if (!match) return null;

  const value = Number(match[1]);
  return match[2] ? value / KMH_PER_MPH : value;
}

/** True when a known wind speed is too light to carry scent one way. */
export function isCalmWind(speed: string | number | undefined | null): boolean {
  const mph = windSpeedMph(speed);
  return mph !== null && mph < CALM_WIND_MPH;
}

function circularDistance(a: number, b: number): number {
  const diff = Math.abs(a - b);
  return Math.min(diff, COMPASS_16.length - diff);
}

/** True when `current` is the same as, or one point either side of, `target`. */
function isCloseDirection(current: string, target: string): boolean {
  const currentIndex = COMPASS_16.indexOf(current);
  const targetIndex = COMPASS_16.indexOf(target);

  if (currentIndex < 0 || targetIndex < 0) return false;

  return circularDistance(currentIndex, targetIndex) <= 1;
}

function matchesAny(current: string, directions: string[]): boolean {
  return directions.some((direction) => isCloseDirection(current, direction));
}

/**
 * Grade a stand on a wind. `windSpeed` is optional (a number in mph, or a
 * label like "2 mph" / "4 km/h"); when it's under CALM_WIND_MPH the wind has no
 * dependable direction, so the stand reads marginal "Light & variable" rather
 * than a good or wrong wind it can't really have.
 */
export function getStandWindCheck(
  stand: Stand,
  currentWindDirection: string | undefined,
  windSpeed?: string | number | null,
): StandWindCheck {
  const current = (currentWindDirection ?? "").trim().toUpperCase();

  if (!isCompassPoint(current)) {
    return { status: "unknown", label: "Wind unknown" };
  }

  const best = parseWindDirections(stand.bestWinds);
  const avoid = parseWindDirections(stand.avoidWinds);

  if (best.length === 0 && avoid.length === 0) {
    return { status: "unknown", label: "No wind notes" };
  }

  if (isCalmWind(windSpeed)) {
    return { status: "marginal", label: "Light & variable", calm: true };
  }

  // A wrong wind is a hard no, so it wins over a "good" match.
  if (matchesAny(current, avoid)) {
    return { status: "avoid", label: `Wrong wind (${current})` };
  }

  if (matchesAny(current, best)) {
    return { status: "good", label: `Good wind (${current})` };
  }

  return { status: "marginal", label: `Off wind (${current})` };
}

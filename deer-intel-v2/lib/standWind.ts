import type { Stand } from "@/types/stand";

// Whether today's wind favors sitting a stand: compare the current wind
// direction against the stand's saved best / avoid winds. A stand is usually
// listed with the wind directions that keep your scent off the deer, so an
// exact or one-point-adjacent match reads as a real signal.

export type StandWindStatus = "good" | "avoid" | "marginal" | "unknown";

export type StandWindCheck = {
  status: StandWindStatus;
  label: string;
};

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

const COMPASS_SET = new Set(COMPASS_16);

/** Pull the compass points out of a free-text wind note like "NW, N or W". */
export function parseWindDirections(text: string): string[] {
  return (text.toUpperCase().match(/[NSEW]{1,3}/g) ?? []).filter((token) =>
    COMPASS_SET.has(token),
  );
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

export function getStandWindCheck(
  stand: Stand,
  currentWindDirection: string | undefined,
): StandWindCheck {
  const current = (currentWindDirection ?? "").toUpperCase();

  if (!COMPASS_SET.has(current)) {
    return { status: "unknown", label: "Wind unknown" };
  }

  const best = parseWindDirections(stand.bestWinds);
  const avoid = parseWindDirections(stand.avoidWinds);

  if (best.length === 0 && avoid.length === 0) {
    return { status: "unknown", label: "No wind notes" };
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

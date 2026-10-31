// One home for 16-wind compass math. Winds are named for where they blow FROM,
// so "NW" means air moving from the northwest toward the southeast. Older
// modules (travelDirection, liveWeather, standWind, huntPlanner) re-export these
// under their original names so existing imports keep working.

export const COMPASS_16: readonly string[] = [
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

const COMPASS_SET: ReadonlySet<string> = new Set(COMPASS_16);

/** True for an exact 16-wind point ("NW"), case-insensitive. */
export function isCompassPoint(point: string): boolean {
  return COMPASS_SET.has(point.trim().toUpperCase());
}

/** "NW" → 315; null for anything that isn't a 16-wind compass point. */
export function compassToDegrees(point: string): number | null {
  const index = COMPASS_16.indexOf(point.trim().toUpperCase());

  return index < 0 ? null : index * 22.5;
}

/** Any bearing in degrees → the nearest 16-wind compass point. */
export function degreesToCompass(degrees: number): string {
  const normalized = ((degrees % 360) + 360) % 360;

  return COMPASS_16[Math.round(normalized / 22.5) % 16];
}

/**
 * Every compass point in free text, in order: "NW, N or W" → ["NW", "N", "W"],
 * "SW 8 mph" → ["SW"], "8mph NW" → ["NW"]. A point must stand on its own
 * between non-letters, so the "N" in "and" or "North" isn't read as north,
 * and a run like "NNNW" that isn't a real point is ignored.
 */
export function parseCompassPoints(text: string): string[] {
  // No regex lookbehind (older iOS Safari lacks it): the leading non-letter is
  // captured and the trailing one is only looked at, so "N W" still yields two.
  const pattern = /(^|[^A-Z])([NSEW]{1,3})(?=[^A-Z]|$)/g;
  const upper = text.toUpperCase();
  const points: string[] = [];
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(upper)) !== null) {
    if (COMPASS_SET.has(match[2])) points.push(match[2]);
  }

  return points;
}

/** The first compass point in a wind string ("NW 8 mph" → "NW"), or null. */
export function parseCompassPoint(text: string): string | null {
  return parseCompassPoints(text)[0] ?? null;
}

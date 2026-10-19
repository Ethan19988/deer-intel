import { parseWindDirections } from "@/lib/standWind";

// The tap-to-set wind compass: eight directions, each marked good, avoid, or
// unset. Stored back into the stand's existing free-text best/avoid fields so
// every wind check keeps working unchanged. The checks treat one compass
// point either side as a match, so NW also covers NNW and WNW.

export const WIND_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type WindPoint = (typeof WIND_POINTS)[number];
export type WindMark = "good" | "avoid" | "none";
export type WindMarks = Record<WindPoint, WindMark>;

export function emptyWindMarks(): WindMarks {
  return Object.fromEntries(WIND_POINTS.map((point) => [point, "none"])) as WindMarks;
}

/** Read existing best/avoid text into marks. 16-point entries snap to the nearest of the 8. */
export function windMarksFromText(bestWinds: string, avoidWinds: string): WindMarks {
  const marks = emptyWindMarks();
  const snap = (direction: string): WindPoint | null => {
    if ((WIND_POINTS as readonly string[]).includes(direction)) return direction as WindPoint;
    // Three-letter points (e.g. "NNW") lie between their 2nd/3rd-letter neighbors;
    // the two-letter half ("NW") is the nearest of the eight.
    const half = direction.slice(1);
    return (WIND_POINTS as readonly string[]).includes(half) ? (half as WindPoint) : null;
  };
  for (const direction of parseWindDirections(bestWinds)) {
    const point = snap(direction);
    if (point) marks[point] = "good";
  }
  // A direction listed as both is treated as avoid, matching the checks.
  for (const direction of parseWindDirections(avoidWinds)) {
    const point = snap(direction);
    if (point) marks[point] = "avoid";
  }
  return marks;
}

export function windTextFromMarks(marks: WindMarks): { bestWinds: string; avoidWinds: string } {
  const pick = (mark: WindMark) =>
    WIND_POINTS.filter((point) => marks[point] === mark).join(", ");
  return { bestWinds: pick("good"), avoidWinds: pick("avoid") };
}

/** Tap order: unset → good → avoid → unset. */
export function nextWindMark(mark: WindMark): WindMark {
  return mark === "none" ? "good" : mark === "good" ? "avoid" : "none";
}

import { parseWindDirections } from "@/lib/standWind";

// The tap-to-set wind compass. The rose has eight wedges, but marks are kept
// for all sixteen points so a saved "NNW" stays NNW (snapping it to NW would
// widen the match to WNW..N). Marks are stored back into the stand's existing
// free-text best/avoid fields so every wind check keeps working unchanged. The
// checks treat one compass point either side as a match, so NW also covers NNW
// and WNW.

export const WIND_POINTS = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type WindPoint = (typeof WIND_POINTS)[number];

/** All sixteen points in compass order (same order as lib/compass COMPASS_16). */
export const WIND_POINTS_16 = [
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
] as const;
export type WindDirection = (typeof WIND_POINTS_16)[number];

/** The in-between points (NNE, ENE, …) the eight wedges don't show. */
export const WIND_IN_BETWEEN_POINTS: WindDirection[] = WIND_POINTS_16.filter(
  (point) => !(WIND_POINTS as readonly string[]).includes(point),
);

export type WindMark = "good" | "avoid" | "none";
export type WindMarks = Record<WindDirection, WindMark>;

export function emptyWindMarks(): WindMarks {
  return Object.fromEntries(WIND_POINTS_16.map((point) => [point, "none"])) as WindMarks;
}

function isWindDirection(point: string): point is WindDirection {
  return (WIND_POINTS_16 as readonly string[]).includes(point);
}

/** Read existing best/avoid text into marks, keeping 16-point entries as they are. */
export function windMarksFromText(bestWinds: string, avoidWinds: string): WindMarks {
  const marks = emptyWindMarks();
  for (const direction of parseWindDirections(bestWinds)) {
    if (isWindDirection(direction)) marks[direction] = "good";
  }
  // A direction listed as both is treated as avoid, matching the checks.
  for (const direction of parseWindDirections(avoidWinds)) {
    if (isWindDirection(direction)) marks[direction] = "avoid";
  }
  return marks;
}

export function windTextFromMarks(marks: WindMarks): { bestWinds: string; avoidWinds: string } {
  const pick = (mark: WindMark) =>
    WIND_POINTS_16.filter((point) => marks[point] === mark).join(", ");
  return { bestWinds: pick("good"), avoidWinds: pick("avoid") };
}

/** Points with a given mark, in compass order. */
export function markedPoints(marks: WindMarks, mark: Exclude<WindMark, "none">): WindDirection[] {
  return WIND_POINTS_16.filter((point) => marks[point] === mark);
}

/** Tap order: unset → good → avoid → unset. */
export function nextWindMark(mark: WindMark): WindMark {
  return mark === "none" ? "good" : mark === "good" ? "avoid" : "none";
}

// Words that are only list glue between directions ("NW, N or W").
const GLUE_WORDS = new Set(["AND", "OR", "TO", "THRU", "THROUGH", "WIND", "WINDS"]);

/**
 * True when a saved wind note has words the compass can't represent ("only
 * before 9am", "north-ish", "any but east"). Rewriting such a note from the
 * compass would lose them, so callers keep the text as-is unless the hunter
 * actually changes that field's directions, and warn first.
 */
export function hasUnreadableWindText(text: string): boolean {
  const tokens = text
    .toUpperCase()
    .split(/[^A-Z0-9]+/)
    .filter(Boolean);
  return tokens.some((token) => !isWindDirection(token) && !GLUE_WORDS.has(token));
}

function sameSet(a: readonly string[], b: readonly string[]): boolean {
  return a.length === b.length && a.every((value) => b.includes(value));
}

/**
 * The best/avoid text to save. A field whose directions didn't change keeps
 * its original text word-for-word (so a note the compass can't read — or an
 * order/spelling the hunter chose — is never wiped by an unchanged save); a
 * field that did change is rewritten from the compass.
 */
export function windTextForSave(
  previous: { bestWinds: string; avoidWinds: string },
  marks: WindMarks,
): { bestWinds: string; avoidWinds: string } {
  const before = windMarksFromText(previous.bestWinds, previous.avoidWinds);
  const next = windTextFromMarks(marks);
  return {
    bestWinds: sameSet(markedPoints(before, "good"), markedPoints(marks, "good"))
      ? previous.bestWinds
      : next.bestWinds,
    avoidWinds: sameSet(markedPoints(before, "avoid"), markedPoints(marks, "avoid"))
      ? previous.avoidWinds
      : next.avoidWinds,
  };
}

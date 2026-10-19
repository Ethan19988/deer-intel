import { distanceBetweenMeters } from "@/lib/walkTrack";

// Blood-trail geometry. While tracking, the phone records the path you walk;
// each blood mark remembers how much of that path existed when it was dropped.
// The trail between two marks is then the ground you actually covered between
// those finds — around the blowdown, down the ditch — instead of a straight
// line between dots. Without GPS between two marks it falls back to straight.

export type LatLngPoint = { lat: number; lng: number };

export type BloodMark = LatLngPoint & {
  /** Length of the walked path when this mark was dropped. */
  pathIndex: number;
};

// GPS fixes worse than this are guesses; drawing them puts zigzags in the
// trail that you never walked.
export const MAX_FIX_ACCURACY_M = 25;
// Ignore moves smaller than this — standing still, the fix wanders a few meters.
export const MIN_PATH_STEP_M = 3;

/** Should this fix be added to the walked path? */
export function acceptPathFix(
  path: LatLngPoint[],
  fix: LatLngPoint,
  accuracyM: number | null | undefined,
  minStepM = MIN_PATH_STEP_M,
): boolean {
  if (typeof accuracyM === "number" && accuracyM > MAX_FIX_ACCURACY_M) return false;
  const last = path[path.length - 1];
  return !last || meters(last, fix) >= minStepM;
}

function meters(a: LatLngPoint, b: LatLngPoint): number {
  return distanceBetweenMeters({ ...a, at: "" }, { ...b, at: "" });
}

/**
 * The trail as one line: each mark, joined to the next by the stretch of walked
 * path recorded between them.
 */
export function bloodTrailLine(marks: BloodMark[], path: LatLngPoint[]): LatLngPoint[] {
  const line: LatLngPoint[] = [];
  marks.forEach((mark, index) => {
    if (index > 0) {
      const from = Math.max(0, Math.min(marks[index - 1].pathIndex, path.length));
      const to = Math.max(from, Math.min(mark.pathIndex, path.length));
      line.push(...path.slice(from, to));
    }
    line.push({ lat: mark.lat, lng: mark.lng });
  });
  return line;
}

/** The walk since the last mark — where you've already looked. */
export function searchedSinceLastMark(marks: BloodMark[], path: LatLngPoint[]): LatLngPoint[] {
  const last = marks[marks.length - 1];
  if (!last) return [];
  const tail = path.slice(Math.min(last.pathIndex, path.length));
  return tail.length ? [{ lat: last.lat, lng: last.lng }, ...tail] : [];
}

export function lineLengthMeters(line: LatLngPoint[]): number {
  let total = 0;
  for (let index = 1; index < line.length; index += 1) {
    total += meters(line[index - 1], line[index]);
  }
  return total;
}

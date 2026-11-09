// Which state's rules a spot falls under, for the few places the app's PA
// rules don't carry over. Only Maryland is told apart today: legal light
// (30 min either side of sunrise/sunset) is the same there, but Sunday deer
// hunting is set county by county and often ends early (e.g. 10:30 AM) or is
// limited to certain Sundays.

// [longitude, southernmost Maryland latitude] going west → east along the
// Potomac and then the VA line across the Bay. Rough (±~0.05°), enough to tell
// a MD property from a WV/VA one for a caveat.
const MD_SOUTH_EDGE: ReadonlyArray<readonly [number, number]> = [
  [-79.48, 39.2],
  [-79.0, 39.4],
  [-78.5, 39.55],
  [-78.18, 39.68],
  [-77.8, 39.43],
  [-77.73, 39.32],
  [-77.5, 39.27],
  [-77.0, 38.9],
  [-76.3, 38.0],
  [-75.05, 38.0],
];

/** The Mason-Dixon line, PA's southern border. */
const MASON_DIXON_LAT = 39.7213;
/** Maryland's western edge (the Fairfax meridian line with WV). */
const MD_WEST_LNG = -79.4772;
/** Maryland's eastern edge at the Atlantic. */
const MD_EAST_LNG = -75.05;
/** The MD/DE line runs north along ~75.79°W from the Transpeninsular line (~38.46°N). */
const DE_WEST_LNG = -75.79;
const DE_SOUTH_LAT = 38.46;

function southEdgeAt(lng: number): number {
  for (let index = 1; index < MD_SOUTH_EDGE.length; index += 1) {
    const [lngB, latB] = MD_SOUTH_EDGE[index];
    if (lng <= lngB) {
      const [lngA, latA] = MD_SOUTH_EDGE[index - 1];
      return latA + ((lng - lngA) / (lngB - lngA)) * (latB - latA);
    }
  }
  return MD_SOUTH_EDGE[MD_SOUTH_EDGE.length - 1][1];
}

/**
 * True when a coordinate is (approximately) in Maryland: south of the
 * Mason-Dixon line, east of the WV meridian line, north of the Potomac / VA
 * line, and west of Delaware and the Atlantic.
 */
export function isLikelyMaryland(point: { lat: number; lng: number } | null | undefined): boolean {
  if (!point || !Number.isFinite(point.lat) || !Number.isFinite(point.lng)) return false;
  const { lat, lng } = point;
  if (lat >= MASON_DIXON_LAT || lng < MD_WEST_LNG || lng > MD_EAST_LNG) return false;
  if (lng > DE_WEST_LNG && lat > DE_SOUTH_LAT) return false; // Delaware
  return lat >= southEdgeAt(lng);
}

/** Short caveat for a Sunday sit on a Maryland property. */
export const MD_SUNDAY_NOTE = "MD: Sunday hours vary by county";

/** True when a "YYYY-MM-DD" date is a Sunday (calendar date, no zone). */
export function isSundayDate(date: string): boolean {
  const [year, month, day] = date.split("-").map(Number);
  if (!year || !month || !day) return false;
  return new Date(Date.UTC(year, month - 1, day)).getUTCDay() === 0;
}

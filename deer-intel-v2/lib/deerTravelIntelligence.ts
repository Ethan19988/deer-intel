// Travel learning for one tracked deer, built purely from the hunter's own
// photo records: which compass direction he moves, on what winds, at what time
// of day, and the camera-to-camera legs he has actually walked. Only photos
// explicitly linked to the profile count — name-mention guesses would pollute
// a pattern that stand decisions ride on.

import { bearingBetween, degreesToCompass, toEightWind } from "@/lib/travelDirection";
import type { Camera } from "@/types/camera";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

export type TravelPattern = {
  title: string;
  detail: string;
};

export type TravelLeg = {
  key: string;
  /** "North Ridge → Creek Crossing" */
  label: string;
  /** "Oct 28, 6:40 AM → 7:15 AM, headed NE — 35 min camera to camera" */
  detail: string;
};

export type DeerTravelIntelligence = {
  sightingCount: number;
  directedCount: number;
  heading: TravelPattern;
  wind: TravelPattern;
  timeOfDay: TravelPattern;
  route: TravelPattern;
  legs: TravelLeg[];
  hasData: boolean;
};

// Two sightings on different cameras this close together read as one movement.
const MAX_LEG_GAP_MINUTES = 6 * 60;

type Sighting = {
  photo: PhotoRecord;
  time: number;
  // Date-only records anchor to noon; they count for direction/wind patterns
  // but can't order a same-day camera-to-camera leg or a time-of-day bucket.
  hasClockTime: boolean;
  cameraId: string;
  // 8-wind sectors so one compass point of jitter doesn't split a pattern.
  direction: string;
  wind: string;
};

type DeerTravelInput = {
  profile: DeerProfile;
  cameras: Camera[];
  photoRecords: PhotoRecord[];
};

export function getDeerTravelIntelligence({
  profile,
  cameras,
  photoRecords,
}: DeerTravelInput): DeerTravelIntelligence {
  const cameraById = new Map(cameras.map((camera) => [camera.id, camera]));
  const sightings = photoRecords
    .filter((photo) => photo.deerProfileId === profile.id)
    .map(toSighting)
    .filter((sighting): sighting is Sighting => sighting !== null)
    .sort((left, right) => left.time - right.time);

  const directed = sightings.filter((sighting) => sighting.direction);
  const withWind = sightings.filter((sighting) => sighting.wind);
  const legs = buildLegs(sightings, cameraById);

  return {
    sightingCount: sightings.length,
    directedCount: directed.length,
    heading: getHeadingPattern(directed),
    wind: getWindPattern(withWind, sightings.length),
    timeOfDay: getTimeOfDayPattern(sightings),
    route: getRoutePattern(legs),
    legs: legs.map(formatLeg),
    hasData: directed.length > 0 || withWind.length > 0 || legs.length > 0,
  };
}

function toSighting(photo: PhotoRecord): Sighting | null {
  const raw = photo.photoDate.trim();

  if (!raw) return null;

  const hasClockTime = /T\d{2}:\d{2}/.test(raw);
  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(raw);
  const time = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
        12,
      ).getTime()
    : Date.parse(raw);

  if (Number.isNaN(time)) return null;

  return {
    photo,
    time,
    hasClockTime,
    cameraId: photo.cameraSiteId,
    direction: toEightWind(photo.travelDirection ?? ""),
    wind: toEightWind(photo.weatherSnapshot?.windDirection ?? ""),
  };
}

function getHeadingPattern(directed: Sighting[]): TravelPattern {
  if (directed.length === 0) {
    return {
      title: "No travel direction yet",
      detail:
        "Set each camera's facing direction so the AI's \"walking left to right\" reads become compass headings, or pick the direction on a photo by hand.",
    };
  }

  const top = topEntry(countBy(directed.map((sighting) => sighting.direction)));

  return {
    title: `Usually headed ${top.key}`,
    detail: `${top.count} of ${directed.length} sightings with a direction have him moving ${top.key}.`,
  };
}

function getWindPattern(
  withWind: Sighting[],
  sightingCount: number,
): TravelPattern {
  if (withWind.length === 0) {
    return {
      title: "No wind pattern yet",
      detail:
        sightingCount > 0
          ? "His photos have no wind data yet — it fills in from the printed stamp or weather history on import."
          : "Link photos to this deer to start reading the winds he moves on.",
    };
  }

  const top = topEntry(countBy(withWind.map((sighting) => sighting.wind)));

  return {
    title: `Moves on ${top.key} winds`,
    detail: `${top.count} of ${withWind.length} sightings with wind data came on a ${top.key} wind.`,
  };
}

function getTimeOfDayPattern(sightings: Sighting[]): TravelPattern {
  const timed = sightings.filter((sighting) => sighting.hasClockTime);

  if (timed.length === 0) {
    return {
      title: "No time pattern yet",
      detail:
        "Photo times unlock this — Camera Import reads the time printed on each photo automatically.",
    };
  }

  const buckets = new Map<string, Sighting[]>();

  timed.forEach((sighting) => {
    const bucket = timeBucket(new Date(sighting.time).getHours());
    const list = buckets.get(bucket) ?? [];

    list.push(sighting);
    buckets.set(bucket, list);
  });

  const summaries: string[] = [];
  let topBucket = "";
  let topBucketSize = 0;
  let topBucketDirection = "";

  for (const bucket of ["Morning", "Midday", "Evening", "Night"]) {
    const list = buckets.get(bucket);

    if (!list) continue;

    const directed = list.filter((sighting) => sighting.direction);
    const direction =
      directed.length > 0
        ? topEntry(countBy(directed.map((sighting) => sighting.direction))).key
        : "";

    summaries.push(
      `${bucket}: ${list.length}${direction ? ` (headed ${direction})` : ""}`,
    );

    if (list.length > topBucketSize) {
      topBucket = bucket;
      topBucketSize = list.length;
      topBucketDirection = direction;
    }
  }

  return {
    title: topBucketDirection
      ? `${topBucket}s, headed ${topBucketDirection}`
      : `Mostly ${topBucket.toLowerCase()}s`,
    detail: summaries.join(" · "),
  };
}

type RawLeg = {
  from: Sighting;
  to: Sighting;
  fromName: string;
  toName: string;
  heading: string;
  minutes: number;
};

// Consecutive sightings on different cameras within the gap window are one
// walked leg; its heading is the map bearing camera-to-camera when both sites
// have coordinates.
function buildLegs(
  sightings: Sighting[],
  cameraById: Map<string, Camera>,
): RawLeg[] {
  const legs: RawLeg[] = [];
  const timed = sightings.filter((sighting) => sighting.hasClockTime);

  for (let index = 1; index < timed.length; index += 1) {
    const from = timed[index - 1];
    const to = timed[index];
    const minutes = (to.time - from.time) / 60_000;

    if (from.cameraId === to.cameraId) continue;
    if (minutes <= 0 || minutes > MAX_LEG_GAP_MINUTES) continue;

    const fromCamera = cameraById.get(from.cameraId);
    const toCamera = cameraById.get(to.cameraId);

    if (!fromCamera || !toCamera) continue;

    const hasCoordinates =
      typeof fromCamera.latitude === "number" &&
      typeof fromCamera.longitude === "number" &&
      typeof toCamera.latitude === "number" &&
      typeof toCamera.longitude === "number";

    legs.push({
      from,
      to,
      fromName: fromCamera.name,
      toName: toCamera.name,
      heading: hasCoordinates
        ? degreesToCompass(
            bearingBetween(
              fromCamera.latitude as number,
              fromCamera.longitude as number,
              toCamera.latitude as number,
              toCamera.longitude as number,
            ),
          )
        : "",
      minutes: Math.round(minutes),
    });
  }

  return legs;
}

function getRoutePattern(legs: RawLeg[]): TravelPattern {
  if (legs.length === 0) {
    return {
      title: "No camera-to-camera moves yet",
      detail:
        "When he shows up on two cameras within six hours, the walked leg and its heading land here.",
    };
  }

  const routeCounts = countBy(legs.map((leg) => `${leg.fromName} → ${leg.toName}`));
  const top = topEntry(routeCounts);

  if (top.count >= 2) {
    const repeatLeg = legs.find(
      (leg) => `${leg.fromName} → ${leg.toName}` === top.key,
    );

    return {
      title: top.key,
      detail: `He has made this move ${top.count} times${
        repeatLeg?.heading ? `, heading ${repeatLeg.heading}` : ""
      } — a route worth hanging a stand on.`,
    };
  }

  return {
    title: `${legs.length} walked ${legs.length === 1 ? "leg" : "legs"} logged`,
    detail:
      "Each leg below is a camera-to-camera move from your photos. Repeats will surface his preferred route.",
  };
}

function formatLeg(leg: RawLeg): TravelLeg {
  const date = new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(leg.from.time);

  return {
    key: `${leg.from.photo.id}-${leg.to.photo.id}`,
    label: `${leg.fromName} → ${leg.toName}`,
    detail: `${date}, ${timeLabel(leg.from.time)} → ${timeLabel(leg.to.time)}${
      leg.heading ? `, headed ${leg.heading}` : ""
    } — ${gapLabel(leg.minutes)} camera to camera`,
  };
}

function timeLabel(time: number): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
}

function gapLabel(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;

  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;

  return rest > 0 ? `${hours} h ${rest} min` : `${hours} h`;
}

// Same daybreaks the deer-profile time pattern uses.
function timeBucket(hour: number): string {
  if (hour >= 5 && hour <= 10) return "Morning";
  if (hour >= 11 && hour <= 14) return "Midday";
  if (hour >= 15 && hour <= 20) return "Evening";

  return "Night";
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  values.forEach((value) => {
    if (!value) return;

    counts.set(value, (counts.get(value) ?? 0) + 1);
  });

  return counts;
}

function topEntry(counts: Map<string, number>): { key: string; count: number } {
  let key = "";
  let count = 0;

  counts.forEach((value, entryKey) => {
    if (value > count) {
      key = entryKey;
      count = value;
    }
  });

  return { key, count };
}

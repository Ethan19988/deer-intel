// On-map movement prediction, grounded in a property's own pins rather than a
// black-box heatmap. Deer bed in cover and feed in the open, so the honest
// prediction is the travel corridors between bedding and food/water, with the
// direction set by time of day (toward food at dusk, back to bedding at dawn),
// plus a movement "outlook" scored from real weather factors. Everything is
// explainable — each rating carries the factors that produced it.

import { clockToMinutes } from "@/lib/windViz";

export type LatLng = { lat: number; lng: number };

export type MovementPeriod = "dawn" | "midday" | "dusk" | "night";

export type ResourceKind = "food" | "water";

export type BeddingPoint = LatLng & { id: string; label: string };
export type ResourcePoint = LatLng & {
  id: string;
  label: string;
  kind: ResourceKind;
};

export type MovementCorridor = {
  id: string;
  bedding: LatLng;
  resource: LatLng;
  resourceKind: ResourceKind;
  distanceM: number;
  /** 0-1, higher for shorter (more probable) links. */
  strength: number;
};

const EARTH_RADIUS_M = 6371000;

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}

/** Great-circle distance in metres between two points. */
export function distanceMeters(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export type CorridorOptions = {
  /** Longest bedding→resource link to treat as a corridor. */
  maxDistanceM: number;
  /** How many nearest resources to link from each bedding area. */
  maxLinksPerBedding: number;
};

export const DEFAULT_CORRIDOR_OPTIONS: CorridorOptions = {
  maxDistanceM: 1200,
  maxLinksPerBedding: 2,
};

/**
 * Link each bedding area to its nearest few food/water sources within range.
 * Shorter links score higher — deer favor the path of least effort and the
 * tightest bed-to-feed connections see the most traffic.
 */
export function buildCorridors(
  bedding: BeddingPoint[],
  resources: ResourcePoint[],
  options: CorridorOptions = DEFAULT_CORRIDOR_OPTIONS,
): MovementCorridor[] {
  if (bedding.length === 0 || resources.length === 0) return [];

  const corridors: MovementCorridor[] = [];

  for (const bed of bedding) {
    const nearest = resources
      .map((resource) => ({
        resource,
        distanceM: distanceMeters(bed, resource),
      }))
      .filter((link) => link.distanceM <= options.maxDistanceM)
      .sort((left, right) => left.distanceM - right.distanceM)
      .slice(0, options.maxLinksPerBedding);

    for (const link of nearest) {
      corridors.push({
        id: `${bed.id}-${link.resource.id}`,
        bedding: { lat: bed.lat, lng: bed.lng },
        resource: { lat: link.resource.lat, lng: link.resource.lng },
        resourceKind: link.resource.kind,
        distanceM: link.distanceM,
        strength: Math.max(
          0.15,
          1 - link.distanceM / options.maxDistanceM,
        ),
      });
    }
  }

  return corridors;
}

/**
 * Which way deer are most likely moving along a corridor right now: toward food
 * as light fades (dusk), back toward bedding as it breaks (dawn). Midday/night
 * have no strong directional pull, so corridors read as two-way.
 */
export function corridorDirection(
  period: MovementPeriod,
): "to-resource" | "to-bedding" | "two-way" {
  if (period === "dusk") return "to-resource";
  if (period === "dawn") return "to-bedding";
  return "two-way";
}

const PERIOD_WINDOW_MIN = 75; // ~75 min on either side of sunrise/sunset

function minutesOfDay(date: Date): number {
  return date.getHours() * 60 + date.getMinutes();
}

/** Classify a clock time (minutes past local midnight) into a movement period. */
export function classifyPeriodByMinutes(
  minutes: number,
  sunriseMin: number,
  sunsetMin: number,
): MovementPeriod {
  if (Math.abs(minutes - sunriseMin) <= PERIOD_WINDOW_MIN) return "dawn";
  if (Math.abs(minutes - sunsetMin) <= PERIOD_WINDOW_MIN) return "dusk";
  if (minutes < sunriseMin || minutes > sunsetMin) return "night";
  return "midday";
}

/** Classify the current time relative to the day's sunrise/sunset. */
export function currentMovementPeriod(
  now: Date,
  sunrise: string,
  sunset: string,
): MovementPeriod {
  const sunriseMin = clockToMinutes(sunrise);
  const sunsetMin = clockToMinutes(sunset);

  if (sunriseMin === null || sunsetMin === null) return "midday";

  return classifyPeriodByMinutes(minutesOfDay(now), sunriseMin, sunsetMin);
}

// --- Property-specific movement history --------------------------------------
// The generic outlook is almanac logic that applies to deer everywhere. A
// property's own trail-camera timestamps are the one signal unique to its
// ground, so we fold them in: bin the deer photos that carry a real capture
// time into the same movement periods, and see whether the current period runs
// hotter or colder than the property's all-day average. Sparse history falls
// back to the generic model rather than trusting a handful of photos.

export type PropertyPhotoTiming = {
  photoDate: string;
  species: string;
  buckName?: string;
  deerProfileId?: string;
};

export type PropertyMovementSignal = {
  /** -2..+2 nudge applied to the outlook score. 0 when history is too thin. */
  bump: number;
  /** Deer photos that carried a usable capture time. */
  sampleSize: number;
  /** True once there's enough history to trust the property signal. */
  hasSignal: boolean;
  /** Current-period photos-per-hour ÷ the property's all-day average. */
  ratio: number | null;
  factor: string;
};

const MIN_SAMPLE_FOR_SIGNAL = 8;
const MIN_SAMPLE_FOR_FULL = 20;

export function propertyMovementSignal(
  photos: PropertyPhotoTiming[],
  period: MovementPeriod,
  sunriseISO: string,
  sunsetISO: string,
): PropertyMovementSignal {
  const sunriseMin = clockToMinutes(sunriseISO) ?? 6 * 60;
  const sunsetMin = clockToMinutes(sunsetISO) ?? 20 * 60;

  const counts: Record<MovementPeriod, number> = {
    dawn: 0,
    midday: 0,
    dusk: 0,
    night: 0,
  };
  let sampleSize = 0;

  for (const photo of photos) {
    if (!isDeerTiming(photo)) continue;
    const minutes = photoLocalMinutes(photo.photoDate);
    if (minutes === null) continue;
    sampleSize += 1;
    counts[classifyPeriodByMinutes(minutes, sunriseMin, sunsetMin)] += 1;
  }

  if (sampleSize < MIN_SAMPLE_FOR_SIGNAL) {
    return {
      bump: 0,
      sampleSize,
      hasSignal: false,
      ratio: null,
      factor:
        sampleSize === 0
          ? "No timestamped deer photos yet — using general patterns"
          : `Only ${sampleSize} timestamped deer photo${sampleSize === 1 ? "" : "s"} — using general patterns`,
    };
  }

  const hours = periodHours(sunriseMin, sunsetMin);
  const density = counts[period] / hours[period];
  const overallDensity = sampleSize / 24;
  const ratio = overallDensity > 0 ? density / overallDensity : 1;

  let bump = 0;
  if (ratio >= 1.6) bump = 2;
  else if (ratio >= 1.15) bump = 1;
  else if (ratio <= 0.4) bump = -2;
  else if (ratio <= 0.7) bump = -1;

  // Low-confidence sample: let it nudge, but not swing.
  if (sampleSize < MIN_SAMPLE_FOR_FULL) {
    bump = Math.max(-1, Math.min(1, bump));
  }

  const label = PERIOD_LABEL[period].toLowerCase();
  const factor =
    bump > 0
      ? `Your cameras run ${ratio.toFixed(1)}× your average at ${label} (${counts[period]}/${sampleSize} deer photos)`
      : bump < 0
        ? `Historically quiet at ${label} on your cameras (${counts[period]}/${sampleSize} photos)`
        : `${PERIOD_LABEL[period]} is about average on your cameras (${counts[period]}/${sampleSize} photos)`;

  return { bump, sampleSize, hasSignal: true, ratio, factor };
}

/** Hours each period covers, matching the sunrise/sunset window classifier. */
function periodHours(
  sunriseMin: number,
  sunsetMin: number,
): Record<MovementPeriod, number> {
  const daylight = Math.max(0, (sunsetMin - sunriseMin) / 60);
  const windowHours = (PERIOD_WINDOW_MIN * 2) / 60; // 2.5 h across sunrise/sunset
  return {
    dawn: windowHours,
    dusk: windowHours,
    midday: Math.max(1, daylight - windowHours),
    night: Math.max(1, 24 - daylight - windowHours),
  };
}

function isDeerTiming(photo: PropertyPhotoTiming): boolean {
  if (photo.buckName?.trim() || photo.deerProfileId) return true;
  const species = (photo.species ?? "").toLowerCase();
  return ["deer", "buck", "doe", "fawn"].some((term) =>
    species.includes(term),
  );
}

/** Minutes past local midnight for a photo, or null if it has no real time. */
function photoLocalMinutes(date: string): number | null {
  if (!date || /^\d{4}-\d{2}-\d{2}$/.test(date)) return null;
  const time = Date.parse(date);
  if (Number.isNaN(time)) return null;
  const parsed = new Date(time);
  return parsed.getHours() * 60 + parsed.getMinutes();
}

// --- Seasonal windows --------------------------------------------------------
// Deer behavior shifts hard through the fall: early-season food patterns look
// nothing like the rut. Pooling a whole year of photos averages those apart, so
// the history signal is bucketed by rut phase and, by default, only same-phase
// photos feed the outlook — a rut prediction learns from past ruts, not from
// October. Phases are keyed to month/day (ignoring year, so last season's rut
// counts toward this one) and slide later at southern latitudes (below). Bands
// are coarse — southern rut timing is genuinely variable — so approximate.

export type MovementPhase =
  | "early"
  | "pre-rut"
  | "rut"
  | "post-rut"
  | "late"
  | "off-season";

const PHASE_LABEL: Record<MovementPhase, string> = {
  early: "Early season",
  "pre-rut": "Pre-rut",
  rut: "Rut",
  "post-rut": "Post-rut",
  late: "Late season",
  "off-season": "Off-season",
};

export function movementPhaseLabel(phase: MovementPhase): string {
  return PHASE_LABEL[phase];
}

// Days since Sep 1 (= 0), running through Feb; null outside Sep–Feb. Lets a
// whole-calendar day shift cross month boundaries cleanly.
const SEASON_MONTH_START: Record<number, number> = {
  9: 0,
  10: 30,
  11: 61,
  12: 91,
  1: 122,
  2: 153,
};

function seasonIndex(month: number, day: number): number | null {
  const start = SEASON_MONTH_START[month];
  if (start === undefined) return null; // Mar–Aug
  return start + (day - 1);
}

// Latitude default when a property's location is unknown: assume far-northern,
// so the phase calendar is the photoperiod-locked baseline (shift 0).
export const DEFAULT_RUT_LATITUDE = 45;

/**
 * How many days later the rut runs at a given latitude. North of ~38°N it's
 * locked to mid-November; it slides later toward the Gulf. Coarse bands, not a
 * per-degree model — southern rut timing varies too much to pretend precision.
 */
export function rutShiftDays(latitude: number): number {
  if (latitude >= 38) return 0;
  if (latitude >= 34) return 7;
  if (latitude >= 30) return 18;
  return 25;
}

/** Human label for the latitude band driving the rut shift. */
export function rutRegionLabel(latitude: number): string {
  if (latitude >= 38) return "Northern";
  if (latitude >= 34) return "Mid-South";
  if (latitude >= 30) return "Deep South";
  return "Gulf South";
}

function phaseForSeasonDate(
  month: number,
  day: number,
  latitude: number,
): MovementPhase {
  const index = seasonIndex(month, day);
  if (index === null) return "off-season";

  // Shift the date back into the northern baseline calendar, then classify.
  const shifted = index - rutShiftDays(latitude);
  if (shifted < 0) return "off-season"; // before this region's early season
  if (shifted <= 43) return "early"; // Sep 1 – Oct 14 (baseline)
  if (shifted <= 64) return "pre-rut"; // Oct 15 – Nov 4
  if (shifted <= 84) return "rut"; // Nov 5 – Nov 24
  if (shifted <= 104) return "post-rut"; // Nov 25 – Dec 14
  if (shifted <= 152) return "late"; // Dec 15 – Jan 31
  return "off-season";
}

export function movementPhaseForDate(
  date: Date,
  latitude: number = DEFAULT_RUT_LATITUDE,
): MovementPhase {
  return phaseForSeasonDate(date.getMonth() + 1, date.getDate(), latitude);
}

/** Month/day off the leading YYYY-MM-DD, tz-safe for both date and datetime. */
function photoPhase(dateISO: string, latitude: number): MovementPhase | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateISO);
  if (!match) return null;
  return phaseForSeasonDate(Number(match[2]), Number(match[3]), latitude);
}

type SeasonalPhotoResult<T> = {
  photos: T[];
  scope: "phase" | "all-season";
  /** Usable (deer + timed) photos found inside the current phase. */
  inPhaseSamples: number;
};

type PhotoLike = {
  photoDate: string;
  species: string;
  buckName?: string;
  deerProfileId?: string;
};

/**
 * Narrow a photo set to the current rut phase when there's enough same-phase
 * history to stand on; otherwise fall back to the whole set so the signal
 * doesn't vanish. `scope` reports which happened, so callers can label it.
 */
export function resolveSeasonalPhotos<T extends PhotoLike>(
  photos: T[],
  phase: MovementPhase,
  latitude: number = DEFAULT_RUT_LATITUDE,
  minPhaseSamples = 8,
): SeasonalPhotoResult<T> {
  if (phase === "off-season") {
    return { photos, scope: "all-season", inPhaseSamples: 0 };
  }

  const inPhase = photos.filter(
    (photo) => photoPhase(photo.photoDate, latitude) === phase,
  );
  const usable = inPhase.filter(
    (photo) => isDeerTiming(photo) && photoLocalMinutes(photo.photoDate) !== null,
  ).length;

  if (usable >= minPhaseSamples) {
    return { photos: inPhase, scope: "phase", inPhaseSamples: usable };
  }

  return { photos, scope: "all-season", inPhaseSamples: usable };
}

export type MovementRating = "Low" | "Fair" | "Good" | "Prime";

export type MovementForecast = {
  period: MovementPeriod;
  rating: MovementRating;
  score: number;
  factors: string[];
  /** True when the property's own camera history shaped the score. */
  personalized: boolean;
  /** Deer photos (with usable times) behind the personalization. */
  sampleSize: number;
};

export type MovementForecastInput = {
  period: MovementPeriod;
  moonPhase?: string;
  pressureTrend?: "rising" | "steady" | "falling";
  temperature?: string;
  propertySignal?: PropertyMovementSignal;
};

const PERIOD_LABEL: Record<MovementPeriod, string> = {
  dawn: "Dawn",
  midday: "Midday",
  dusk: "Dusk",
  night: "Night",
};

export function movementPeriodLabel(period: MovementPeriod): string {
  return PERIOD_LABEL[period];
}

/**
 * A heuristic movement outlook. The prime windows are the two low-light edges of
 * the day; a falling barometer and a cold snap push deer onto their feet; a full
 * or new moon nudges the major feed periods. Each contribution is surfaced as a
 * factor so the number is never a mystery.
 */
export function movementForecast(input: MovementForecastInput): MovementForecast {
  const factors: string[] = [];
  let score = 0;

  if (input.period === "dawn" || input.period === "dusk") {
    score += 3;
    factors.push(`${PERIOD_LABEL[input.period]} — a prime low-light window`);
  } else if (input.period === "night") {
    score += 1;
    factors.push("After dark — movement mostly nocturnal");
  } else {
    score -= 1;
    factors.push("Midday lull — expect less movement");
  }

  if (input.pressureTrend === "falling") {
    score += 2;
    factors.push("Falling barometer ahead of a front");
  } else if (input.pressureTrend === "steady") {
    score += 1;
    factors.push("Steady pressure");
  } else if (input.pressureTrend === "rising") {
    factors.push("Rising pressure — settling weather");
  }

  const temp = parseTemperature(input.temperature);
  if (temp !== null) {
    if (temp <= 45) {
      score += 2;
      factors.push(`Cold at ${Math.round(temp)}° — deer feed hard`);
    } else if (temp <= 60) {
      score += 1;
      factors.push(`Cool at ${Math.round(temp)}°`);
    } else if (temp >= 75) {
      score -= 1;
      factors.push(`Warm at ${Math.round(temp)}° — midday movement drops`);
    }
  }

  if (input.moonPhase) {
    const phase = input.moonPhase.toLowerCase();
    if (phase.includes("full") || phase.includes("new")) {
      score += 1;
      factors.push(`${input.moonPhase} moon — stronger feed periods`);
    }
  }

  // The property's own camera history leads the factor list — it's the signal
  // unique to this ground — and its bump can push a generic rating up or down.
  const signal = input.propertySignal;
  if (signal) {
    score += signal.bump;
    if (signal.hasSignal) {
      factors.unshift(signal.factor);
    } else {
      factors.push(signal.factor);
    }
  }

  return {
    period: input.period,
    rating: ratingForScore(score),
    score,
    factors,
    personalized: signal?.hasSignal ?? false,
    sampleSize: signal?.sampleSize ?? 0,
  };
}

function ratingForScore(score: number): MovementRating {
  if (score >= 6) return "Prime";
  if (score >= 4) return "Good";
  if (score >= 2) return "Fair";
  return "Low";
}

function parseTemperature(value: string | undefined): number | null {
  if (!value) return null;
  const match = value.match(/-?\d+(?:\.\d+)?/);
  return match ? Number(match[0]) : null;
}

// --- Spatial corridor personalization ----------------------------------------
// The property outlook is one number for the whole property; this pushes the
// same camera-timing signal down to individual corridors. A corridor running
// past a camera that fires a lot at the current period reads "hot"; one past a
// quiet camera reads "cold"; one with no camera nearby stays neutral. Evidence
// is tied to cameras by proximity to the corridor line, not guesswork.

export type CameraPoint = LatLng & { id: string };

export type CameraPhotoTiming = {
  cameraSiteId: string;
  photoDate: string;
  species: string;
  buckName?: string;
  deerProfileId?: string;
};

export type CorridorLevel = "hot" | "warm" | "cold" | "none";

export type CorridorEvidence = {
  periodHits: number;
  totalHits: number;
  cameraCount: number;
  level: CorridorLevel;
};

const CORRIDOR_HOT_HITS = 5;

/** Local-tangent-plane XY (metres) of `point` relative to `origin`. */
function toLocalXY(origin: LatLng, point: LatLng): { x: number; y: number } {
  const lat0 = toRad(origin.lat);
  return {
    x: toRad(point.lng - origin.lng) * Math.cos(lat0) * EARTH_RADIUS_M,
    y: toRad(point.lat - origin.lat) * EARTH_RADIUS_M,
  };
}

/** Shortest distance (metres) from a point to the a→b segment. */
export function distanceToSegmentMeters(
  point: LatLng,
  a: LatLng,
  b: LatLng,
): number {
  const p = toLocalXY(a, point);
  const b2 = toLocalXY(a, b);
  const lenSq = b2.x * b2.x + b2.y * b2.y;
  const t =
    lenSq === 0 ? 0 : Math.max(0, Math.min(1, (p.x * b2.x + p.y * b2.y) / lenSq));
  return Math.hypot(p.x - t * b2.x, p.y - t * b2.y);
}

function corridorLevel(cameraCount: number, periodHits: number): CorridorLevel {
  if (cameraCount === 0) return "none";
  if (periodHits >= CORRIDOR_HOT_HITS) return "hot";
  if (periodHits >= 1) return "warm";
  return "cold";
}

/**
 * Evidence per corridor from trail cameras. Each camera is attributed to its
 * single nearest corridor (within `radiusM`), so a busy camera on one trail
 * can't light up every corridor around it — its deer photos, split into the
 * current period and overall, land on the one corridor it actually watches.
 */
export function corridorEvidence(
  corridors: MovementCorridor[],
  cameras: CameraPoint[],
  photos: CameraPhotoTiming[],
  period: MovementPeriod,
  sunriseISO: string,
  sunsetISO: string,
  radiusM = 300,
): Record<string, CorridorEvidence> {
  const sunriseMin = clockToMinutes(sunriseISO) ?? 6 * 60;
  const sunsetMin = clockToMinutes(sunsetISO) ?? 20 * 60;

  const hitsByCamera = new Map<
    string,
    { periodHits: number; totalHits: number }
  >();
  for (const photo of photos) {
    if (!isDeerTiming(photo)) continue;
    const minutes = photoLocalMinutes(photo.photoDate);
    if (minutes === null) continue;
    const record = hitsByCamera.get(photo.cameraSiteId) ?? {
      periodHits: 0,
      totalHits: 0,
    };
    record.totalHits += 1;
    if (classifyPeriodByMinutes(minutes, sunriseMin, sunsetMin) === period) {
      record.periodHits += 1;
    }
    hitsByCamera.set(photo.cameraSiteId, record);
  }

  const tally = new Map<
    string,
    { periodHits: number; totalHits: number; cameraCount: number }
  >(
    corridors.map((corridor) => [
      corridor.id,
      { periodHits: 0, totalHits: 0, cameraCount: 0 },
    ]),
  );

  // Attribute each camera to its nearest corridor only.
  for (const camera of cameras) {
    let nearestId: string | null = null;
    let nearestDistance = Infinity;

    for (const corridor of corridors) {
      const distance = distanceToSegmentMeters(
        camera,
        corridor.bedding,
        corridor.resource,
      );
      if (distance < nearestDistance) {
        nearestDistance = distance;
        nearestId = corridor.id;
      }
    }

    if (nearestId === null || nearestDistance > radiusM) continue;

    const aggregate = tally.get(nearestId);
    if (!aggregate) continue;
    aggregate.cameraCount += 1;
    const record = hitsByCamera.get(camera.id);
    if (record) {
      aggregate.periodHits += record.periodHits;
      aggregate.totalHits += record.totalHits;
    }
  }

  const evidence: Record<string, CorridorEvidence> = {};
  for (const corridor of corridors) {
    const aggregate = tally.get(corridor.id) ?? {
      periodHits: 0,
      totalHits: 0,
      cameraCount: 0,
    };
    evidence[corridor.id] = {
      ...aggregate,
      level: corridorLevel(aggregate.cameraCount, aggregate.periodHits),
    };
  }

  return evidence;
}

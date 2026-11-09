// "Best sits for this buck": over the next three forecast days, which AM/PM
// sit and which stand give the hunter the best bet at one tracked buck — and
// why. Pure: everything comes in as data (no store, no clock), so the buck card
// and the hit-list slideshow read the same call.
//
// How a pick is made:
//  1. His sightings. Only photos explicitly linked to his profile count, a
//     burst on one camera is one visit (collapseVisits), and photo times are
//     used only when trusted (trustedPhotoDate). Each visit is weighted by
//     recency (half-life RECENCY_HALF_LIFE_DAYS), so where he was last week
//     outweighs where he was in September.
//  2. Candidate stands: stands with a map location (findStandLocation) within
//     STAND_REACH_M (~600 yd) of a camera he's been on that has coordinates.
//     A stand's "activity" is the recency-weighted visits on those cameras,
//     discounted with distance.
//  3. Every upcoming sit (AM/PM over the first three forecast days, past sits
//     skipped) × every candidate stand is scored:
//       - forecast wind for that sit vs the stand's best/avoid winds
//         (getStandWindCheck) — a wrong wind EXCLUDES the stand;
//       - the stand's bestTime vs the sit — a morning-only stand on an
//         evening sit (or the reverse) is EXCLUDED;
//       - his usual time window (getDeerProfileTimeline) matching the sit;
//       - his activity near the stand, plus sits you tagged him on from it;
//       - geometry, when the cameras/stand have coordinates: whether the sit's
//         wind carries scent toward the camera he walks past (penalty) or away
//         from it (bonus), and whether his usual heading points at the stand;
//       - a wind he favors — only when deerConditionInsights calls it a real
//         preference ("Favors …"), not just the most common wind;
//       - stand pressure as of the sit's day (rested is better; a burned stand
//         is EXCLUDED, as pickRestedStand does);
//       - a falling barometer (front) that day.
//  4. The best stand per sit, then the top MAX_PICKS sits. Anything scoring
//     under half the top pick is dropped rather than padded in.
//
// It's a best bet, not a promise: every pick carries its reasons and cautions
// and a plain confidence level, and the "not enough to go on" states say what
// is missing instead of guessing.

import { angleDiff, downwindBearing, findStandLocation, SCENT_CONE_HALF_ANGLE, SCENT_REACH_M } from "@/lib/accessScent";
import { collapseVisits, getDeerConditionInsights, type DeerConditionInsights } from "@/lib/deerConditionInsights";
import {
  describeDeerTimeWindow,
  getDeerProfileTimeline,
  MIN_TIMED_FOR_PATTERN,
  type DeerTimeWindow,
} from "@/lib/deerProfileTimeline";
import { buildWindMatrix, standFitsSitPeriod, type SitPeriod, type WindMatrixColumn } from "@/lib/huntPlanner";
import type { ForecastDay } from "@/lib/liveWeather";
import { distanceMeters, type LatLng } from "@/lib/movementPrediction";
import { trustedPhotoDate } from "@/lib/photoDateTime";
import { dateInputTime, photoLinksProfile } from "@/lib/photos";
import { huntMatchesStand } from "@/lib/standHunts";
import { getStandPressure } from "@/lib/standPressure";
import { getStandWindCheck, type StandWindStatus } from "@/lib/standWind";
import { bearingBetween, compassToDegrees, toEightWind } from "@/lib/travelDirection";
import type { Camera } from "@/types/camera";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

export type BuckSitConfidence = "high" | "medium" | "low";

export type BuckSitPick = {
  /** `${sitKey}:${standId}` */
  key: string;
  /** "YYYY-MM-DD-AM" / "-PM", as the wind grid's column keys. */
  sitKey: string;
  /** "Tue PM", "Today AM" */
  sitLabel: string;
  standId: string;
  standName: string;
  /** His most-weighted camera within reach of the stand. */
  cameraName: string;
  yardsToCamera: number;
  /** Why this sit, strongest first. */
  reasons: string[];
  /** What works against it (off wind, pressure, scent toward his trail…). */
  cautions: string[];
  confidence: BuckSitConfidence;
  score: number;
};

export type BuckSitPlanGap = "few-sightings" | "no-stands" | "no-forecast" | "no-sits";

export type BuckSitPlan =
  | { status: "ready"; picks: BuckSitPick[] }
  | { status: BuckSitPlanGap; title: string; message: string };

export type BuckSitPlanInput = {
  profile: DeerProfile;
  photoRecords: PhotoRecord[];
  hunts: HuntLogEntry[];
  cameras: Camera[];
  stands: Stand[];
  pins: MapPin[];
  /** The live forecast's days (usePropertyToday().forecast?.days). */
  forecastDays: ForecastDay[];
  /** usePropertyToday's activeSitKey: sits before it are over and skipped. */
  nextSitKey?: string;
  /** "YYYY-MM-DD" for recency; defaults to the first forecast day. */
  today?: string;
  /** Precomputed condition insights for this buck (else computed here). */
  conditions?: DeerConditionInsights;
};

/** ~600 yd: how far from his cameras a stand still covers him. */
export const STAND_REACH_M = 549;
export const FORECAST_SIT_DAYS = 3;
export const MAX_PICKS = 3;
export const RECENCY_HALF_LIFE_DAYS = 14;
/** Weight of a visit with no usable date: it counts, barely. */
const UNDATED_WEIGHT = 0.1;
/** A stand at the edge of reach still gets this share of a camera's weight. */
const EDGE_NEARNESS = 0.3;
const MIN_DIRECTED_FOR_HEADING = 2;
/** Heading within this of the camera→stand bearing reads as "toward" it. */
const TOWARD_HALF_ANGLE = 45;
/** Camera→stand bearing within this of downwind reads as "stand downwind of him". */
const DOWNWIND_HALF_ANGLE = 60;
/** Too close to take a meaningful bearing between camera and stand. */
const MIN_BEARING_M = 25;
const DAY_MS = 86_400_000;
const METERS_TO_YARDS = 1.0936;

// Score weights. Wind and where he actually is carry the most; the rest nudge.
// "avoid" never scores: a wrong wind is excluded before scoring.
const WIND_SCORE: Record<StandWindStatus, number> = { good: 3, marginal: 1, unknown: 0.5, avoid: 0 };
const ACTIVITY_SCORE = 4;
const TIME_MATCH_BASE = 1;
const TIME_MATCH_SHARE = 2;
const RECENT_NEAR_BONUS = 1;
const RECENT_NEAR_DAYS = 7;
const TAGGED_SIT_BONUS = 1;
const MAX_TAGGED_SIT_BONUS = 2;
const TOWARD_BONUS = 1;
const DOWNWIND_BONUS = 1;
const SCENT_PENALTY = 2;
const FAVORED_WIND_BONUS = 1;
const FRESH_BONUS = 1;
const PRESSURED_PENALTY = 1.5;
const FRONT_BONUS = 1;
/** Drop picks scoring under this share of the top pick. */
const MIN_SHARE_OF_TOP = 0.5;
const STRONG_SAMPLE = 5;
const STRONG_ACTIVITY_SHARE = 0.4;
const STRONG_RECENT_DAYS = 14;

type CameraActivity = {
  camera: Camera;
  point: LatLng | null;
  visits: number;
  weight: number;
  /** Epoch ms of his newest dated visit there; NaN when none dated. */
  latest: number;
};

type CandidateStand = {
  stand: Stand;
  point: LatLng;
  /** His most-weighted camera in reach. */
  best: CameraActivity;
  bestMeters: number;
  /** Weighted activity in reach ÷ his total weight (0–1). */
  share: number;
  taggedSits: HuntLogEntry[];
};

/**
 * The best sits for one buck over the forecast, or why there isn't enough to
 * go on. See the header for how picks are scored.
 */
export function buildBuckSitPlan(input: BuckSitPlanInput): BuckSitPlan {
  const { profile, cameras, stands, pins, hunts } = input;
  const today = input.today || input.forecastDays[0]?.date || "";
  const nowRef = today ? dateInputTime(today) + DAY_MS : Number.NaN;
  const name = profile.nickname.trim() || "this buck";

  // Trusted times only: an untrusted capture time becomes date-only, so it
  // can't count toward his time window.
  const hisPhotos = input.photoRecords
    .filter((photo) => photoLinksProfile(photo, profile.id))
    .map((photo) => ({ ...photo, photoDate: trustedPhotoDate(photo) }));
  const timeline = getDeerProfileTimeline({ profile, photoRecords: hisPhotos, hunts, cameras });
  const timeWindow = timeline.timeWindow;
  const timedCount = timeWindow?.sampleSize ?? 0;

  if (timedCount < MIN_TIMED_FOR_PATTERN) {
    return {
      status: "few-sightings",
      title: "Not enough to go on",
      message: `${timedCount === 0 ? "No" : `Only ${timedCount}`} timed ${
        timedCount === 1 ? "sighting" : "sightings"
      } of ${name} so far — it takes ${MIN_TIMED_FOR_PATTERN} to tell mornings from evenings. Tag him on more trail-cam photos with real capture times.`,
    };
  }

  const activity = cameraActivity(hisPhotos, cameras, nowRef);
  const totalWeight = activity.reduce((sum, entry) => sum + entry.weight, 0);
  const located = activity.filter((entry) => entry.point !== null);

  if (located.length === 0) {
    return {
      status: "no-stands",
      title: "Not enough to go on",
      message: `None of the cameras ${name} is on have map coordinates, so there's no telling which stands cover him. Add a location to those cameras.`,
    };
  }

  const candidates = candidateStands({ stands, pins, hunts, located, totalWeight, profileId: profile.id });

  if (candidates.length === 0) {
    return {
      status: "no-stands",
      title: "No stands near him",
      message: `No stand with a map location is within ~600 yd of the cameras ${name} is on. Place your stands on the map (or hang one closer).`,
    };
  }

  const columns = buildWindMatrix(input.forecastDays.slice(0, FORECAST_SIT_DAYS), [], input.nextSitKey)
    .columns.filter((column) => !column.isPast);

  if (columns.length === 0) {
    return {
      status: "no-forecast",
      title: "No forecast yet",
      message: "Picks need the forecast wind for each sit. Set the property's location, or check back once there's signal.",
    };
  }

  const heading = usualHeading(hisPhotos);
  const conditions = input.conditions ?? getDeerConditionInsights({ profile, photoRecords: input.photoRecords });
  const favoredWind = favoredWindOf(conditions);

  const perSit = columns
    .map((column) => {
      const scored = candidates
        .map((candidate) =>
          scorePick({ column, candidate, timeWindow, heading, favoredWind, hunts, nowRef }),
        )
        .filter((pick): pick is BuckSitPick => pick !== null)
        .sort((left, right) => right.score - left.score);
      return scored[0] ?? null;
    })
    .filter((pick): pick is BuckSitPick => pick !== null);

  if (perSit.length === 0) {
    return {
      status: "no-sits",
      title: "No good sit in the forecast",
      message: `Every upcoming sit has the wrong wind, the wrong time of day, or a stand that needs rest for the stands near ${name}. Check back when the wind turns.`,
    };
  }

  // Best first; ties go to the sooner sit (columns are in time order).
  const order = new Map(columns.map((column, index) => [column.key, index]));
  const ranked = perSit.sort(
    (left, right) =>
      right.score - left.score ||
      (order.get(left.sitKey) ?? 0) - (order.get(right.sitKey) ?? 0),
  );
  const top = ranked[0].score;
  const picks = ranked
    .filter((pick, index) => index === 0 || pick.score >= top * MIN_SHARE_OF_TOP)
    .slice(0, MAX_PICKS);

  return { status: "ready", picks };
}

/** "Best: Tue PM · Oak Flat", or null when there's no pick. */
export function buckSitPlanLine(plan: BuckSitPlan): string | null {
  if (plan.status !== "ready" || plan.picks.length === 0) return null;
  const [best] = plan.picks;
  return `Best: ${best.sitLabel} · ${best.standName}`;
}

function cameraActivity(
  photos: PhotoRecord[],
  cameras: Camera[],
  nowRef: number,
): CameraActivity[] {
  const byId = new Map<string, CameraActivity>();
  const cameraById = new Map(cameras.map((camera) => [camera.id, camera]));

  for (const visit of collapseVisits(photos)) {
    const camera = cameraById.get(visit.cameraSiteId);
    if (!camera) continue;

    const entry = byId.get(camera.id) ?? {
      camera,
      point: cameraPoint(camera),
      visits: 0,
      weight: 0,
      latest: Number.NaN,
    };
    const time = dateInputTime(visit.photoDate);

    entry.visits += 1;
    entry.weight += recencyWeight(time, nowRef);
    if (!Number.isNaN(time) && !(time <= entry.latest)) entry.latest = time;
    byId.set(camera.id, entry);
  }

  return [...byId.values()];
}

function recencyWeight(time: number, nowRef: number): number {
  if (Number.isNaN(time)) return UNDATED_WEIGHT;
  if (Number.isNaN(nowRef)) return 1;
  const ageDays = Math.max(0, (nowRef - time) / DAY_MS);
  return 0.5 ** (ageDays / RECENCY_HALF_LIFE_DAYS);
}

function cameraPoint(camera: Camera): LatLng | null {
  return typeof camera.latitude === "number" &&
    typeof camera.longitude === "number" &&
    Number.isFinite(camera.latitude) &&
    Number.isFinite(camera.longitude)
    ? { lat: camera.latitude, lng: camera.longitude }
    : null;
}

function candidateStands({
  stands,
  pins,
  hunts,
  located,
  totalWeight,
  profileId,
}: {
  stands: Stand[];
  pins: MapPin[];
  hunts: HuntLogEntry[];
  located: CameraActivity[];
  totalWeight: number;
  profileId: string;
}): CandidateStand[] {
  const candidates: CandidateStand[] = [];

  for (const stand of stands) {
    const pin = findStandLocation(stand, pins);
    if (!pin) continue;
    const point = { lat: pin.lat, lng: pin.lng };

    let reachWeight = 0;
    let best: CameraActivity | null = null;
    let bestMeters = 0;

    for (const entry of located) {
      const meters = distanceMeters(point, entry.point as LatLng);
      if (meters > STAND_REACH_M) continue;

      reachWeight += entry.weight * (1 - (1 - EDGE_NEARNESS) * (meters / STAND_REACH_M));

      if (!best || entry.weight > best.weight || (entry.weight === best.weight && meters < bestMeters)) {
        best = entry;
        bestMeters = meters;
      }
    }

    if (!best) continue;

    candidates.push({
      stand,
      point,
      best,
      bestMeters,
      share: totalWeight > 0 ? Math.min(1, reachWeight / totalWeight) : 0,
      taggedSits: hunts.filter(
        (hunt) => hunt.deerProfileIds?.includes(profileId) && huntMatchesStand(stand, hunt),
      ),
    });
  }

  return candidates;
}

/** His usual 8-wind travel heading, when most directed sightings agree. */
function usualHeading(photos: PhotoRecord[]): string | null {
  const directions = photos
    .map((photo) => toEightWind(photo.travelDirection ?? ""))
    .filter(Boolean);

  if (directions.length < MIN_DIRECTED_FOR_HEADING) return null;

  const counts = new Map<string, number>();
  for (const direction of directions) counts.set(direction, (counts.get(direction) ?? 0) + 1);
  const [key, count] = [...counts.entries()].reduce((top, entry) => (entry[1] > top[1] ? entry : top));

  return count / directions.length >= 0.5 ? key : null;
}

/** "SW" when the condition insights call his wind a real preference. */
function favoredWindOf(conditions: DeerConditionInsights): { wind: string; note: string } | null {
  const insight = conditions.insights.find((item) => item.kind === "wind");
  if (!insight || !insight.value.startsWith("Favors")) return null;
  const wind = insight.bucket.split(" ")[0];
  return wind
    ? { wind, note: `${insight.percent}% of his visits vs ${insight.baselinePercent}% for all deer` }
    : null;
}

function timePeriod(timeWindow: DeerTimeWindow | null): SitPeriod | null {
  // No clear time of day: don't favor mornings or evenings.
  if (timeWindow?.clear === false) return null;
  if (timeWindow?.label === "Morning") return "AM";
  if (timeWindow?.label === "Evening") return "PM";
  return null;
}

function scorePick({
  column,
  candidate,
  timeWindow,
  heading,
  favoredWind,
  hunts,
  nowRef,
}: {
  column: WindMatrixColumn;
  candidate: CandidateStand;
  timeWindow: DeerTimeWindow | null;
  heading: string | null;
  favoredWind: { wind: string; note: string } | null;
  hunts: HuntLogEntry[];
  nowRef: number;
}): BuckSitPick | null {
  const { stand, best } = candidate;

  // Hard exclusions: wrong time of day for the stand, wrong wind, burned.
  if (!standFitsSitPeriod(stand, column.period)) return null;

  const wind = getStandWindCheck(stand, column.windCompass ?? undefined, column.windText);
  if (wind.status === "avoid") return null;

  const sitDate = column.key.slice(0, 10);
  const pressure = getStandPressure(stand, hunts, sitDate);
  if (pressure.level === "burned") return null;

  const reasons: string[] = [];
  const cautions: string[] = [];
  let score = 0;

  // Wind at the stand.
  score += WIND_SCORE[wind.status];
  if (wind.status === "good") {
    reasons.push(`${column.windCompass} wind fits this stand`);
  } else if (wind.calm) {
    cautions.push("Light & variable wind — scent may swirl");
  } else if (wind.status === "marginal") {
    cautions.push(`${column.windCompass} wind isn't one of this stand's best winds`);
  } else {
    cautions.push(
      column.windCompass ? "No wind notes on this stand — check the wind" : "No forecast wind for this sit",
    );
  }

  // His time window vs this sit.
  const hisPeriod = timePeriod(timeWindow);
  const timeMatch = hisPeriod === column.period;
  if (timeWindow && timeMatch) {
    score += TIME_MATCH_BASE + TIME_MATCH_SHARE * (timeWindow.count / Math.max(timeWindow.sampleSize, 1));
    const text = describeDeerTimeWindow(timeWindow);
    if (text) reasons.push(`${text.title} · ${timeWindow.count} of ${timeWindow.sampleSize} timed`);
  } else if (timeWindow && hisPeriod) {
    cautions.push(`He's mostly seen ${timeWindow.label.toLowerCase()}s (${timeWindow.hours})`);
  } else if (timeWindow) {
    cautions.push(`Mostly seen ${timeWindow.label.toLowerCase() === "night" ? "at night" : "midday"} — daylight sits are a long shot`);
  }

  // Where he's been: activity near the stand, recency, tagged sits.
  score += ACTIVITY_SCORE * candidate.share;
  const yardsToCamera = yards(candidate.bestMeters);
  const lastDate = Number.isNaN(best.latest) ? "" : shortDate(best.latest);
  reasons.push(
    `${yardsToCamera} yd from ${best.camera.name} — ${best.visits} ${best.visits === 1 ? "visit" : "visits"}${
      lastDate ? `, last ${lastDate}` : ""
    }`,
  );
  const daysSinceNear = Number.isNaN(best.latest) || Number.isNaN(nowRef)
    ? Number.POSITIVE_INFINITY
    : (nowRef - best.latest) / DAY_MS;
  if (daysSinceNear <= RECENT_NEAR_DAYS) score += RECENT_NEAR_BONUS;

  if (candidate.taggedSits.length > 0) {
    score += Math.min(candidate.taggedSits.length * TAGGED_SIT_BONUS, MAX_TAGGED_SIT_BONUS);
    reasons.push(
      `You saw him from here ${candidate.taggedSits.length} ${candidate.taggedSits.length === 1 ? "time" : "times"}`,
    );
  }

  // Geometry between his camera and the stand, when there's a bearing to take.
  let scentTowardHim = false;
  if (best.point && candidate.bestMeters >= MIN_BEARING_M) {
    const cameraToStand = bearingBetween(best.point.lat, best.point.lng, candidate.point.lat, candidate.point.lng);
    const standToCamera = (cameraToStand + 180) % 360;
    const downwind = wind.calm ? null : downwindBearing(column.windCompass ?? undefined);

    if (downwind !== null) {
      if (candidate.bestMeters <= SCENT_REACH_M && angleDiff(standToCamera, downwind) <= SCENT_CONE_HALF_ANGLE) {
        scentTowardHim = true;
        score -= SCENT_PENALTY;
        cautions.push(`${column.windCompass} wind carries your scent toward ${best.camera.name}, where he travels`);
      } else if (angleDiff(cameraToStand, downwind) <= DOWNWIND_HALF_ANGLE) {
        score += DOWNWIND_BONUS;
        reasons.push(`Stand is downwind of where he walks at ${best.camera.name}`);
      }
    }

    const headingDegrees = heading ? compassToDegrees(heading) : null;
    if (headingDegrees !== null && angleDiff(headingDegrees, cameraToStand) <= TOWARD_HALF_ANGLE) {
      score += TOWARD_BONUS;
      reasons.push(`He usually heads ${heading} — toward this stand`);
    }
  }

  // A wind he really favors.
  if (favoredWind && column.windCompass && toEightWind(column.windCompass) === favoredWind.wind) {
    score += FAVORED_WIND_BONUS;
    reasons.push(`He favors ${favoredWind.wind} winds (${favoredWind.note})`);
  }

  // Pressure as of the sit's day.
  if (pressure.level === "fresh") {
    score += FRESH_BONUS;
    reasons.push(pressure.label);
  } else {
    score -= PRESSURED_PENALTY;
    cautions.push(`${pressure.label} — pressured`);
  }

  if (column.isFront) {
    score += FRONT_BONUS;
    reasons.push("Front moving through — deer often move ahead of it");
  }

  const strong = [
    wind.status === "good",
    timeMatch,
    candidate.share >= STRONG_ACTIVITY_SHARE,
    daysSinceNear <= STRONG_RECENT_DAYS,
    (timeWindow?.sampleSize ?? 0) >= STRONG_SAMPLE,
  ].filter(Boolean).length;
  const confidence: BuckSitConfidence =
    strong === 5 && !scentTowardHim && pressure.level === "fresh"
      ? "high"
      : strong >= 3
        ? "medium"
        : "low";

  return {
    key: `${column.key}:${stand.id}`,
    sitKey: column.key,
    sitLabel: `${column.dayLabel} ${column.period}`,
    standId: stand.id,
    standName: stand.name.trim() || "Unnamed stand",
    cameraName: best.camera.name,
    yardsToCamera,
    reasons,
    cautions,
    confidence,
    score: Math.round(score * 100) / 100,
  };
}

function yards(meters: number): number {
  return Math.max(5, Math.round((meters * METERS_TO_YARDS) / 5) * 5);
}

function shortDate(time: number): string {
  return new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

// Stand success rates — how each stand (and the whole property) has actually
// produced, from the hunter's own logged sits: sits, hours on stand, deer and
// bucks per sit, shot opportunities and harvests, broken down by wind (8-point),
// time of day (morning / evening / all-day, read against PA legal light) and rut
// phase. Every number carries its sample size, and nothing is called "best"
// until enough sits stand behind it — three lucky sits are not a pattern.
//
// Pure data-in, data-out. Sunrise/sunset and the rut phase come in through a
// StatsContext so tests stay deterministic and the UI can feed the hunter's own
// season calendar.

import { compassToDegrees, parseCompassPoint } from "@/lib/compass";
import { PA_LEGAL_LIGHT_MINUTES } from "@/lib/liveWeather";
import { DEFAULT_RUT_LATITUDE } from "@/lib/movementPrediction";
import {
  DEFAULT_SEASON_CALENDAR,
  getSeasonContext,
  rutPhaseLabel,
  type RutPhase,
  type SeasonCalendarPrefs,
} from "@/lib/seasonCalendar";
import { isCalmWind } from "@/lib/standWind";
import { clockToMinutes } from "@/lib/windViz";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

// --- sample-size honesty -----------------------------------------------------

/** Fewer sits than this on a stand and its rates are noise. */
export const MIN_SITS_TO_CALL = 5;
/** A wind / time / phase bucket needs this many sits before it can be "best". */
export const MIN_BUCKET_SITS = 3;
/** At this many sits the read is solid rather than early. */
export const SOLID_SAMPLE_SITS = 12;

export function sampleLabel(sits: number): string {
  const noun = sits === 1 ? "sit" : "sits";
  if (sits === 0) return "No sits logged";
  if (sits < MIN_SITS_TO_CALL) return `${sits} ${noun} — too few to call`;
  if (sits < SOLID_SAMPLE_SITS) return `${sits} ${noun} — early read`;
  return `${sits} ${noun} — solid sample`;
}

// --- wind -----------------------------------------------------------------------

export const COMPASS_8 = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"] as const;
export type Wind8 = (typeof COMPASS_8)[number];
/** Wind bucket: an 8-point direction, or "Calm" when too light to carry scent. */
export type WindBucket = Wind8 | "Calm";
export const WIND_BUCKETS: readonly WindBucket[] = [...COMPASS_8, "Calm"];

/** Any compass point (16-wind) or bare degrees → the nearest 8-point wind. */
export function toWind8(raw: string | undefined | null): Wind8 | null {
  const text = (raw ?? "").trim();
  if (!text) return null;

  let degrees: number | null = null;
  if (/^-?\d+(\.\d+)?\s*°?$/.test(text)) {
    degrees = Number(text.replace(/[^\d.-]/g, ""));
  } else {
    const point = parseCompassPoint(text);
    degrees = point ? compassToDegrees(point) : null;
  }
  if (degrees === null || !Number.isFinite(degrees)) return null;

  const normalized = ((degrees % 360) + 360) % 360;
  return COMPASS_8[Math.round(normalized / 45) % 8];
}

/** The 16-wind point a sit was logged on (hunt field first, then snapshot). */
export function huntWindPoint(hunt: HuntLogEntry): string | null {
  return (
    parseCompassPoint(hunt.windDirection || "") ??
    parseCompassPoint(hunt.weatherSnapshot?.windDirection || "")
  );
}

export function huntWindBucket(hunt: HuntLogEntry): WindBucket | null {
  const speed = hunt.windSpeed || hunt.weatherSnapshot?.windSpeed || "";
  if (isCalmWind(speed)) return "Calm";
  return (
    toWind8(hunt.windDirection) ?? toWind8(hunt.weatherSnapshot?.windDirection)
  );
}

// --- sun / legal light -------------------------------------------------------------

export type SunTimes = {
  /** Local minutes past midnight. */
  sunrise: number;
  sunset: number;
};

// Fallback point when a property has no coordinate: central Pennsylvania.
export const DEFAULT_SUN_POINT = { lat: 40.9, lng: -77.8 };

function parseDateKey(dateKey: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})/.exec(dateKey);
  if (!match) return null;
  return { y: Number(match[1]), m: Number(match[2]), d: Number(match[3]) };
}

/**
 * NOAA's simplified solar equations: sunrise and sunset for a date at a point,
 * in local minutes. `tzOffsetMinutes` follows Date#getTimezoneOffset (UTC −
 * local, so +300 for EST); it defaults to the device's offset on that date.
 * Accurate to a few minutes — plenty to tell a morning sit from an evening one.
 */
export function sunTimesFor(
  dateKey: string,
  lat: number,
  lng: number,
  tzOffsetMinutes?: number,
): SunTimes | null {
  const parts = parseDateKey(dateKey);
  if (!parts) return null;

  const dayStart = Date.UTC(parts.y, 0, 1);
  const dayOfYear =
    Math.floor((Date.UTC(parts.y, parts.m - 1, parts.d) - dayStart) / 86_400_000) + 1;
  const gamma = ((2 * Math.PI) / 365) * (dayOfYear - 1);
  const eqTime =
    229.18 *
    (0.000075 +
      0.001868 * Math.cos(gamma) -
      0.032077 * Math.sin(gamma) -
      0.014615 * Math.cos(2 * gamma) -
      0.040849 * Math.sin(2 * gamma));
  const decl =
    0.006918 -
    0.399912 * Math.cos(gamma) +
    0.070257 * Math.sin(gamma) -
    0.006758 * Math.cos(2 * gamma) +
    0.000907 * Math.sin(2 * gamma) -
    0.002697 * Math.cos(3 * gamma) +
    0.00148 * Math.sin(3 * gamma);
  const latRad = (lat * Math.PI) / 180;
  const cosHa =
    Math.cos((90.833 * Math.PI) / 180) / (Math.cos(latRad) * Math.cos(decl)) -
    Math.tan(latRad) * Math.tan(decl);
  if (cosHa < -1 || cosHa > 1) return null; // polar day / night
  const haDeg = (Math.acos(cosHa) * 180) / Math.PI;

  const offset =
    tzOffsetMinutes ??
    new Date(parts.y, parts.m - 1, parts.d, 12).getTimezoneOffset();
  const sunriseUtc = 720 - 4 * (lng + haDeg) - eqTime;
  const sunsetUtc = 720 - 4 * (lng - haDeg) - eqTime;

  return {
    sunrise: Math.round(sunriseUtc - offset),
    sunset: Math.round(sunsetUtc - offset),
  };
}

export function legalLight(sun: SunTimes): { start: number; end: number } {
  return {
    start: sun.sunrise - PA_LEGAL_LIGHT_MINUTES.beforeSunrise,
    end: sun.sunset + PA_LEGAL_LIGHT_MINUTES.afterSunset,
  };
}

// --- time of day -------------------------------------------------------------------

export type SitTime = "morning" | "evening" | "all-day";
export const SIT_TIMES: readonly SitTime[] = ["morning", "evening", "all-day"];
export const SIT_TIME_LABEL: Record<SitTime, string> = {
  morning: "Morning",
  evening: "Evening",
  "all-day": "All-day",
};

// A morning sit may run this far past solar noon and still be a morning sit;
// an evening sit may start this far before it.
const MORNING_SPILL_MIN = 90;
const EVENING_LEAD_MIN = 60;

/**
 * Classify a sit by when it ran relative to the day's light. Morning = starts
 * before solar noon and is down by early afternoon; evening = starts around
 * midday or later; anything spanning both is all-day. An unknown end time is
 * read as a typical sit (morning → out by noon, evening → legal light).
 */
export function classifySit(
  startMin: number | null,
  endMin: number | null,
  sun: SunTimes,
): SitTime | null {
  if (startMin === null) return null;
  const noon = (sun.sunrise + sun.sunset) / 2;
  const { end: legalEnd } = legalLight(sun);

  let end = endMin;
  if (end === null) end = startMin < noon ? Math.min(startMin + 180, noon) : legalEnd;
  if (end <= startMin) end = legalEnd; // ran past midnight / typo: assume till dark

  if (startMin < noon && end <= noon + MORNING_SPILL_MIN) return "morning";
  if (startMin >= noon - EVENING_LEAD_MIN) return "evening";
  return "all-day";
}

/** Hours of a sit that fell inside legal light, or null without both times. */
export function legalHours(
  startMin: number | null,
  endMin: number | null,
  sun: SunTimes | null,
): number | null {
  if (startMin === null || endMin === null) return null;
  let end = endMin;
  if (end <= startMin) end += 24 * 60;
  let start = startMin;
  if (sun) {
    const legal = legalLight(sun);
    start = Math.max(start, legal.start);
    end = Math.min(end, legal.end);
  }
  return Math.max(0, end - start) / 60;
}

/** Photo / sighting time of day: morning or evening light, or night. */
export type LightPeriod = "morning" | "evening" | "night";

export function lightPeriod(minutes: number, sun: SunTimes): LightPeriod {
  const { start, end } = legalLight(sun);
  if (minutes < start || minutes > end) return "night";
  return minutes < (sun.sunrise + sun.sunset) / 2 ? "morning" : "evening";
}

// --- rut phase ----------------------------------------------------------------------

export const RUT_PHASE_ORDER: readonly RutPhase[] = [
  "early",
  "pre-rut",
  "seeking",
  "chasing",
  "peak",
  "lockdown",
  "post-rut",
  "late",
  "off-season",
];

// --- context ------------------------------------------------------------------------

export type StatsContext = {
  sunFor: (dateKey: string) => SunTimes | null;
  phaseFor: (dateKey: string) => RutPhase | null;
};

/**
 * Context from a property point and the hunter's season calendar. Rut phase
 * comes from the same getSeasonContext the Today screen uses, evaluated on
 * each sit's date. Sun times are cached per date.
 */
export function createStatsContext(options: {
  lat?: number;
  lng?: number;
  seasonPrefs?: SeasonCalendarPrefs;
}): StatsContext {
  const lat = options.lat ?? DEFAULT_SUN_POINT.lat;
  const lng = options.lng ?? DEFAULT_SUN_POINT.lng;
  const prefs = options.seasonPrefs ?? DEFAULT_SEASON_CALENDAR;
  const sunCache = new Map<string, SunTimes | null>();
  const phaseCache = new Map<string, RutPhase | null>();

  return {
    sunFor(dateKey) {
      const key = dateKey.slice(0, 10);
      if (!sunCache.has(key)) sunCache.set(key, sunTimesFor(key, lat, lng));
      return sunCache.get(key) ?? null;
    },
    phaseFor(dateKey) {
      const key = dateKey.slice(0, 10);
      if (!phaseCache.has(key)) {
        const parts = parseDateKey(key);
        phaseCache.set(
          key,
          parts
            ? getSeasonContext(
                new Date(parts.y, parts.m - 1, parts.d, 12),
                prefs,
                options.lat ?? DEFAULT_RUT_LATITUDE,
              ).phase
            : null,
        );
      }
      return phaseCache.get(key) ?? null;
    },
  };
}

// --- per-sit records ------------------------------------------------------------------

export type SitRecord = {
  hunt: HuntLogEntry;
  wind: WindBucket | null;
  time: SitTime | null;
  phase: RutPhase | null;
  hours: number | null;
  deer: number;
  bucks: number;
};

export function toSitRecord(hunt: HuntLogEntry, ctx: StatsContext): SitRecord {
  const sun = hunt.date ? ctx.sunFor(hunt.date) : null;
  const start = clockToMinutes(hunt.startTime || "");
  const end = clockToMinutes(hunt.endTime || "");
  const bucks = Math.max(0, hunt.bucks || 0);

  return {
    hunt,
    wind: huntWindBucket(hunt),
    time: sun ? classifySit(start, end, sun) : null,
    phase: hunt.date ? ctx.phaseFor(hunt.date) : null,
    hours: legalHours(start, end, sun),
    deer: bucks + Math.max(0, hunt.does || 0) + Math.max(0, hunt.fawns || 0),
    bucks,
  };
}

// --- aggregates -------------------------------------------------------------------------

export type SitAggregate = {
  sits: number;
  /** Legal-light hours, summed over sits that logged both start and end. */
  hours: number;
  /** Sits that contributed hours. */
  timedSits: number;
  deer: number;
  bucks: number;
  shots: number;
  harvests: number;
  deerPerSit: number;
  bucksPerSit: number;
  /** Bucks weigh double: the one number buckets are ranked on. */
  activityPerSit: number;
  enough: boolean;
  sampleLabel: string;
};

export function aggregateSits(records: SitRecord[]): SitAggregate {
  let hours = 0;
  let timedSits = 0;
  let deer = 0;
  let bucks = 0;
  let shots = 0;
  let harvests = 0;

  for (const record of records) {
    if (record.hours !== null) {
      hours += record.hours;
      timedSits += 1;
    }
    deer += record.deer;
    bucks += record.bucks;
    if (record.hunt.shotOpportunity) shots += 1;
    if (record.hunt.harvest) harvests += 1;
  }

  const sits = records.length;
  const per = (value: number) => (sits ? value / sits : 0);

  return {
    sits,
    hours,
    timedSits,
    deer,
    bucks,
    shots,
    harvests,
    deerPerSit: per(deer),
    bucksPerSit: per(bucks),
    activityPerSit: per(deer + bucks),
    enough: sits >= MIN_SITS_TO_CALL,
    sampleLabel: sampleLabel(sits),
  };
}

export type Bucket<K extends string> = {
  key: K;
  label: string;
  agg: SitAggregate;
};

function bucketBy<K extends string>(
  records: SitRecord[],
  keyOf: (record: SitRecord) => K | null,
  order: readonly K[],
  labelOf: (key: K) => string,
): Bucket<K>[] {
  const groups = new Map<K, SitRecord[]>();
  for (const record of records) {
    const key = keyOf(record);
    if (key === null) continue;
    const list = groups.get(key) ?? [];
    list.push(record);
    groups.set(key, list);
  }
  return order
    .filter((key) => groups.has(key))
    .map((key) => ({ key, label: labelOf(key), agg: aggregateSits(groups.get(key)!) }));
}

export type BestPick = {
  key: string;
  label: string;
  agg: SitAggregate;
  /** How many times the overall rate this bucket runs. */
  lift: number;
  detail: string;
};

/**
 * The best bucket, only when the overall sample is enough, at least two
 * buckets have MIN_BUCKET_SITS sits (otherwise there's nothing to compare), and
 * the winner actually saw deer.
 */
export function pickBest<K extends string>(
  buckets: Bucket<K>[],
  overall: SitAggregate,
): BestPick | null {
  if (!overall.enough) return null;
  const qualified = buckets.filter((bucket) => bucket.agg.sits >= MIN_BUCKET_SITS);
  if (qualified.length < 2) return null;

  const best = [...qualified].sort(
    (a, b) => b.agg.activityPerSit - a.agg.activityPerSit || b.agg.sits - a.agg.sits,
  )[0];
  if (best.agg.activityPerSit <= 0) return null;

  const lift = overall.activityPerSit > 0 ? best.agg.activityPerSit / overall.activityPerSit : 1;
  return {
    key: best.key,
    label: best.label,
    agg: best.agg,
    lift,
    detail: `${formatRate(best.agg.deerPerSit)} deer/sit${
      best.agg.bucks ? `, ${formatRate(best.agg.bucksPerSit)} bucks/sit` : ""
    } over ${best.agg.sits} sits`,
  };
}

export type StandStats = {
  standId: string;
  standName: string;
  overall: SitAggregate;
  byWind: Bucket<WindBucket>[];
  byTime: Bucket<SitTime>[];
  byPhase: Bucket<RutPhase>[];
  bestWind: BestPick | null;
  bestTime: BestPick | null;
  bestPhase: BestPick | null;
  /** Sits with no usable wind / time logged — shown so gaps are visible. */
  missingWind: number;
  missingTime: number;
};

export function buildStatsFromRecords(
  records: SitRecord[],
  standId: string,
  standName: string,
): StandStats {
  const overall = aggregateSits(records);
  const byWind = bucketBy(records, (r) => r.wind, WIND_BUCKETS, (k) => (k === "Calm" ? "Calm" : `${k} wind`));
  const byTime = bucketBy(records, (r) => r.time, SIT_TIMES, (k) => SIT_TIME_LABEL[k]);
  const byPhase = bucketBy(records, (r) => r.phase, RUT_PHASE_ORDER, rutPhaseLabel);

  return {
    standId,
    standName,
    overall,
    byWind,
    byTime,
    byPhase,
    bestWind: pickBest(byWind, overall),
    bestTime: pickBest(byTime, overall),
    bestPhase: pickBest(byPhase, overall),
    missingWind: records.filter((r) => r.wind === null).length,
    missingTime: records.filter((r) => r.time === null).length,
  };
}

/** Stats for one stand from all hunts (filtered here by standId). */
export function buildStandStats(
  stand: Pick<Stand, "id" | "name">,
  hunts: HuntLogEntry[],
  ctx: StatsContext,
): StandStats {
  const records = hunts
    .filter((hunt) => hunt.standId === stand.id)
    .map((hunt) => toSitRecord(hunt, ctx));
  return buildStatsFromRecords(records, stand.id, stand.name);
}

export type PropertyStandStats = {
  property: StandStats;
  /** One row per stand with sits (plus listed stands with none), most sat first. */
  stands: StandStats[];
};

/**
 * Per-stand rows and a property-wide roll-up. Sits whose stand was deleted (or
 * never saved) are grouped under the stand name logged on the sit.
 */
export function buildPropertyStandStats(
  stands: Stand[],
  hunts: HuntLogEntry[],
  ctx: StatsContext,
): PropertyStandStats {
  const records = hunts.map((hunt) => toSitRecord(hunt, ctx));
  const nameById = new Map(stands.map((stand) => [stand.id, stand.name]));
  const groups = new Map<string, { name: string; records: SitRecord[] }>();

  for (const stand of stands) groups.set(stand.id, { name: stand.name, records: [] });
  for (const record of records) {
    const id = record.hunt.standId || `name:${record.hunt.standName || "Unknown"}`;
    const group = groups.get(id) ?? {
      name: nameById.get(id) ?? (record.hunt.standName?.trim() || "Unknown stand"),
      records: [],
    };
    group.records.push(record);
    groups.set(id, group);
  }

  const rows = [...groups.entries()]
    .map(([id, group]) => buildStatsFromRecords(group.records, id, group.name))
    .sort((a, b) => b.overall.sits - a.overall.sits || a.standName.localeCompare(b.standName));

  return {
    property: buildStatsFromRecords(records, "property", "All stands"),
    stands: rows,
  };
}

// --- formatting -----------------------------------------------------------------------

export function formatRate(value: number): string {
  if (!Number.isFinite(value)) return "0";
  return value >= 10 ? value.toFixed(0) : value.toFixed(1);
}

export function formatHours(hours: number): string {
  if (hours <= 0) return "0 h";
  return hours >= 10 ? `${Math.round(hours)} h` : `${hours.toFixed(1)} h`;
}

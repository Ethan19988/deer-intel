// The conditions one tracked deer has shown up in, read from the weather on his
// linked trail-cam photos: the single wind, temperature band, part of the day,
// humidity band and moon phase that account for the biggest share of his
// VISITS. Only photos explicitly linked to the profile count — the same rule
// the travel and intelligence reads follow.
//
// Honesty rules: a burst of photos is one visit (photos on the same camera
// within 10 minutes collapse), it takes 5 distinct visits before a dimension
// says anything, and "seen mostly on SW winds" is only called a preference when
// it beats how often that condition shows up on all deer visits to the same
// cameras. Without that baseline the wording stays soft.

import { trustedPhotoDate } from "@/lib/photoDateTime";
import { photoLinksProfile } from "@/lib/photos";
import { DEFAULT_SUN_POINT, sunTimesFor, type SunTimes } from "@/lib/standStats";
import { toEightWind } from "@/lib/travelDirection";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

export type ConditionKind =
  | "wind"
  | "temperature"
  | "time"
  | "humidity"
  | "moon";

export type ConditionInsight = {
  kind: ConditionKind;
  /** Dimension name, e.g. "Wind". */
  label: string;
  /**
   * The dominant value, worded for what the data can support, e.g.
   * "Seen mostly on SW winds", "Favors SW winds", "Around dawn".
   */
  value: string;
  /** Share of visits with data for this dimension that fell in the top bucket. */
  percent: number;
  /** How many of those visits landed on the top bucket. */
  count: number;
  /** How many distinct visits carried data for this dimension. */
  sampleSize: number;
  /** The raw top bucket, e.g. "SW winds", "40–49°", "Around dawn". */
  bucket: string;
  /**
   * Share of ALL deer visits to the same cameras in that bucket (0-100), when
   * there are enough of them to compare; null when there's no baseline.
   */
  baselinePercent: number | null;
  /** One plain-language line on how much to trust it. */
  note: string;
};

export type DeerConditionInsights = {
  // Strongest signal first, so the highest-percentage condition leads.
  insights: ConditionInsight[];
  hasData: boolean;
};

/** Distinct visits a dimension needs before it earns an insight. */
export const MIN_VISITS = 5;
/** Photos on one camera this close together are one visit. */
export const VISIT_GAP_MS = 10 * 60_000;
/** Baseline visits (all deer, same cameras) needed to compare against. */
const MIN_BASELINE_VISITS = 15;
/** How much more often than the baseline before it reads as a preference. */
const PREFERENCE_LIFT = 1.3;

type DeerConditionInput = {
  profile: DeerProfile;
  photoRecords: PhotoRecord[];
  /** Sun times for a date (StatsContext.sunFor); defaults to central PA. */
  sunFor?: (dateKey: string) => SunTimes | null;
};

type Read = (photo: PhotoRecord) => string;

export function getDeerConditionInsights({
  profile,
  photoRecords,
  sunFor,
}: DeerConditionInput): DeerConditionInsights {
  const linked = collapseVisits(
    photoRecords.filter((photo) => photoLinksProfile(photo, profile.id)),
  );
  // Baseline: every deer visit to the cameras this buck used (him included).
  const cameraIds = new Set(linked.map((photo) => photo.cameraSiteId));
  const baseline = collapseVisits(
    photoRecords.filter(
      (photo) => cameraIds.has(photo.cameraSiteId) && isDeerPhoto(photo),
    ),
  );
  const sun = sunResolver(sunFor);
  const timeValue: Read = (photo) => timeOfDayValue(photo, sun);

  const dims: Array<[ConditionKind, string, Read, boolean]> = [
    ["wind", "Wind", windValue, true],
    ["temperature", "Temperature", temperatureValue, true],
    // Time of day IS the deer-activity signal; no weather baseline applies.
    ["time", "Time of Day", timeValue, false],
    ["humidity", "Humidity", humidityValue, true],
    ["moon", "Moon Phase", moonValue, true],
  ];

  const insights = dims
    .map(([kind, label, read, compare]) =>
      buildInsight(kind, label, collect(linked, read), compare ? collect(baseline, read) : null),
    )
    .filter((insight): insight is ConditionInsight => insight !== null)
    // Lead with the strongest signal; break ties on the larger sample.
    .sort(
      (left, right) =>
        right.percent - left.percent || right.sampleSize - left.sampleSize,
    );

  return { insights, hasData: insights.length > 0 };
}

/**
 * One photo per visit: photos on the same camera within VISIT_GAP_MS of the
 * previous one (a burst, or a buck milling in front of the lens) collapse to
 * the first. Date-only photos collapse per camera per day.
 */
export function collapseVisits(photos: PhotoRecord[]): PhotoRecord[] {
  const timed: Array<{ photo: PhotoRecord; time: number }> = [];
  const dateOnly = new Map<string, PhotoRecord>();
  for (const photo of photos) {
    const raw = trustedPhotoDate(photo).trim();
    const time = /T\d{2}:\d{2}/.test(raw) ? Date.parse(raw) : NaN;
    if (Number.isFinite(time)) {
      timed.push({ photo, time });
    } else {
      const key = `${photo.cameraSiteId}|${raw.slice(0, 10)}`;
      if (!dateOnly.has(key)) dateOnly.set(key, photo);
    }
  }
  timed.sort(
    (a, b) =>
      a.photo.cameraSiteId.localeCompare(b.photo.cameraSiteId) || a.time - b.time,
  );
  const visits: PhotoRecord[] = [];
  let lastCamera = "";
  let lastTime = -Infinity;
  for (const { photo, time } of timed) {
    if (photo.cameraSiteId !== lastCamera || time - lastTime > VISIT_GAP_MS) {
      visits.push(photo);
    }
    lastCamera = photo.cameraSiteId;
    lastTime = time;
  }
  return [...visits, ...dateOnly.values()];
}

function isDeerPhoto(photo: PhotoRecord): boolean {
  if (photo.buckName?.trim() || photo.deerProfileId) return true;
  const species = (photo.species ?? "").toLowerCase();
  return ["deer", "buck", "doe", "fawn", "whitetail"].some((term) => species.includes(term));
}

function collect(photos: PhotoRecord[], read: Read): string[] {
  return photos.map(read).filter(Boolean);
}

function buildInsight(
  kind: ConditionKind,
  label: string,
  values: string[],
  baselineValues: string[] | null,
): ConditionInsight | null {
  if (values.length < MIN_VISITS) return null;

  const top = topEntry(countBy(values));

  if (!top.key) return null;

  const percent = Math.round((top.count / values.length) * 100);
  const hasBaseline = baselineValues !== null && baselineValues.length >= MIN_BASELINE_VISITS;
  const baselinePercent = hasBaseline
    ? Math.round(
        (baselineValues.filter((value) => value === top.key).length / baselineValues.length) * 100,
      )
    : null;

  let value: string;
  let note: string;
  if (baselineValues === null) {
    value = top.key;
    note = `${top.count} of ${values.length} visits.`;
  } else if (baselinePercent === null) {
    value = `Seen mostly on ${top.key}`;
    note = `Not enough other deer visits on these cameras to tell whether ${top.key} is a preference or just the most common condition.`;
  } else if (baselinePercent > 0 && percent / baselinePercent >= PREFERENCE_LIFT) {
    value = `Favors ${top.key}`;
    note = `${percent}% of his visits vs ${baselinePercent}% of all deer visits on these cameras.`;
  } else {
    value = `Seen mostly on ${top.key}`;
    note = `${top.key} is also the most common condition on these cameras (${baselinePercent}% of all deer visits) — no clear preference.`;
  }

  return {
    kind,
    label,
    value,
    percent,
    count: top.count,
    sampleSize: values.length,
    bucket: top.key,
    baselinePercent,
    note,
  };
}

function sunResolver(
  sunFor: DeerConditionInput["sunFor"],
): (dateKey: string) => SunTimes | null {
  if (sunFor) return sunFor;
  const cache = new Map<string, SunTimes | null>();
  return (dateKey) => {
    if (!cache.has(dateKey)) {
      cache.set(dateKey, sunTimesFor(dateKey, DEFAULT_SUN_POINT.lat, DEFAULT_SUN_POINT.lng));
    }
    return cache.get(dateKey) ?? null;
  };
}

function windValue(photo: PhotoRecord): string {
  const wind = toEightWind(photo.weatherSnapshot?.windDirection ?? "");

  return wind ? `${wind} winds` : "";
}

function temperatureValue(photo: PhotoRecord): string {
  const parsed = parseNumber(photo.weatherSnapshot?.temperature);

  if (parsed === null) return "";

  // Ten-degree bands read naturally and let a real concentration surface,
  // instead of splitting on every degree of jitter. Unit-agnostic: the number
  // is bucketed as-is, whether the hunter stores °F or °C.
  const low = Math.floor(parsed / 10) * 10;

  return `${low}–${low + 9}°`;
}

/**
 * Sun-relative part of the day on the photo's own date: within 60 min before to
 * 90 min after sunrise is "Around dawn", 90 min before to 60 min after sunset
 * "Around dusk", daylight between is "Midday", the rest "After dark".
 */
function timeOfDayValue(
  photo: PhotoRecord,
  sunFor: (dateKey: string) => SunTimes | null,
): string {
  const raw = trustedPhotoDate(photo).trim();

  // A date without a clock time can't be placed in a part of the day.
  if (!/T\d{2}:\d{2}/.test(raw)) return "";

  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return "";
  const minutes = date.getHours() * 60 + date.getMinutes();
  const dateKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
  const sun = sunFor(dateKey);
  if (!sun) return "";

  if (minutes >= sun.sunrise - 60 && minutes <= sun.sunrise + 90) return "Around dawn";
  if (minutes >= sun.sunset - 90 && minutes <= sun.sunset + 60) return "Around dusk";
  if (minutes > sun.sunrise && minutes < sun.sunset) return "Midday";
  return "After dark";
}

function humidityValue(photo: PhotoRecord): string {
  // Humidity rides in the snapshot's conditions text as "NN% humidity"
  // (WeatherSnapshot has no dedicated field for it).
  const match = /(\d+)\s*%\s*humidity/i.exec(
    photo.weatherSnapshot?.conditions ?? "",
  );

  if (!match) return "";

  const value = Number(match[1]);

  if (value < 40) return "Low humidity (under 40%)";
  if (value < 70) return "Moderate humidity (40–69%)";

  return "High humidity (70%+)";
}

function moonValue(photo: PhotoRecord): string {
  const raw = (photo.weatherSnapshot?.moonPhase ?? "").trim().toLowerCase();

  if (!raw) return "";

  const waning = raw.includes("wan");

  // Fold the many ways a phase can be written (stamp text, weather history,
  // "Full Moon" vs "Full") into one canonical label so a pattern doesn't split.
  if (raw.includes("new")) return "New moon";
  if (raw.includes("full")) return "Full moon";
  if (raw.includes("gibbous")) {
    return waning ? "Waning gibbous" : "Waxing gibbous";
  }
  if (raw.includes("crescent")) {
    return waning ? "Waning crescent" : "Waxing crescent";
  }
  if (raw.includes("first quarter")) return "First quarter";
  if (raw.includes("last quarter") || raw.includes("third quarter")) {
    return "Last quarter";
  }
  if (raw.includes("quarter")) {
    return waning ? "Last quarter" : "First quarter";
  }

  return "";
}

function parseNumber(raw: string | undefined): number | null {
  const match = /-?\d+(\.\d+)?/.exec(String(raw ?? ""));

  return match ? Number(match[0]) : null;
}

function countBy(values: string[]): Map<string, number> {
  const counts = new Map<string, number>();

  values.forEach((value) => {
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

// The conditions one tracked deer moves best on, read straight from the weather
// on his linked trail-cam photos: the single wind, temperature band, time of
// day, and humidity band that account for the biggest share of his sightings.
// Only photos explicitly linked to the profile count — the same rule the travel
// and intelligence reads follow, so a stand decision never rides on a guess.

import { photoLinksProfile } from "@/lib/photos";
import { toEightWind } from "@/lib/travelDirection";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

export type ConditionKind = "wind" | "temperature" | "time" | "humidity";

export type ConditionInsight = {
  kind: ConditionKind;
  /** Dimension name, e.g. "Wind". */
  label: string;
  /** The dominant value for the dimension, e.g. "SW", "40–49°", "Mornings". */
  value: string;
  /** Share of sightings with data for this dimension that fell in `value`. */
  percent: number;
  /** How many of those sightings landed on the top value. */
  count: number;
  /** How many linked sightings carried data for this dimension. */
  sampleSize: number;
};

export type DeerConditionInsights = {
  // Strongest signal first, so the highest-percentage condition leads.
  insights: ConditionInsight[];
  hasData: boolean;
};

// One photo is a coincidence, not a pattern — a dimension needs at least this
// many linked sightings with data before it earns an insight.
const MIN_SIGHTINGS = 2;

type DeerConditionInput = {
  profile: DeerProfile;
  photoRecords: PhotoRecord[];
};

export function getDeerConditionInsights({
  profile,
  photoRecords,
}: DeerConditionInput): DeerConditionInsights {
  const linked = photoRecords.filter((photo) =>
    photoLinksProfile(photo, profile.id),
  );

  const winds = collect(linked, windValue);
  const temps = collect(linked, temperatureValue);
  const times = collect(linked, timeValue);
  const humidities = collect(linked, humidityValue);

  const insights = [
    buildInsight("wind", "Wind", winds),
    buildInsight("temperature", "Temperature", temps),
    buildInsight("time", "Time of Day", times),
    buildInsight("humidity", "Humidity", humidities),
  ]
    .filter((insight): insight is ConditionInsight => insight !== null)
    // Lead with the strongest signal; break ties on the larger sample.
    .sort(
      (left, right) =>
        right.percent - left.percent || right.sampleSize - left.sampleSize,
    );

  return { insights, hasData: insights.length > 0 };
}

function collect(
  photos: PhotoRecord[],
  read: (photo: PhotoRecord) => string,
): string[] {
  return photos.map(read).filter(Boolean);
}

function buildInsight(
  kind: ConditionKind,
  label: string,
  values: string[],
): ConditionInsight | null {
  if (values.length < MIN_SIGHTINGS) return null;

  const top = topEntry(countBy(values));

  if (!top.key) return null;

  return {
    kind,
    label,
    value: top.key,
    percent: Math.round((top.count / values.length) * 100),
    count: top.count,
    sampleSize: values.length,
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

function timeValue(photo: PhotoRecord): string {
  const raw = photo.photoDate.trim();

  // A date without a clock time can't be placed in a part of the day.
  if (!/T\d{2}:\d{2}/.test(raw)) return "";

  const hour = new Date(raw).getHours();

  if (Number.isNaN(hour)) return "";

  // The same daybreaks the travel time-of-day read uses.
  if (hour >= 5 && hour <= 10) return "Mornings";
  if (hour >= 11 && hour <= 14) return "Middays";
  if (hour >= 15 && hour <= 20) return "Evenings";

  return "Nights";
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

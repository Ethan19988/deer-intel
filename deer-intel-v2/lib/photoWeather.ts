"use client";

import {
  fetchHistoricalWeather,
  type WeatherPoint,
} from "@/lib/liveWeather";
import { describeMoonPhase } from "@/lib/moonPhase";
import { DEFAULT_UNITS, type UnitPreferences } from "@/lib/units";
import { createWeatherSnapshot } from "@/lib/weather";
import type { WeatherSnapshot } from "@/types/weather";

/**
 * Build the weather a photo was taken in: the moon phase from the date alone (no
 * network) plus the temperature, wind, and sky looked up from Open-Meteo history
 * for the given location. Accepts either a date ("YYYY-MM-DD") or a datetime-local
 * ("YYYY-MM-DDTHH:mm") value; returns undefined when the date can't be parsed.
 */
// Values read straight off the photo's printed info bar, which take priority
// over the weather-history lookup when present.
export type StampedWeather = {
  temperature?: string;
  moonPhase?: string;
  windDirection?: string;
  windSpeed?: string;
  humidity?: string;
};

export async function buildPhotoWeatherSnapshot(
  photoDate: string,
  point: WeatherPoint | null,
  units: UnitPreferences = DEFAULT_UNITS,
  stamped?: StampedWeather,
): Promise<WeatherSnapshot | undefined> {
  const parsed = parsePhotoDate(photoDate);
  // Values the camera printed on the image outrank the history lookup, and the
  // snapshot's source records where the numbers actually came from.
  const usedStamp = Boolean(
    stamped?.temperature ||
      stamped?.moonPhase ||
      stamped?.windDirection ||
      stamped?.windSpeed ||
      stamped?.humidity,
  );
  if (!parsed) {
    // WeatherSnapshot has no humidity field, so humidity rides along in the
    // conditions text.
    const humidityText = stamped?.humidity ? `${stamped.humidity}% humidity` : "";
    // No usable date, but a readable stamp still gives us its values to keep.
    if (usedStamp) {
      return createWeatherSnapshot({
        temperature: stamped?.temperature ?? "",
        windDirection: stamped?.windDirection ?? "",
        windSpeed: stamped?.windSpeed ?? "",
        conditions: humidityText,
        moonPhase: stamped?.moonPhase ?? "",
        source: "photo",
      });
    }

    return undefined;
  }

  const moonPhase = describeMoonPhase(parsed.getTime());
  const historical = point
    ? await fetchHistoricalWeather(point, parsed, units)
    : null;
  // Humidity rides in the conditions text (WeatherSnapshot has no field for
  // it): the camera's printed value first, weather history as backup.
  const humidity = stamped?.humidity || historical?.humidity || "";
  const humidityText = humidity ? `${humidity}% humidity` : "";

  return createWeatherSnapshot({
    temperature: stamped?.temperature || historical?.temperature || "",
    windDirection: stamped?.windDirection || historical?.windDirection || "",
    windSpeed: stamped?.windSpeed || historical?.windSpeed || "",
    conditions: [historical?.weather ?? "", humidityText]
      .filter(Boolean)
      .join(" / "),
    moonPhase: stamped?.moonPhase || moonPhase,
    source: usedStamp ? "photo" : "historical",
  });
}

// Date-only strings parse as UTC midnight, which can shift the local day; anchor
// them to local noon so the moon phase and weather hour land on the right day.
function parsePhotoDate(photoDate: string): Date | null {
  const value = photoDate.trim();

  if (!value) return null;

  const normalized = value.length <= 10 ? `${value}T12:00` : value;
  const parsed = new Date(normalized);

  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

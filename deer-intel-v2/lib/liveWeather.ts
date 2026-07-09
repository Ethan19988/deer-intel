"use client";

import type { Camera } from "@/types/camera";
import type { MapPin } from "@/types/mapPin";
import type { Property } from "@/types/property";
import { hasPropertyCoordinate } from "@/lib/propertyLocation";

// Live weather is fetched from Open-Meteo (https://open-meteo.com), a free
// no-API-key forecast service. We only ask for the current conditions a hunter
// cares about — temperature, wind, and sky — and derive the moon phase locally,
// since Open-Meteo does not report it. The result is shaped to drop straight
// into the manual weather fields on the hunt log and camera check forms.

export type WeatherPoint = {
  lat: number;
  lng: number;
};

export type LiveWeatherFields = {
  temperature: string;
  windDirection: string;
  windSpeed: string;
  weather: string;
  moonPhase: string;
};

export type LiveWeatherResult =
  | {
      status: "ok";
      point: WeatherPoint;
      fields: LiveWeatherFields;
      summary: string;
    }
  | {
      status: "error";
      message: string;
    };

/** A single day in the short forecast a hunter uses to pick which day to sit. */
export type ForecastDay = {
  date: string;
  label: string;
  high: string;
  low: string;
  conditions: string;
  wind: string;
};

export type LiveForecast = {
  current: LiveWeatherFields;
  sunrise: string;
  sunset: string;
  days: ForecastDay[];
};

export type LiveForecastResult =
  | { status: "ok"; point: WeatherPoint; forecast: LiveForecast }
  | { status: "error"; message: string };

type OpenMeteoCurrent = {
  temperature_2m?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  weather_code?: number;
};

type OpenMeteoDaily = {
  time?: string[];
  weather_code?: number[];
  temperature_2m_max?: number[];
  temperature_2m_min?: number[];
  wind_speed_10m_max?: number[];
  wind_direction_10m_dominant?: number[];
  sunrise?: string[];
  sunset?: string[];
};

type OpenMeteoResponse = {
  current?: OpenMeteoCurrent;
  daily?: OpenMeteoDaily;
};

const liveWeatherCache = new Map<string, LiveWeatherResult>();

// One synodic month and a known new-moon reference (2000-01-06 18:14 UTC) are
// enough to name the current moon phase without a network call or a library.
const SYNODIC_MONTH_DAYS = 29.530588853;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

/**
 * Derive a single representative coordinate for a property from the assets a
 * hunter has already placed on the map. Cameras carry their own lat/long and
 * map pins carry lat/lng, so the average of everything saved is a good stand-in
 * for "where this property is" until properties store their own center.
 */
export function getPropertyWeatherPoint(
  cameras: Camera[],
  pins: MapPin[],
): WeatherPoint | null {
  const coordinates: WeatherPoint[] = [];

  for (const camera of cameras) {
    if (
      typeof camera.latitude === "number" &&
      typeof camera.longitude === "number" &&
      Number.isFinite(camera.latitude) &&
      Number.isFinite(camera.longitude)
    ) {
      coordinates.push({ lat: camera.latitude, lng: camera.longitude });
    }
  }

  for (const pin of pins) {
    if (Number.isFinite(pin.lat) && Number.isFinite(pin.lng)) {
      coordinates.push({ lat: pin.lat, lng: pin.lng });
    }
  }

  if (coordinates.length === 0) return null;

  const total = coordinates.reduce(
    (sum, coordinate) => ({
      lat: sum.lat + coordinate.lat,
      lng: sum.lng + coordinate.lng,
    }),
    { lat: 0, lng: 0 },
  );

  return {
    lat: total.lat / coordinates.length,
    lng: total.lng / coordinates.length,
  };
}

/**
 * Resolve the best weather point for a property: its own saved center if set,
 * otherwise the average of its placed cameras and pins. Returns null when there
 * is nothing to go on, letting the UI fall back to the device's GPS location.
 */
export function resolvePropertyWeatherPoint(
  property: Property | null | undefined,
  cameras: Camera[],
  pins: MapPin[],
): WeatherPoint | null {
  if (property && hasPropertyCoordinate(property)) {
    return { lat: property.latitude, lng: property.longitude };
  }

  return getPropertyWeatherPoint(cameras, pins);
}

export async function fetchLiveWeather(
  point: WeatherPoint,
): Promise<LiveWeatherResult> {
  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    point.lat < -90 ||
    point.lat > 90 ||
    point.lng < -180 ||
    point.lng > 180
  ) {
    return {
      status: "error",
      message: "That location isn't a valid coordinate for weather.",
    };
  }

  const cacheKey = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
  const cached = liveWeatherCache.get(cacheKey);

  if (cached) return cached;

  try {
    const requestUrl = new URL("https://api.open-meteo.com/v1/forecast");

    requestUrl.searchParams.set("latitude", point.lat.toFixed(4));
    requestUrl.searchParams.set("longitude", point.lng.toFixed(4));
    requestUrl.searchParams.set(
      "current",
      "temperature_2m,wind_speed_10m,wind_direction_10m,weather_code",
    );
    requestUrl.searchParams.set("temperature_unit", "fahrenheit");
    requestUrl.searchParams.set("wind_speed_unit", "mph");

    const response = await fetch(requestUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        status: "error",
        message: "Live weather is temporarily unavailable. Try again.",
      };
    }

    const payload: unknown = await response.json();

    if (!isOpenMeteoResponse(payload) || !payload.current) {
      return {
        status: "error",
        message: "Live weather returned an unexpected response.",
      };
    }

    const result = buildLiveWeatherResult(point, payload.current);

    liveWeatherCache.set(cacheKey, result);

    return result;
  } catch {
    return {
      status: "error",
      message: "Live weather is temporarily unavailable. Try again.",
    };
  }
}

const liveForecastCache = new Map<string, LiveForecastResult>();

// Richer fetch for the dashboard: current conditions plus today's sunrise /
// sunset (shooting light) and a short daily forecast (planning which day to
// sit). Shares the same Open-Meteo endpoint and helpers as fetchLiveWeather;
// the form auto-fill continues to use the lighter fetchLiveWeather.
export async function fetchLiveForecast(
  point: WeatherPoint,
): Promise<LiveForecastResult> {
  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    point.lat < -90 ||
    point.lat > 90 ||
    point.lng < -180 ||
    point.lng > 180
  ) {
    return {
      status: "error",
      message: "That location isn't a valid coordinate for weather.",
    };
  }

  const cacheKey = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}`;
  const cached = liveForecastCache.get(cacheKey);

  if (cached) return cached;

  try {
    const requestUrl = new URL("https://api.open-meteo.com/v1/forecast");

    requestUrl.searchParams.set("latitude", point.lat.toFixed(4));
    requestUrl.searchParams.set("longitude", point.lng.toFixed(4));
    requestUrl.searchParams.set(
      "current",
      "temperature_2m,wind_speed_10m,wind_direction_10m,weather_code",
    );
    requestUrl.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset",
    );
    requestUrl.searchParams.set("temperature_unit", "fahrenheit");
    requestUrl.searchParams.set("wind_speed_unit", "mph");
    requestUrl.searchParams.set("timezone", "auto");
    requestUrl.searchParams.set("forecast_days", "3");

    const response = await fetch(requestUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        status: "error",
        message: "Live weather is temporarily unavailable. Try again.",
      };
    }

    const payload: unknown = await response.json();

    if (!isOpenMeteoResponse(payload) || !payload.current || !payload.daily) {
      return {
        status: "error",
        message: "Live weather returned an unexpected response.",
      };
    }

    const base = buildLiveWeatherResult(point, payload.current);

    if (base.status !== "ok") {
      return { status: "error", message: "Live weather returned no data." };
    }

    const daily = payload.daily;
    const days: ForecastDay[] = (daily.time ?? []).map((date, index) => ({
      date,
      label: weekdayLabel(date, index),
      high: numberToText(daily.temperature_2m_max?.[index]),
      low: numberToText(daily.temperature_2m_min?.[index]),
      conditions:
        typeof daily.weather_code?.[index] === "number"
          ? describeWeatherCode(daily.weather_code[index])
          : "",
      wind: formatWind(
        daily.wind_direction_10m_dominant?.[index],
        daily.wind_speed_10m_max?.[index],
      ),
    }));

    const result: LiveForecastResult = {
      status: "ok",
      point,
      forecast: {
        current: base.fields,
        sunrise: formatClockTime(daily.sunrise?.[0]),
        sunset: formatClockTime(daily.sunset?.[0]),
        days,
      },
    };

    liveForecastCache.set(cacheKey, result);

    return result;
  } catch {
    return {
      status: "error",
      message: "Live weather is temporarily unavailable. Try again.",
    };
  }
}

function numberToText(value: number | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}` : "";
}

function formatWind(
  direction: number | undefined,
  speed: number | undefined,
): string {
  const dir = typeof direction === "number" ? degreesToCompass(direction) : "";
  const spd = typeof speed === "number" ? `${Math.round(speed)} mph` : "";

  return [dir, spd].filter(Boolean).join(" ");
}

function formatClockTime(iso: string | undefined): string {
  if (!iso) return "";

  const date = new Date(iso);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleTimeString(undefined, {
    hour: "numeric",
    minute: "2-digit",
  });
}

function weekdayLabel(iso: string, index: number): string {
  if (index === 0) return "Today";

  const date = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function buildLiveWeatherResult(
  point: WeatherPoint,
  current: OpenMeteoCurrent,
): LiveWeatherResult {
  const temperature =
    typeof current.temperature_2m === "number"
      ? `${Math.round(current.temperature_2m)}`
      : "";
  const windSpeed =
    typeof current.wind_speed_10m === "number"
      ? `${Math.round(current.wind_speed_10m)} mph`
      : "";
  const windDirection =
    typeof current.wind_direction_10m === "number"
      ? degreesToCompass(current.wind_direction_10m)
      : "";
  const weather =
    typeof current.weather_code === "number"
      ? describeWeatherCode(current.weather_code)
      : "";
  const moonPhase = describeMoonPhase(Date.now());

  const fields: LiveWeatherFields = {
    temperature,
    windDirection,
    windSpeed,
    weather,
    moonPhase,
  };

  const summaryParts = [
    temperature ? `${temperature} F` : "",
    windDirection && windSpeed
      ? `${windDirection} at ${windSpeed}`
      : windDirection || windSpeed,
    weather,
    moonPhase ? `${moonPhase} moon` : "",
  ].filter(Boolean);

  return {
    status: "ok",
    point,
    fields,
    summary: summaryParts.join(" / ") || "Live weather saved",
  };
}

export function degreesToCompass(degrees: number): string {
  const compassPoints = [
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
  ];
  const normalized = ((degrees % 360) + 360) % 360;
  const index = Math.round(normalized / 22.5) % compassPoints.length;

  return compassPoints[index];
}

export function describeMoonPhase(timestampMs: number): string {
  const daysSinceReference =
    (timestampMs - REFERENCE_NEW_MOON_MS) / 86_400_000;
  const age =
    ((daysSinceReference % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) %
    SYNODIC_MONTH_DAYS;

  if (age < 1.85 || age >= 27.68) return "New";
  if (age < 5.54) return "Waxing crescent";
  if (age < 9.23) return "First quarter";
  if (age < 12.91) return "Waxing gibbous";
  if (age < 16.61) return "Full";
  if (age < 20.3) return "Waning gibbous";
  if (age < 23.99) return "Last quarter";

  return "Waning crescent";
}

function describeWeatherCode(code: number): string {
  const weatherCodeLabels: Record<number, string> = {
    0: "Clear",
    1: "Mainly clear",
    2: "Partly cloudy",
    3: "Overcast",
    45: "Fog",
    48: "Freezing fog",
    51: "Light drizzle",
    53: "Drizzle",
    55: "Heavy drizzle",
    56: "Freezing drizzle",
    57: "Freezing drizzle",
    61: "Light rain",
    63: "Rain",
    65: "Heavy rain",
    66: "Freezing rain",
    67: "Freezing rain",
    71: "Light snow",
    73: "Snow",
    75: "Heavy snow",
    77: "Snow grains",
    80: "Rain showers",
    81: "Rain showers",
    82: "Heavy rain showers",
    85: "Snow showers",
    86: "Heavy snow showers",
    95: "Thunderstorm",
    96: "Thunderstorm with hail",
    99: "Thunderstorm with hail",
  };

  return weatherCodeLabels[code] ?? "Unknown";
}

function isOpenMeteoResponse(value: unknown): value is OpenMeteoResponse {
  return typeof value === "object" && value !== null;
}

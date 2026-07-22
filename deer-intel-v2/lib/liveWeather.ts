"use client";

import type { Camera } from "@/types/camera";
import type { MapPin } from "@/types/mapPin";
import type { Property } from "@/types/property";
import { hasPropertyCoordinate } from "@/lib/propertyLocation";
import { describeMoonPhase } from "@/lib/moonPhase";
import {
  DEFAULT_UNITS,
  openMeteoTemperatureUnit,
  openMeteoWindSpeedUnit,
  TEMPERATURE_UNIT_LABEL,
  WIND_UNIT_LABEL,
  type UnitPreferences,
} from "@/lib/units";

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
  /** Day-over-day barometric direction, for the movement outlook. */
  pressureTrend?: PressureTrend;
};

export type PressureTrend = "rising" | "steady" | "falling";

/** Barometric pressure plus a hunting cue (deer move on a falling barometer). */
export type PressureReading = {
  value: string;
  trend: PressureTrend;
  hint: string;
  /** Recent hourly readings in inHg, oldest → now, for a sparkline. */
  series?: number[];
};

export type LiveForecast = {
  current: LiveWeatherFields;
  sunrise: string;
  sunset: string;
  days: ForecastDay[];
  pressure?: PressureReading;
};

export type LiveForecastResult =
  | { status: "ok"; point: WeatherPoint; forecast: LiveForecast }
  | { status: "error"; message: string };

type OpenMeteoCurrent = {
  time?: string;
  temperature_2m?: number;
  wind_speed_10m?: number;
  wind_direction_10m?: number;
  weather_code?: number;
  pressure_msl?: number;
};

type OpenMeteoHourly = {
  time?: string[];
  pressure_msl?: number[];
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
  hourly?: OpenMeteoHourly;
  daily?: OpenMeteoDaily;
};

const liveWeatherCache = new Map<string, LiveWeatherResult>();

/** True only for a real-world coordinate — finite and inside lat/lng bounds. */
function isUsableCoordinate(lat: number, lng: number): boolean {
  return (
    Number.isFinite(lat) &&
    Number.isFinite(lng) &&
    lat >= -90 &&
    lat <= 90 &&
    lng >= -180 &&
    lng <= 180
  );
}

/**
 * Derive a single representative coordinate for a property from the assets a
 * hunter has already placed on the map. Cameras carry their own lat/long and
 * map pins carry lat/lng, so the average of everything saved is a good stand-in
 * for "where this property is" until properties store their own center. A
 * mistyped coordinate (e.g. a longitude missing its decimal point) is skipped
 * rather than poisoning the average for the whole property.
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
      isUsableCoordinate(camera.latitude, camera.longitude)
    ) {
      coordinates.push({ lat: camera.latitude, lng: camera.longitude });
    }
  }

  for (const pin of pins) {
    if (isUsableCoordinate(pin.lat, pin.lng)) {
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
  units: UnitPreferences = DEFAULT_UNITS,
): Promise<LiveWeatherResult> {
  if (!isUsableCoordinate(point.lat, point.lng)) {
    return {
      status: "error",
      message: "That location isn't a valid coordinate for weather.",
    };
  }

  const cacheKey = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}|${units.temperature}|${units.wind}`;
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
    requestUrl.searchParams.set(
      "temperature_unit",
      openMeteoTemperatureUnit(units.temperature),
    );
    requestUrl.searchParams.set(
      "wind_speed_unit",
      openMeteoWindSpeedUnit(units.wind),
    );

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

    const result = buildLiveWeatherResult(point, payload.current, units);

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
  units: UnitPreferences = DEFAULT_UNITS,
): Promise<LiveForecastResult> {
  if (!isUsableCoordinate(point.lat, point.lng)) {
    return {
      status: "error",
      message: "That location isn't a valid coordinate for weather.",
    };
  }

  const cacheKey = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}|${units.temperature}|${units.wind}`;
  const cached = liveForecastCache.get(cacheKey);

  if (cached) return cached;

  try {
    const requestUrl = new URL("https://api.open-meteo.com/v1/forecast");

    requestUrl.searchParams.set("latitude", point.lat.toFixed(4));
    requestUrl.searchParams.set("longitude", point.lng.toFixed(4));
    requestUrl.searchParams.set(
      "current",
      "temperature_2m,wind_speed_10m,wind_direction_10m,weather_code,pressure_msl",
    );
    requestUrl.searchParams.set("hourly", "pressure_msl");
    requestUrl.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant,sunrise,sunset",
    );
    requestUrl.searchParams.set(
      "temperature_unit",
      openMeteoTemperatureUnit(units.temperature),
    );
    requestUrl.searchParams.set(
      "wind_speed_unit",
      openMeteoWindSpeedUnit(units.wind),
    );
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

    const base = buildLiveWeatherResult(point, payload.current, units);

    if (base.status !== "ok") {
      return { status: "error", message: "Live weather returned no data." };
    }

    const daily = payload.daily;
    const dailyTrends = buildDailyPressureTrends(daily.time ?? [], payload.hourly);
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
        units,
      ),
      pressureTrend: dailyTrends[index],
    }));

    const result: LiveForecastResult = {
      status: "ok",
      point,
      forecast: {
        current: base.fields,
        sunrise: formatClockTime(daily.sunrise?.[0]),
        sunset: formatClockTime(daily.sunset?.[0]),
        days,
        pressure: buildPressureReading(payload.current, payload.hourly),
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

/** A backward-looking strip of recent daily conditions for a property. */
export type WeatherHistoryResult =
  | { status: "ok"; point: WeatherPoint; days: ForecastDay[] }
  | { status: "error"; message: string };

const weatherHistoryCache = new Map<string, WeatherHistoryResult>();

// Recent past conditions — a backward look that complements the 3-day forecast.
// Deer patterns are read from the days LEADING UP to a hunt (a cold front two
// days ago, a warm spell all week), so this pulls the last `days` days of daily
// highs/lows, wind, and barometric direction from the same free Open-Meteo layer
// via its `past_days` parameter. Today is dropped because the live panel already
// shows current conditions, leaving a clean oldest -> yesterday timeline that
// sits continuously ahead of the forecast.
export async function fetchWeatherHistory(
  point: WeatherPoint,
  units: UnitPreferences = DEFAULT_UNITS,
  days = 7,
): Promise<WeatherHistoryResult> {
  if (!isUsableCoordinate(point.lat, point.lng)) {
    return {
      status: "error",
      message: "That location isn't a valid coordinate for weather.",
    };
  }

  // Open-Meteo's forecast endpoint serves recent history via past_days (max 92);
  // a week keeps day labels unambiguous and the request light.
  const span = Math.max(1, Math.min(Math.round(days), 14));
  const cacheKey = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}|${span}|${units.temperature}|${units.wind}`;
  const cached = weatherHistoryCache.get(cacheKey);

  if (cached) return cached;

  try {
    const requestUrl = new URL("https://api.open-meteo.com/v1/forecast");

    requestUrl.searchParams.set("latitude", point.lat.toFixed(4));
    requestUrl.searchParams.set("longitude", point.lng.toFixed(4));
    requestUrl.searchParams.set("hourly", "pressure_msl");
    requestUrl.searchParams.set(
      "daily",
      "weather_code,temperature_2m_max,temperature_2m_min,wind_speed_10m_max,wind_direction_10m_dominant",
    );
    requestUrl.searchParams.set(
      "temperature_unit",
      openMeteoTemperatureUnit(units.temperature),
    );
    requestUrl.searchParams.set(
      "wind_speed_unit",
      openMeteoWindSpeedUnit(units.wind),
    );
    requestUrl.searchParams.set("timezone", "auto");
    requestUrl.searchParams.set("past_days", String(span));
    requestUrl.searchParams.set("forecast_days", "1");

    const response = await fetch(requestUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) {
      return {
        status: "error",
        message: "Weather history is temporarily unavailable. Try again.",
      };
    }

    const payload: unknown = await response.json();

    if (!isOpenMeteoResponse(payload) || !payload.daily) {
      return {
        status: "error",
        message: "Weather history returned an unexpected response.",
      };
    }

    const daily = payload.daily;
    const dates = daily.time ?? [];
    const trends = buildDailyPressureTrends(dates, payload.hourly);
    const entries: ForecastDay[] = dates.map((date, index) => ({
      date,
      label: historyDayLabel(date),
      high: numberToText(daily.temperature_2m_max?.[index]),
      low: numberToText(daily.temperature_2m_min?.[index]),
      conditions:
        typeof daily.weather_code?.[index] === "number"
          ? describeWeatherCode(daily.weather_code[index])
          : "",
      wind: formatWind(
        daily.wind_direction_10m_dominant?.[index],
        daily.wind_speed_10m_max?.[index],
        units,
      ),
      pressureTrend: trends[index],
    }));

    // Drop the final entry (today) so this stays a purely backward view; the
    // remaining days read oldest -> yesterday.
    const result: WeatherHistoryResult = {
      status: "ok",
      point,
      days: entries.slice(0, -1),
    };

    weatherHistoryCache.set(cacheKey, result);

    return result;
  } catch {
    return {
      status: "error",
      message: "Weather history is temporarily unavailable. Try again.",
    };
  }
}

/** The conditions a photo was taken in — the moon phase is added locally. */
export type HistoricalWeatherFields = Pick<
  LiveWeatherFields,
  "temperature" | "windDirection" | "windSpeed" | "weather"
> & {
  /** Relative humidity percentage as a plain number string, "" if unknown. */
  humidity: string;
};

type OpenMeteoWeatherHourly = {
  time?: string[];
  temperature_2m?: number[];
  relative_humidity_2m?: number[];
  wind_speed_10m?: number[];
  wind_direction_10m?: number[];
  weather_code?: number[];
};

// One fetched day of hourly history, cached so importing a whole card pull only
// hits Open-Meteo once per unique (location, day) instead of once per photo.
const historicalDayCache = new Map<string, OpenMeteoWeatherHourly | null>();

/**
 * Look up the actual temperature, wind, and sky at the hour a trail-cam photo
 * was captured, using Open-Meteo's history. Recent dates (within ~90 days) come
 * from the forecast endpoint — which has no reanalysis delay — and older dates
 * from the archive endpoint. Returns null when history isn't available.
 */
export async function fetchHistoricalWeather(
  point: WeatherPoint,
  when: Date,
  units: UnitPreferences = DEFAULT_UNITS,
): Promise<HistoricalWeatherFields | null> {
  if (
    !Number.isFinite(point.lat) ||
    !Number.isFinite(point.lng) ||
    Number.isNaN(when.getTime())
  ) {
    return null;
  }

  const dateKey = toLocalDateKey(when);
  const cacheKey = `${point.lat.toFixed(3)},${point.lng.toFixed(3)}|${dateKey}|${units.temperature}|${units.wind}`;

  let hourly = historicalDayCache.get(cacheKey);

  if (hourly === undefined) {
    hourly = await fetchHistoricalDay(point, dateKey, when, units);
    historicalDayCache.set(cacheKey, hourly);
  }

  if (!hourly) return null;

  return pickHourFields(hourly, when, units);
}

async function fetchHistoricalDay(
  point: WeatherPoint,
  dateKey: string,
  when: Date,
  units: UnitPreferences,
): Promise<OpenMeteoWeatherHourly | null> {
  const daysAgo = (Date.now() - when.getTime()) / 86_400_000;
  const base =
    daysAgo <= 90
      ? "https://api.open-meteo.com/v1/forecast"
      : "https://archive-api.open-meteo.com/v1/archive";

  try {
    const requestUrl = new URL(base);

    requestUrl.searchParams.set("latitude", point.lat.toFixed(4));
    requestUrl.searchParams.set("longitude", point.lng.toFixed(4));
    requestUrl.searchParams.set("start_date", dateKey);
    requestUrl.searchParams.set("end_date", dateKey);
    requestUrl.searchParams.set(
      "hourly",
      "temperature_2m,relative_humidity_2m,wind_speed_10m,wind_direction_10m,weather_code",
    );
    requestUrl.searchParams.set(
      "temperature_unit",
      openMeteoTemperatureUnit(units.temperature),
    );
    requestUrl.searchParams.set(
      "wind_speed_unit",
      openMeteoWindSpeedUnit(units.wind),
    );
    requestUrl.searchParams.set("timezone", "auto");

    const response = await fetch(requestUrl.toString(), {
      headers: { Accept: "application/json" },
    });

    if (!response.ok) return null;

    const payload: unknown = await response.json();

    if (
      typeof payload !== "object" ||
      payload === null ||
      !("hourly" in payload)
    ) {
      return null;
    }

    const hourly = (payload as { hourly?: OpenMeteoWeatherHourly }).hourly;

    return hourly && Array.isArray(hourly.time) ? hourly : null;
  } catch {
    return null;
  }
}

function pickHourFields(
  hourly: OpenMeteoWeatherHourly,
  when: Date,
  units: UnitPreferences,
): HistoricalWeatherFields | null {
  const times = hourly.time ?? [];

  if (times.length === 0) return null;

  const targetHour = `${toLocalDateKey(when)}T${padTwo(when.getHours())}`;
  let index = times.findIndex((entry) => entry.slice(0, 13) === targetHour);

  if (index < 0) index = 0; // fall back to the first sample of the day

  const temperature = numberToText(hourly.temperature_2m?.[index]);
  const windDirection =
    typeof hourly.wind_direction_10m?.[index] === "number"
      ? degreesToCompass(hourly.wind_direction_10m[index])
      : "";
  const windSpeed =
    typeof hourly.wind_speed_10m?.[index] === "number"
      ? `${Math.round(hourly.wind_speed_10m[index])} ${WIND_UNIT_LABEL[units.wind]}`
      : "";
  const weather =
    typeof hourly.weather_code?.[index] === "number"
      ? describeWeatherCode(hourly.weather_code[index])
      : "";
  const humidity = numberToText(hourly.relative_humidity_2m?.[index]);

  if (!temperature && !windDirection && !windSpeed && !weather && !humidity) {
    return null;
  }

  return { temperature, windDirection, windSpeed, weather, humidity };
}

function toLocalDateKey(date: Date): string {
  return `${date.getFullYear()}-${padTwo(date.getMonth() + 1)}-${padTwo(
    date.getDate(),
  )}`;
}

function padTwo(value: number): string {
  return String(value).padStart(2, "0");
}

function numberToText(value: number | undefined): string {
  return typeof value === "number" ? `${Math.round(value)}` : "";
}

const HPA_TO_INHG = 0.02953;
// hPa change over ~3h that counts as a real barometer move rather than noise.
const PRESSURE_TREND_THRESHOLD = 1.5;

function buildPressureReading(
  current: OpenMeteoCurrent,
  hourly: OpenMeteoHourly | undefined,
): PressureReading | undefined {
  const nowHpa = current.pressure_msl;

  if (typeof nowHpa !== "number" || !Number.isFinite(nowHpa)) return undefined;

  const value = `${(nowHpa * HPA_TO_INHG).toFixed(2)} inHg`;
  let trend: PressureTrend = "steady";

  const times = hourly?.time ?? [];
  const readings = hourly?.pressure_msl ?? [];
  const currentHour = current.time ? current.time.slice(0, 13) : "";
  let index = currentHour
    ? times.findIndex((entry) => entry.slice(0, 13) === currentHour)
    : -1;

  // Fall back to the latest hourly sample when the current hour isn't listed.
  if (index < 0) index = readings.length - 1;

  const past = readings[index - 3];

  if (typeof past === "number" && Number.isFinite(past)) {
    const delta = nowHpa - past;

    if (delta <= -PRESSURE_TREND_THRESHOLD) trend = "falling";
    else if (delta >= PRESSURE_TREND_THRESHOLD) trend = "rising";
  }

  const hint =
    trend === "falling"
      ? "Front moving in — movement likely"
      : trend === "rising"
        ? "Clearing behind a front"
        : "Little pressure change";

  // Up to ~12 hours of readings ending at now, in inHg, for a sparkline.
  const series: number[] = [];
  for (let i = Math.max(0, index - 12); i <= index; i += 1) {
    const reading = readings[i];
    if (typeof reading === "number" && Number.isFinite(reading)) {
      series.push(Number((reading * HPA_TO_INHG).toFixed(3)));
    }
  }

  return { value, trend, hint, series: series.length >= 3 ? series : undefined };
}

// Day-over-day barometric direction for each forecast day, used by the movement
// outlook. Deer move on a dropping barometer, so comparing each day's mean
// pressure to the day before flags which day a front is pushing through. The
// first day has no prior day in the window, so it is left undefined (the hero's
// live reading covers "today").
const DAILY_PRESSURE_THRESHOLD = 1.0;

function buildDailyPressureTrends(
  dailyTimes: string[],
  hourly: OpenMeteoHourly | undefined,
): Array<PressureTrend | undefined> {
  const times = hourly?.time ?? [];
  const readings = hourly?.pressure_msl ?? [];

  const dayMean = dailyTimes.map((date) => {
    let sum = 0;
    let count = 0;

    for (let index = 0; index < times.length; index += 1) {
      const value = readings[index];
      if (times[index].slice(0, 10) === date && typeof value === "number") {
        sum += value;
        count += 1;
      }
    }

    return count > 0 ? sum / count : null;
  });

  return dayMean.map((mean, index) => {
    const previous = dayMean[index - 1];

    if (
      index === 0 ||
      mean === null ||
      previous === null ||
      previous === undefined
    ) {
      return undefined;
    }

    const delta = mean - previous;

    if (delta <= -DAILY_PRESSURE_THRESHOLD) return "falling";
    if (delta >= DAILY_PRESSURE_THRESHOLD) return "rising";

    return "steady";
  });
}

function formatWind(
  direction: number | undefined,
  speed: number | undefined,
  units: UnitPreferences,
): string {
  const dir = typeof direction === "number" ? degreesToCompass(direction) : "";
  const spd =
    typeof speed === "number"
      ? `${Math.round(speed)} ${WIND_UNIT_LABEL[units.wind]}`
      : "";

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

// Label for a past day in the weather-history strip: "Yesterday" for the most
// recent, otherwise the weekday (unambiguous over a one-week window).
function historyDayLabel(iso: string): string {
  const date = new Date(`${iso}T12:00:00`);

  if (Number.isNaN(date.getTime())) return "";

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);

  if (toLocalDateKey(date) === toLocalDateKey(yesterday)) return "Yesterday";

  return date.toLocaleDateString(undefined, { weekday: "short" });
}

function buildLiveWeatherResult(
  point: WeatherPoint,
  current: OpenMeteoCurrent,
  units: UnitPreferences,
): LiveWeatherResult {
  const temperature =
    typeof current.temperature_2m === "number"
      ? `${Math.round(current.temperature_2m)}`
      : "";
  const windSpeed =
    typeof current.wind_speed_10m === "number"
      ? `${Math.round(current.wind_speed_10m)} ${WIND_UNIT_LABEL[units.wind]}`
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
    temperature ? `${temperature}${TEMPERATURE_UNIT_LABEL[units.temperature]}` : "",
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

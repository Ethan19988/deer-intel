import type {
  LiveWeather,
  LiveWeatherDay,
  WeatherCoordinate,
} from "@/types/weather";

// Open-Meteo is free, keyless, and CORS-enabled, so we can call it straight
// from the client. It gives us current conditions, a multi-day forecast, and
// sunrise/sunset. Moon phase is not a native field, so we compute it locally.

const FORECAST_ENDPOINT = "https://api.open-meteo.com/v1/forecast";
export const OPEN_METEO_PROVIDER = "Open-Meteo";

const DEFAULT_FORECAST_DAYS = 5;

const CURRENT_FIELDS = [
  "temperature_2m",
  "relative_humidity_2m",
  "weather_code",
  "wind_speed_10m",
  "wind_direction_10m",
  "surface_pressure",
  "is_day",
].join(",");

const DAILY_FIELDS = [
  "weather_code",
  "temperature_2m_max",
  "temperature_2m_min",
  "sunrise",
  "sunset",
  "wind_speed_10m_max",
  "wind_direction_10m_dominant",
].join(",");

export class WeatherFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WeatherFetchError";
  }
}

type FetchLiveWeatherOptions = {
  coordinate: WeatherCoordinate;
  forecastDays?: number;
  signal?: AbortSignal;
};

export async function fetchLiveWeather({
  coordinate,
  forecastDays = DEFAULT_FORECAST_DAYS,
  signal,
}: FetchLiveWeatherOptions): Promise<LiveWeather> {
  const params = new URLSearchParams({
    latitude: coordinate.lat.toString(),
    longitude: coordinate.lng.toString(),
    current: CURRENT_FIELDS,
    daily: DAILY_FIELDS,
    temperature_unit: "fahrenheit",
    wind_speed_unit: "mph",
    precipitation_unit: "inch",
    timezone: "auto",
    forecast_days: forecastDays.toString(),
  });

  let response: Response;

  try {
    response = await fetch(`${FORECAST_ENDPOINT}?${params.toString()}`, {
      signal,
    });
  } catch {
    throw new WeatherFetchError(
      "Could not reach the weather service. Check your connection and try again.",
    );
  }

  if (!response.ok) {
    throw new WeatherFetchError(
      `Weather service returned an error (${response.status}).`,
    );
  }

  const data = (await response.json()) as OpenMeteoResponse;

  return mapResponse(coordinate, data);
}

type OpenMeteoResponse = {
  current?: {
    time?: string;
    temperature_2m?: number;
    relative_humidity_2m?: number;
    weather_code?: number;
    wind_speed_10m?: number;
    wind_direction_10m?: number;
    surface_pressure?: number;
    is_day?: number;
  };
  daily?: {
    time?: string[];
    weather_code?: number[];
    temperature_2m_max?: number[];
    temperature_2m_min?: number[];
    sunrise?: string[];
    sunset?: string[];
    wind_speed_10m_max?: number[];
    wind_direction_10m_dominant?: number[];
  };
};

function mapResponse(
  coordinate: WeatherCoordinate,
  data: OpenMeteoResponse,
): LiveWeather {
  const current = data.current ?? {};
  const observedAt = current.time ?? new Date().toISOString();
  const currentCode = numberValue(current.weather_code);

  return {
    coordinate,
    provider: OPEN_METEO_PROVIDER,
    fetchedAt: new Date().toISOString(),
    current: {
      temperature: numberValue(current.temperature_2m),
      conditions: describeWeatherCode(currentCode),
      weatherCode: currentCode,
      windSpeed: numberValue(current.wind_speed_10m),
      windDirection: degreesToCompass(current.wind_direction_10m),
      humidity: numberValue(current.relative_humidity_2m),
      pressure: numberValue(current.surface_pressure),
      isDay: current.is_day !== 0,
      moonPhase: moonPhaseLabel(new Date(observedAt)),
      observedAt,
    },
    forecast: mapForecast(data.daily),
  };
}

function mapForecast(daily: OpenMeteoResponse["daily"]): LiveWeatherDay[] {
  const dates = daily?.time ?? [];

  return dates.map((date, index) => {
    const code = numberValue(daily?.weather_code?.[index]);

    return {
      date,
      weatherCode: code,
      conditions: describeWeatherCode(code),
      high: numberValue(daily?.temperature_2m_max?.[index]),
      low: numberValue(daily?.temperature_2m_min?.[index]),
      windSpeed: numberValue(daily?.wind_speed_10m_max?.[index]),
      windDirection: degreesToCompass(daily?.wind_direction_10m_dominant?.[index]),
      sunrise: daily?.sunrise?.[index] ?? "",
      sunset: daily?.sunset?.[index] ?? "",
    };
  });
}

function numberValue(value: number | undefined): number {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

const COMPASS_POINTS = [
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

export function degreesToCompass(degrees: number | undefined): string {
  if (typeof degrees !== "number" || !Number.isFinite(degrees)) return "";

  const index = Math.round((((degrees % 360) + 360) % 360) / 22.5) % 16;

  return COMPASS_POINTS[index];
}

// WMO weather interpretation codes used by Open-Meteo.
const WEATHER_CODE_LABELS: Record<number, string> = {
  0: "Clear",
  1: "Mostly clear",
  2: "Partly cloudy",
  3: "Overcast",
  45: "Fog",
  48: "Rime fog",
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
  80: "Light showers",
  81: "Showers",
  82: "Heavy showers",
  85: "Snow showers",
  86: "Heavy snow showers",
  95: "Thunderstorm",
  96: "Thunderstorm w/ hail",
  99: "Severe thunderstorm",
};

export function describeWeatherCode(code: number): string {
  return WEATHER_CODE_LABELS[code] ?? "Unknown";
}

// Approximate moon phase from a known new moon (2000-01-06) and the synodic
// month. Good enough for a hunting-brief label without pulling in a library.
const SYNODIC_MONTH_DAYS = 29.53058867;
const KNOWN_NEW_MOON = Date.UTC(2000, 0, 6, 18, 14) / 86_400_000;

const MOON_PHASE_LABELS = [
  "New",
  "Waxing crescent",
  "First quarter",
  "Waxing gibbous",
  "Full",
  "Waning gibbous",
  "Last quarter",
  "Waning crescent",
];

export function moonPhaseLabel(date: Date): string {
  const days = date.getTime() / 86_400_000;
  const age = (((days - KNOWN_NEW_MOON) % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) %
    SYNODIC_MONTH_DAYS;
  const index = Math.round(age / (SYNODIC_MONTH_DAYS / 8)) % 8;

  return MOON_PHASE_LABELS[index];
}

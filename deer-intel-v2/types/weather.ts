export type WeatherSource = "manual" | "live-placeholder" | "live";

export type WeatherCoordinate = {
  lat: number;
  lng: number;
  /** How we resolved this coordinate, for UI labelling. */
  origin: "pins" | "cameras" | "gps" | "manual";
  label?: string;
};

/** A single day in the live forecast. */
export type LiveWeatherDay = {
  date: string;
  conditions: string;
  weatherCode: number;
  high: number;
  low: number;
  windSpeed: number;
  windDirection: string;
  sunrise: string;
  sunset: string;
};

/** Live current conditions pulled from a weather provider. */
export type LiveWeatherCurrent = {
  temperature: number;
  conditions: string;
  weatherCode: number;
  windSpeed: number;
  windDirection: string;
  humidity: number;
  pressure: number;
  isDay: boolean;
  moonPhase: string;
  observedAt: string;
};

export type LiveWeather = {
  coordinate: WeatherCoordinate;
  current: LiveWeatherCurrent;
  forecast: LiveWeatherDay[];
  provider: string;
  fetchedAt: string;
};

export type WeatherSnapshot = {
  temperature: string;
  windDirection: string;
  windSpeed: string;
  conditions: string;
  moonPhase: string;
  source: WeatherSource;
};

export type WeatherIntegrationStatus = {
  source: WeatherSource;
  label: string;
  description: string;
};

export type PropertyWeatherSummary = {
  value: string;
  description: string;
  recordCount: number;
  latestDateLabel: string;
  sourceLabel: string;
};

export type WeatherSource =
  | "manual"
  | "live"
  | "live-placeholder"
  | "historical"
  | "photo";

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

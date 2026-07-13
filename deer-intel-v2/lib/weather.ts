import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type {
  PropertyWeatherSummary,
  WeatherIntegrationStatus,
  WeatherSnapshot,
  WeatherSource,
} from "@/types/weather";

export const LIVE_WEATHER_PLACEHOLDER: WeatherIntegrationStatus = {
  source: "live-placeholder",
  label: "Live weather ready",
  description:
    "Manual weather is saved today. A live weather provider can use this same weather layer later.",
};

type WeatherSnapshotInput = Partial<Omit<WeatherSnapshot, "source">> & {
  source?: WeatherSource;
};

type WeatherEvent = {
  date: string;
  label: string;
  snapshot: WeatherSnapshot;
  time: number;
};

export function createWeatherSnapshot({
  temperature = "",
  windDirection = "",
  windSpeed = "",
  conditions = "",
  moonPhase = "",
  source = "manual",
}: WeatherSnapshotInput): WeatherSnapshot {
  return {
    temperature: temperature.trim(),
    windDirection: windDirection.trim(),
    windSpeed: windSpeed.trim(),
    conditions: conditions.trim(),
    moonPhase: moonPhase.trim(),
    source,
  };
}

export function normalizeWeatherSnapshot(
  value: unknown,
  fallback: WeatherSnapshotInput = {},
): WeatherSnapshot {
  if (!isRecord(value)) {
    return createWeatherSnapshot(fallback);
  }

  return createWeatherSnapshot({
    temperature: stringValue(value.temperature, fallback.temperature ?? ""),
    windDirection: stringValue(
      value.windDirection,
      fallback.windDirection ?? "",
    ),
    windSpeed: stringValue(value.windSpeed, fallback.windSpeed ?? ""),
    conditions: stringValue(
      value.conditions,
      stringValue(value.weather, fallback.conditions ?? ""),
    ),
    moonPhase: stringValue(value.moonPhase, fallback.moonPhase ?? ""),
    source: weatherSourceValue(value.source, fallback.source),
  });
}

export function hasWeatherSnapshot(snapshot: WeatherSnapshot) {
  return Boolean(
    snapshot.temperature ||
      snapshot.windDirection ||
      snapshot.windSpeed ||
      snapshot.conditions ||
      snapshot.moonPhase,
  );
}

export function weatherSnapshotDescription(snapshot: WeatherSnapshot) {
  return [
    formatWeatherTemperature(snapshot.temperature),
    formatWeatherWind(snapshot),
    snapshot.conditions,
    snapshot.moonPhase ? `${snapshot.moonPhase} moon` : "",
  ]
    .filter(Boolean)
    .join(" / ");
}

export function weatherSourceLabel(source: WeatherSource) {
  if (source === "live") return "Live weather";
  if (source === "live-placeholder") return "Future live weather";
  if (source === "historical") return "Weather history";
  if (source === "photo") return "Read from photo";

  return "Manual entry";
}

export function formatWeatherTemperature(value: string) {
  const trimmedValue = value.trim();

  if (!trimmedValue) return "";
  if (trimmedValue.toLowerCase().endsWith("f")) return trimmedValue;
  if (!Number.isNaN(Number(trimmedValue))) return `${trimmedValue} F`;

  return trimmedValue;
}

export function formatWeatherWind(
  snapshot: Pick<WeatherSnapshot, "windDirection" | "windSpeed">,
) {
  if (snapshot.windDirection && snapshot.windSpeed) {
    return `${snapshot.windDirection} at ${snapshot.windSpeed}`;
  }

  return snapshot.windDirection || snapshot.windSpeed;
}

export function getPropertyWeatherSummary({
  hunts,
  cameraChecks,
}: {
  hunts: HuntLogEntry[];
  cameraChecks: CameraCheck[];
}): PropertyWeatherSummary {
  const events = [
    ...hunts.map((hunt) => ({
      date: hunt.date,
      label: hunt.standName ? `Hunt at ${hunt.standName}` : "Hunt log",
      snapshot: hunt.weatherSnapshot,
      time: weatherEventTime(
        hunt.startTime ? `${hunt.date}T${hunt.startTime}` : hunt.date,
      ),
    })),
    ...cameraChecks.map((check) => ({
      date: check.date,
      label: "Camera check",
      snapshot: check.weatherSnapshot,
      time: weatherEventTime(check.date),
    })),
  ].filter((event): event is WeatherEvent =>
    hasWeatherSnapshot(event.snapshot),
  );

  if (events.length === 0) {
    return {
      value: "Ready for weather",
      description:
        "Add weather to hunts or camera checks, or tap Use live weather to pull current conditions automatically.",
      recordCount: 0,
      latestDateLabel: "No records yet",
      sourceLabel: LIVE_WEATHER_PLACEHOLDER.label,
    };
  }

  const latestEvent = events.sort((left, right) => right.time - left.time)[0];
  const detail =
    weatherSnapshotDescription(latestEvent.snapshot) || "Weather saved";

  return {
    value: latestEvent.snapshot.conditions || detail,
    description: `${latestEvent.label} on ${formatWeatherDate(
      latestEvent.date,
    )}: ${detail}`,
    recordCount: events.length,
    latestDateLabel: formatWeatherDate(latestEvent.date),
    sourceLabel: weatherSourceLabel(latestEvent.snapshot.source),
  };
}

function formatWeatherDate(date: string | undefined) {
  if (!date) return "No date";

  const time = weatherEventTime(date);

  if (time === 0) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function weatherEventTime(date: string | undefined) {
  if (!date) return 0;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const time = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      ).getTime()
    : Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function weatherSourceValue(
  value: unknown,
  fallback: WeatherSource | undefined,
): WeatherSource {
  if (value === "live") return "live";
  if (value === "live-placeholder") return "live-placeholder";
  if (value === "historical") return "historical";
  if (value === "photo") return "photo";
  if (value === "manual") return "manual";

  return fallback ?? "manual";
}

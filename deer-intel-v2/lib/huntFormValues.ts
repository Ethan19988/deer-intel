import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";
import type { WeatherSource } from "@/types/weather";
import { createWeatherSnapshot } from "@/lib/weather";

export type YesNoValue = "No" | "Yes";

export type HuntFormValues = {
  propertyId: string;
  standId: string;
  date: string;
  startTime: string;
  endTime: string;
  windDirection: string;
  windSpeed: string;
  temperature: string;
  weather: string;
  moonPhase: string;
  weatherSource: WeatherSource;
  bucks: string;
  does: string;
  fawns: string;
  shotOpportunity: YesNoValue;
  harvest: YesNoValue;
  notes: string;
};

export const EMPTY_HUNT_FORM_VALUES: HuntFormValues = {
  propertyId: "",
  standId: "",
  date: "",
  startTime: "",
  endTime: "",
  windDirection: "",
  windSpeed: "",
  temperature: "",
  weather: "",
  moonPhase: "",
  weatherSource: "manual",
  bucks: "",
  does: "",
  fawns: "",
  shotOpportunity: "No",
  harvest: "No",
  notes: "",
};

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

/**
 * A fresh form for logging a sit right now: today's date and the current time
 * as the start, in local time. Most sits are logged from the stand or the truck,
 * so this saves picking a date on a phone keyboard every time.
 */
export function newHuntFormValues(
  now: Date = new Date(),
  keep: Partial<Pick<HuntFormValues, "propertyId" | "standId">> = {},
): HuntFormValues {
  return {
    ...EMPTY_HUNT_FORM_VALUES,
    ...keep,
    date: `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`,
    startTime: `${padTwo(now.getHours())}:${padTwo(now.getMinutes())}`,
  };
}

type CreateHuntFromValuesInput = {
  id: string;
  values: HuntFormValues;
  stands: Stand[];
};

export function createHuntFromValues({
  id,
  values,
  stands,
}: CreateHuntFromValuesInput): HuntLogEntry | null {
  const propertyId = values.propertyId.trim();
  const standId = values.standId.trim();
  const date = values.date.trim();
  const stand = stands.find(
    (item) => item.id === standId && item.propertyId === propertyId,
  );

  if (!propertyId || !standId || !stand || !date) return null;

  return {
    id,
    propertyId,
    standId,
    standName: stand.name,
    date,
    startTime: values.startTime.trim(),
    endTime: values.endTime.trim(),
    windDirection: values.windDirection.trim(),
    windSpeed: values.windSpeed.trim(),
    temperature: values.temperature.trim(),
    weather: values.weather.trim(),
    moonPhase: values.moonPhase.trim(),
    weatherSnapshot: createWeatherSnapshot({
      temperature: values.temperature,
      windDirection: values.windDirection,
      windSpeed: values.windSpeed,
      conditions: values.weather,
      moonPhase: values.moonPhase,
      source: values.weatherSource,
    }),
    bucks: countFromString(values.bucks),
    does: countFromString(values.does),
    fawns: countFromString(values.fawns),
    shotOpportunity: values.shotOpportunity === "Yes",
    harvest: values.harvest === "Yes",
    notes: values.notes.trim(),
  };
}

function countFromString(value: string) {
  const parsedValue = Number(value.trim());

  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0;

  return Math.floor(parsedValue);
}

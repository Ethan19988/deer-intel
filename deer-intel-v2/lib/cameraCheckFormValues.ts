import type { CameraCheck } from "@/types/cameraCheck";
import type { WeatherSource } from "@/types/weather";
import { createWeatherSnapshot } from "@/lib/weather";

export type CameraCheckFormValues = {
  date: string;
  batteryPercent: string;
  sdCardPercent: string;
  signalStrength: string;
  temperature: string;
  windDirection: string;
  windSpeed: string;
  weather: string;
  moonPhase: string;
  weatherSource: WeatherSource;
  bucks: string;
  does: string;
  fawns: string;
  turkeys: string;
  bears: string;
  coyotes: string;
  otherWildlife: string;
  notes: string;
};

export const EMPTY_CAMERA_CHECK_FORM_VALUES: CameraCheckFormValues = {
  date: "",
  batteryPercent: "",
  sdCardPercent: "",
  signalStrength: "",
  temperature: "",
  windDirection: "",
  windSpeed: "",
  weather: "",
  moonPhase: "",
  weatherSource: "manual",
  bucks: "",
  does: "",
  fawns: "",
  turkeys: "",
  bears: "",
  coyotes: "",
  otherWildlife: "",
  notes: "",
};

export type CheckChoice = {
  label: string;
  /** What's stored in the check's percent field. */
  value: string;
  /** Selected state reads as a warning (low battery, full or missing card). */
  warn?: boolean;
};

// Quick-pick buckets for a check done on foot. They store plain numbers in the
// existing percent fields, so camera intelligence's "low" alerts (<= 25%) and
// the check list's "85%" display keep working. The SD card field is space
// left, so a full card is 0%.
export const BATTERY_CHOICES: readonly CheckChoice[] = [
  { label: "Full", value: "100" },
  { label: "Half", value: "50" },
  { label: "Low", value: "20", warn: true },
  { label: "Dead", value: "0", warn: true },
];

export const SD_CARD_CHOICES: readonly CheckChoice[] = [
  { label: "Fine", value: "100" },
  { label: "Full", value: "0", warn: true },
  { label: "Missing", value: "Missing", warn: true },
];

/** The quick-pick choice a stored value matches exactly ("100" or "100%"), if any. */
export function choiceForValue(
  choices: readonly CheckChoice[],
  value: string | undefined,
): CheckChoice | undefined {
  const normalized = (value ?? "").trim().replace(/%$/, "").trim();

  if (!normalized) return undefined;

  return choices.find(
    (choice) => choice.value.toLowerCase() === normalized.toLowerCase(),
  );
}

function padTwo(value: number) {
  return String(value).padStart(2, "0");
}

/** "YYYY-MM-DD" for `now` in local time (what a date input expects). */
export function localDateInput(now: Date = new Date()) {
  return `${now.getFullYear()}-${padTwo(now.getMonth() + 1)}-${padTwo(now.getDate())}`;
}

/** A fresh check dated today: most checks are logged standing at the camera. */
export function newCameraCheckFormValues(
  now: Date = new Date(),
): CameraCheckFormValues {
  return { ...EMPTY_CAMERA_CHECK_FORM_VALUES, date: localDateInput(now) };
}

/** A saved check back into form values, so the check form can edit it. */
export function checkFormValuesFromCheck(
  check: CameraCheck,
): CameraCheckFormValues {
  const countText = (value: number) => (value > 0 ? String(value) : "");
  const weather = check.weatherSnapshot;

  return {
    date: check.date,
    batteryPercent: check.batteryPercent,
    sdCardPercent: check.sdCardPercent,
    signalStrength: check.signalStrength ?? "",
    temperature: weather?.temperature ?? "",
    windDirection: weather?.windDirection ?? "",
    windSpeed: weather?.windSpeed ?? "",
    weather: weather?.conditions ?? "",
    moonPhase: weather?.moonPhase ?? "",
    weatherSource: weather?.source ?? "manual",
    bucks: countText(check.bucks),
    does: countText(check.does),
    fawns: countText(check.fawns),
    turkeys: countText(check.turkeys),
    bears: countText(check.bears),
    coyotes: countText(check.coyotes),
    otherWildlife: check.otherWildlife,
    notes: check.notes,
  };
}

export function createCameraCheckFromValues({
  id,
  propertyId,
  cameraId,
  values,
}: {
  id: string;
  propertyId: string;
  cameraId: string;
  values: CameraCheckFormValues;
}): CameraCheck | null {
  const date = values.date.trim();

  if (!date) return null;

  return {
    id,
    propertyId,
    cameraId,
    date,
    batteryPercent: values.batteryPercent.trim(),
    sdCardPercent: values.sdCardPercent.trim(),
    signalStrength: optionalTrimmedValue(values.signalStrength),
    weatherSnapshot: createWeatherSnapshot({
      temperature: values.temperature,
      windDirection: values.windDirection,
      windSpeed: values.windSpeed,
      conditions: values.weather,
      moonPhase: values.moonPhase,
      source: values.weatherSource,
    }),
    bucks: countValue(values.bucks),
    does: countValue(values.does),
    fawns: countValue(values.fawns),
    turkeys: countValue(values.turkeys),
    bears: countValue(values.bears),
    coyotes: countValue(values.coyotes),
    otherWildlife: values.otherWildlife.trim(),
    notes: values.notes.trim(),
  };
}

function countValue(value: string) {
  const trimmedValue = value.trim();
  if (!trimmedValue) return 0;

  const parsedValue = Number(trimmedValue);

  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0;

  return Math.floor(parsedValue);
}

function optionalTrimmedValue(value: string): string | undefined {
  const trimmedValue = value.trim();

  return trimmedValue ? trimmedValue : undefined;
}

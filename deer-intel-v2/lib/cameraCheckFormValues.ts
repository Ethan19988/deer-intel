import type { CameraCheck } from "@/types/cameraCheck";
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
  bucks: "",
  does: "",
  fawns: "",
  turkeys: "",
  bears: "",
  coyotes: "",
  otherWildlife: "",
  notes: "",
};

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

import type { WeatherSnapshot } from "@/types/weather";

export type CameraCheck = {
  id: string;
  propertyId: string;
  cameraId: string;
  date: string;
  batteryPercent: string;
  sdCardPercent: string;
  signalStrength?: string;
  weatherSnapshot: WeatherSnapshot;
  bucks: number;
  does: number;
  fawns: number;
  turkeys: number;
  bears: number;
  coyotes: number;
  otherWildlife: string;
  notes: string;
};

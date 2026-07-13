import type { WeatherSnapshot } from "@/types/weather";

export type PhotoRecord = {
  id: string;
  propertyId: string;
  cameraSiteId: string;
  cameraCheckId: string;
  fileName: string;
  photoDate: string;
  species: string;
  deerProfileId?: string;
  buckName?: string;
  notes: string;
  createdAt: string;
  imageId?: string;
  imageWidth?: number;
  imageHeight?: number;
  // Temp / wind / sky at the capture time plus the moon phase, looked up from
  // history when the photo is imported. Optional: older records predate it.
  weatherSnapshot?: WeatherSnapshot;
};

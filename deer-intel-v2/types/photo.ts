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
  // Compass point the animal was headed (from the AI's frame read converted
  // through the camera's facing direction, or entered by hand); unset when
  // the direction wasn't observed.
  travelDirection?: string;
  // What the animal was doing ("Traveling", "Feeding", "Chasing", ...), when known.
  behavior?: string;
  notes: string;
  createdAt: string;
  imageId?: string;
  imageWidth?: number;
  imageHeight?: number;
  // Temp / wind / sky at the capture time plus the moon phase, looked up from
  // history when the photo is imported. Optional: older records predate it.
  weatherSnapshot?: WeatherSnapshot;
};

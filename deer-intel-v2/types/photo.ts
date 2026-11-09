import type { WeatherSnapshot } from "@/types/weather";

// Where a photo's capture time came from. "stamp" = the time burned onto the
// image; "exif" = the file's DateTimeOriginal; "stampDate" = only a date was
// printed (no time); "filename" = a date (and maybe time) in the file name;
// "file" = the file's last-modified date (for a cellular cam, when the batch
// arrived — not the shutter time); "manual" = typed or confirmed by the hunter.
export type PhotoCaptureTimeSource =
  | "stamp"
  | "exif"
  | "stampDate"
  | "filename"
  | "file"
  | "manual";

// Estimated buck age class in years.
export type PhotoAgeClass = "1.5" | "2.5" | "3.5" | "4.5+";

export type PhotoRecord = {
  id: string;
  propertyId: string;
  cameraSiteId: string;
  cameraCheckId: string;
  fileName: string;
  // "YYYY-MM-DDTHH:mm" when a real capture time is known, otherwise a bare
  // "YYYY-MM-DD" — a missing time is never filled with a made-up one.
  photoDate: string;
  // How photoDate was obtained; unset on records saved before it existed.
  captureTimeSource?: PhotoCaptureTimeSource;
  // "Buck", "Doe", "No animal" (false trigger), ... — see lib/photoOptions.
  species: string;
  // A photo can show more than one buck, so links are stored as lists. The
  // singular `deerProfileId` / `buckName` are kept as the "primary" (first)
  // link for backward compatibility with older records and existing reads;
  // `deerProfileIds` / `buckNames` hold the full set. Use the helpers in
  // `lib/photos` (getPhotoDeerProfileIds / getPhotoBuckNames) to read either.
  deerProfileId?: string;
  buckName?: string;
  deerProfileIds?: string[];
  buckNames?: string[];
  // Compass point the animal was headed (from the AI's frame read converted
  // through the camera's facing direction, or entered by hand); unset when
  // the direction wasn't observed.
  travelDirection?: string;
  // The AI's raw read of how the animal crossed the frame ("Left to right",
  // "Toward camera", ...). Kept so travelDirection can be recomputed when the
  // photo moves to another camera or the camera's facing is corrected.
  frameDirection?: string;
  // What the animal was doing ("Traveling", "Feeding", "Chasing", ...), when known.
  behavior?: string;
  // How many deer are in the frame (4 means "4 or more"); unset = not counted.
  deerCount?: number;
  // Buck only: estimated age class and total antler points, when judged.
  ageClass?: PhotoAgeClass;
  antlerPoints?: number;
  notes: string;
  createdAt: string;
  imageId?: string;
  imageWidth?: number;
  imageHeight?: number;
  // Temp / wind / sky at the capture time plus the moon phase, looked up from
  // history when the photo is imported. Optional: older records predate it.
  weatherSnapshot?: WeatherSnapshot;
};

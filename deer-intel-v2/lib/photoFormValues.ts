import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

export type PhotoFormValues = {
  cameraCheckId: string;
  deerProfileId: string;
  fileName: string;
  photoDate: string;
  species: string;
  buckName: string;
  travelDirection: string;
  behavior: string;
  notes: string;
  imageId: string;
  imageWidth: number;
  imageHeight: number;
  // Values read off the photo's printed info bar (carried to the weather
  // snapshot when the record is saved); "" when nothing was read.
  stampedTemperature: string;
  stampedMoonPhase: string;
  stampedWindDirection: string;
  stampedWindSpeed: string;
  stampedHumidity: string;
};

export const EMPTY_PHOTO_FORM_VALUES: PhotoFormValues = {
  cameraCheckId: "",
  deerProfileId: "",
  fileName: "",
  photoDate: "",
  species: "",
  buckName: "",
  travelDirection: "",
  behavior: "",
  notes: "",
  imageId: "",
  imageWidth: 0,
  imageHeight: 0,
  stampedTemperature: "",
  stampedMoonPhase: "",
  stampedWindDirection: "",
  stampedWindSpeed: "",
  stampedHumidity: "",
};

/** A fresh photo form that starts on today's date (adding a photo overrides it). */
export function emptyPhotoFormValues(): PhotoFormValues {
  return { ...EMPTY_PHOTO_FORM_VALUES, photoDate: todayDateInput() };
}

function todayDateInput(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, "0");
  const day = String(now.getDate()).padStart(2, "0");

  return `${year}-${month}-${day}`;
}

type CreatePhotoRecordFromValuesInput = {
  id: string;
  propertyId: string;
  cameraSiteId: string;
  values: PhotoFormValues;
  cameraChecks: CameraCheck[];
};

export function createPhotoRecordFromValues({
  id,
  propertyId,
  cameraSiteId,
  values,
  cameraChecks,
}: CreatePhotoRecordFromValuesInput): PhotoRecord | null {
  const rawCheckId = values.cameraCheckId.trim();
  const photoDate = values.photoDate.trim();
  const species = values.species.trim();
  const imageId = values.imageId.trim();
  // A label is optional once a real photo is attached; fall back to a sensible
  // default so every record still has something to show in lists.
  const fileName = values.fileName.trim() || (imageId ? "Uploaded photo" : "");
  // The camera check is optional. Keep it only when a real check for this camera
  // is chosen; otherwise the photo attaches directly to the camera site.
  const checkBelongsToCamera =
    rawCheckId !== "" &&
    cameraChecks.some(
      (check) =>
        check.id === rawCheckId &&
        check.propertyId === propertyId &&
        check.cameraId === cameraSiteId,
    );
  const cameraCheckId = checkBelongsToCamera ? rawCheckId : "";

  if (!propertyId || !cameraSiteId || !fileName || !photoDate || !species) {
    return null;
  }

  return {
    id,
    propertyId,
    cameraSiteId,
    cameraCheckId,
    fileName,
    photoDate,
    species,
    deerProfileId: values.deerProfileId.trim() || undefined,
    buckName: values.buckName.trim() || undefined,
    travelDirection: values.travelDirection.trim() || undefined,
    behavior: values.behavior.trim() || undefined,
    notes: values.notes.trim(),
    createdAt: new Date().toISOString(),
    imageId: imageId || undefined,
    imageWidth: imageId && values.imageWidth > 0 ? values.imageWidth : undefined,
    imageHeight:
      imageId && values.imageHeight > 0 ? values.imageHeight : undefined,
  };
}

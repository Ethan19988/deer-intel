import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

export type PhotoFormValues = {
  cameraCheckId: string;
  deerProfileId: string;
  fileName: string;
  photoDate: string;
  species: string;
  buckName: string;
  notes: string;
  imageId: string;
  imageWidth: number;
  imageHeight: number;
};

export const EMPTY_PHOTO_FORM_VALUES: PhotoFormValues = {
  cameraCheckId: "",
  deerProfileId: "",
  fileName: "",
  photoDate: "",
  species: "",
  buckName: "",
  notes: "",
  imageId: "",
  imageWidth: 0,
  imageHeight: 0,
};

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
  const cameraCheckId = values.cameraCheckId.trim();
  const photoDate = values.photoDate.trim();
  const species = values.species.trim();
  const imageId = values.imageId.trim();
  // A label is optional once a real photo is attached; fall back to a sensible
  // default so every record still has something to show in lists.
  const fileName = values.fileName.trim() || (imageId ? "Uploaded photo" : "");
  const checkBelongsToCamera = cameraChecks.some(
    (check) =>
      check.id === cameraCheckId &&
      check.propertyId === propertyId &&
      check.cameraId === cameraSiteId,
  );

  if (
    !propertyId ||
    !cameraSiteId ||
    !cameraCheckId ||
    !checkBelongsToCamera ||
    !fileName ||
    !photoDate ||
    !species
  ) {
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
    notes: values.notes.trim(),
    createdAt: new Date().toISOString(),
    imageId: imageId || undefined,
    imageWidth: imageId && values.imageWidth > 0 ? values.imageWidth : undefined,
    imageHeight:
      imageId && values.imageHeight > 0 ? values.imageHeight : undefined,
  };
}

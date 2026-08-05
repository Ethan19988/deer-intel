import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

export type PhotoFormValues = {
  cameraCheckId: string;
  // A photo can show more than one buck: linked deer profiles plus loose
  // buck names (typed in without a saved profile).
  deerProfileIds: string[];
  fileName: string;
  photoDate: string;
  species: string;
  buckNames: string[];
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
  deerProfileIds: [],
  fileName: "",
  photoDate: "",
  species: "",
  buckNames: [],
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

/**
 * Turn the form's selected profile ids + loose typed names into the record's
 * `deerProfileIds` (valid, deduped) and `buckNames` (each linked profile's
 * nickname plus the loose names, deduped case-insensitively).
 */
export function resolveBuckLinks(
  values: Pick<PhotoFormValues, "deerProfileIds" | "buckNames">,
  deerProfiles: DeerProfile[],
): { deerProfileIds: string[]; buckNames: string[] } {
  const profileById = new Map(
    deerProfiles.map((profile) => [profile.id, profile]),
  );
  const deerProfileIds = [
    ...new Set(values.deerProfileIds.map((id) => id.trim()).filter(Boolean)),
  ].filter((id) => profileById.has(id));

  const names = [
    ...deerProfileIds.map((id) => profileById.get(id)?.nickname ?? ""),
    ...values.buckNames,
  ]
    .map((name) => name.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const buckNames: string[] = [];

  for (const name of names) {
    const key = name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    buckNames.push(name);
  }

  return { deerProfileIds, buckNames };
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
  // Used to turn the selected profile ids into their nicknames for buckNames.
  deerProfiles?: DeerProfile[];
};

export function createPhotoRecordFromValues({
  id,
  propertyId,
  cameraSiteId,
  values,
  cameraChecks,
  deerProfiles = [],
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

  const { deerProfileIds, buckNames } = resolveBuckLinks(values, deerProfiles);

  return {
    id,
    propertyId,
    cameraSiteId,
    cameraCheckId,
    fileName,
    photoDate,
    species,
    // Singular fields stay populated with the primary (first) link so existing
    // reads keep working; the plural fields carry the full set.
    deerProfileId: deerProfileIds[0],
    buckName: buckNames[0],
    deerProfileIds: deerProfileIds.length > 0 ? deerProfileIds : undefined,
    buckNames: buckNames.length > 0 ? buckNames : undefined,
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

import { toDateInputValue } from "@/lib/photoDateTime";
import { buckOnlyFields, deerCountFor } from "@/lib/photoOptions";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type {
  PhotoAgeClass,
  PhotoCaptureTimeSource,
  PhotoRecord,
} from "@/types/photo";

export type PhotoFormValues = {
  cameraCheckId: string;
  // A photo can show more than one buck: linked deer profiles plus loose
  // buck names (typed in without a saved profile).
  deerProfileIds: string[];
  fileName: string;
  // "YYYY-MM-DDTHH:mm" when the time is known, else a bare "YYYY-MM-DD".
  photoDate: string;
  // Where photoDate came from; "" before anything set it.
  captureTimeSource: PhotoCaptureTimeSource | "";
  species: string;
  buckNames: string[];
  travelDirection: string;
  // The AI's raw frame read ("Left to right", ...), kept so the heading can
  // be recomputed if the camera's facing changes.
  frameDirection: string;
  behavior: string;
  deerCount?: number;
  ageClass: PhotoAgeClass | "";
  antlerPoints?: number;
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
  captureTimeSource: "",
  species: "",
  buckNames: [],
  travelDirection: "",
  frameDirection: "",
  behavior: "",
  deerCount: undefined,
  ageClass: "",
  antlerPoints: undefined,
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

/**
 * A fresh photo form that starts on today's date with no time: the clock time
 * the form happened to be opened at is not a capture time, so it is never
 * pre-filled. Adding a photo replaces the date with the photo's own reading.
 */
export function emptyPhotoFormValues(now: Date = new Date()): PhotoFormValues {
  return {
    ...EMPTY_PHOTO_FORM_VALUES,
    photoDate: toDateInputValue(now),
    captureTimeSource: "manual",
  };
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
    captureTimeSource: values.captureTimeSource || undefined,
    species,
    // Singular fields stay populated with the primary (first) link so existing
    // reads keep working; the plural fields carry the full set.
    deerProfileId: deerProfileIds[0],
    buckName: buckNames[0],
    deerProfileIds: deerProfileIds.length > 0 ? deerProfileIds : undefined,
    buckNames: buckNames.length > 0 ? buckNames : undefined,
    travelDirection: values.travelDirection.trim() || undefined,
    frameDirection: values.frameDirection.trim() || undefined,
    behavior: values.behavior.trim() || undefined,
    deerCount: deerCountFor(species, values.deerCount),
    ...buckOnlyFields(species, values.ageClass, values.antlerPoints),
    notes: values.notes.trim(),
    createdAt: new Date().toISOString(),
    imageId: imageId || undefined,
    imageWidth: imageId && values.imageWidth > 0 ? values.imageWidth : undefined,
    imageHeight:
      imageId && values.imageHeight > 0 ? values.imageHeight : undefined,
  };
}

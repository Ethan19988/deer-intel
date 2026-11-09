import type {
  PhotoAgeClass,
  PhotoCaptureTimeSource,
  PhotoRecord,
} from "@/types/photo";
import type { PhotoStamp } from "@/types/photoStamp";

// The one list of photo choices shared by the import inbox, the single-photo
// form, the saved-photo editor, and the AI vision tool's enums — so what the
// AI may report is always something the forms can show.

/** "No animal" marks a false trigger (wind, sun, branches) — never a deer. */
export const NO_ANIMAL = "No animal";

export const SPECIES_OPTIONS = [
  "Buck",
  "Doe",
  "Fawn",
  "Turkey",
  "Bear",
  "Coyote",
  "Human",
  "Other",
  NO_ANIMAL,
] as const;

export const BEHAVIOR_OPTIONS = [
  "Traveling",
  "Feeding",
  "Chasing",
  "At scrape or rub",
  "Bedded",
  "Alert",
  "Other",
] as const;

export const AGE_CLASS_OPTIONS: readonly PhotoAgeClass[] = [
  "1.5",
  "2.5",
  "3.5",
  "4.5+",
];

/** Deer-count chips; the last one means "this many or more". */
export const DEER_COUNT_OPTIONS = [1, 2, 3, 4] as const;
export const MAX_DEER_COUNT_CHIP = 4;

const CAPTURE_TIME_SOURCES: readonly PhotoCaptureTimeSource[] = [
  "stamp",
  "exif",
  "stampDate",
  "filename",
  "file",
  "manual",
];

/**
 * Sources whose clock reading is not the shutter time: a file's modified date
 * (a cellular batch's arrival) or a date-only stamp. Records from these never
 * feed time-of-day stats even if a time somehow rides along.
 */
const UNTRUSTED_TIME_SOURCES: readonly PhotoCaptureTimeSource[] = [
  "file",
  "stampDate",
];

/** The AI's full read: the printed stamp plus the extra animal details. */
export type PhotoStampRead = PhotoStamp & {
  // Deer in the frame; 0 when none / not counted.
  deerCount: number;
  // Buck age class, "" when not judged.
  ageClass: PhotoAgeClass | "";
  // Total antler points, 0 when not clearly countable.
  antlerPoints: number;
};

const DEER_SPECIES = /\b(buck|doe|fawn|deer)\b/i;

/** A species label that names a deer (allow-list, not "anything but X"). */
export function isDeerSpecies(species: string | undefined): boolean {
  return DEER_SPECIES.test(species ?? "");
}

export function isCaptureTimeSource(
  value: unknown,
): value is PhotoCaptureTimeSource {
  return (
    typeof value === "string" &&
    (CAPTURE_TIME_SOURCES as readonly string[]).includes(value)
  );
}

export function isUntrustedTimeSource(
  source: PhotoCaptureTimeSource | undefined,
): boolean {
  return Boolean(source && UNTRUSTED_TIME_SOURCES.includes(source));
}

export function isAgeClass(value: unknown): value is PhotoAgeClass {
  return (
    typeof value === "string" &&
    (AGE_CLASS_OPTIONS as readonly string[]).includes(value)
  );
}

/** Age class as years (4.5+ reads as 4.5). */
export function ageClassYears(ageClass: PhotoAgeClass): number {
  return Number.parseFloat(ageClass);
}

/** Whole number in [min, max], else undefined. Accepts numeric strings. */
function boundedInteger(
  value: unknown,
  min: number,
  max: number,
): number | undefined {
  const parsed =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : Number.NaN;

  if (!Number.isInteger(parsed) || parsed < min || parsed > max) {
    return undefined;
  }

  return parsed;
}

/** A sane deer count (1–50), else undefined. */
export function cleanDeerCount(value: unknown): number | undefined {
  return boundedInteger(value, 1, 50);
}

/** A sane antler point total (1–40), else undefined. */
export function cleanAntlerPoints(value: unknown): number | undefined {
  return boundedInteger(value, 1, 40);
}

/** Deer represented by one photo when counting activity (unset counts as 1). */
export function photoDeerCount(photo: Pick<PhotoRecord, "deerCount">): number {
  return cleanDeerCount(photo.deerCount) ?? 1;
}

/**
 * The buck-only fields are kept only while the species is Buck, so switching a
 * draft to "Doe" can't leave a stale age or point count on the record.
 */
export function buckOnlyFields(
  species: string,
  ageClass: PhotoAgeClass | "" | undefined,
  antlerPoints: number | undefined,
): Pick<PhotoRecord, "ageClass" | "antlerPoints"> {
  if (species !== "Buck") return { ageClass: undefined, antlerPoints: undefined };

  return {
    ageClass: isAgeClass(ageClass) ? ageClass : undefined,
    antlerPoints: cleanAntlerPoints(antlerPoints),
  };
}

/** Only deer photos carry a deer count ("No animal", turkeys, ... don't). */
export function speciesAllowsDeerCount(species: string): boolean {
  return isDeerSpecies(species);
}

/** The deer count to save for a species: dropped for non-deer photos. */
export function deerCountFor(
  species: string,
  deerCount: number | undefined,
): number | undefined {
  return speciesAllowsDeerCount(species) ? cleanDeerCount(deerCount) : undefined;
}

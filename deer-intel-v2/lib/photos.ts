import type { PhotoRecord } from "@/types/photo";

export type PhotoSummary = {
  totalPhotoRecords: number;
  buckPhotoRecords: number;
  mostRecentPhotoDate: string;
};

export function sortPhotoRecordsChronologically(photoRecords: PhotoRecord[]) {
  return [...photoRecords].sort(
    (left, right) => photoTime(left) - photoTime(right),
  );
}

export function getPhotoSummary(photoRecords: PhotoRecord[]): PhotoSummary {
  const chronologicalPhotos = sortPhotoRecordsChronologically(photoRecords);
  const mostRecentPhoto = chronologicalPhotos.at(-1);

  return {
    totalPhotoRecords: photoRecords.length,
    buckPhotoRecords: photoRecords.filter(isBuckPhoto).length,
    mostRecentPhotoDate: formatPhotoDate(mostRecentPhoto?.photoDate),
  };
}

export function getPhotoRecordsForCheck(
  photoRecords: PhotoRecord[],
  cameraCheckId: string,
) {
  return sortPhotoRecordsChronologically(
    photoRecords.filter((photo) => photo.cameraCheckId === cameraCheckId),
  );
}

export function formatPhotoDate(date: string | undefined) {
  if (!date) return "No photos yet";

  const time = dateInputTime(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function isBuckPhoto(photo: PhotoRecord) {
  return (
    photo.species.trim().toLowerCase().includes("buck") ||
    getPhotoBuckNames(photo).length > 0
  );
}

/**
 * All deer-profile ids linked to a photo, merging the plural `deerProfileIds`
 * with the legacy singular `deerProfileId`, deduped and with empties dropped.
 */
export function getPhotoDeerProfileIds(photo: PhotoRecord): string[] {
  const ids = [
    ...(photo.deerProfileIds ?? []),
    ...(photo.deerProfileId ? [photo.deerProfileId] : []),
  ]
    .map((id) => id.trim())
    .filter(Boolean);

  return [...new Set(ids)];
}

/**
 * All buck names on a photo, merging the plural `buckNames` with the legacy
 * singular `buckName`. Deduped case-insensitively, keeping the first spelling.
 */
export function getPhotoBuckNames(photo: PhotoRecord): string[] {
  const names = [
    ...(photo.buckNames ?? []),
    ...(photo.buckName ? [photo.buckName] : []),
  ]
    .map((name) => name.trim())
    .filter(Boolean);

  const seen = new Set<string>();
  const unique: string[] = [];

  for (const name of names) {
    const key = name.toLowerCase();

    if (seen.has(key)) continue;

    seen.add(key);
    unique.push(name);
  }

  return unique;
}

/** Whether a photo is linked to the given deer profile (any of its links). */
export function photoLinksProfile(
  photo: PhotoRecord,
  profileId: string,
): boolean {
  return getPhotoDeerProfileIds(photo).includes(profileId);
}

/** Epoch time of a photo's capture date, 0 when unparseable. */
export function photoRecordTime(photo: PhotoRecord) {
  const time = dateInputTime(photo.photoDate);

  return Number.isNaN(time) ? 0 : time;
}

function photoTime(photo: PhotoRecord) {
  return photoRecordTime(photo);
}

function dateInputTime(date: string | undefined) {
  if (!date) return Number.NaN;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!dateOnlyMatch) return Date.parse(date);

  const [, year, month, day] = dateOnlyMatch;

  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

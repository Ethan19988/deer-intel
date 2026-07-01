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
    Boolean(photo.buckName?.trim())
  );
}

function photoTime(photo: PhotoRecord) {
  const time = dateInputTime(photo.photoDate);

  return Number.isNaN(time) ? 0 : time;
}

function dateInputTime(date: string | undefined) {
  if (!date) return Number.NaN;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!dateOnlyMatch) return Date.parse(date);

  const [, year, month, day] = dateOnlyMatch;

  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

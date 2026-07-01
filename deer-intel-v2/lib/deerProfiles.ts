import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";

export type DeerProfileSummary = {
  profile: DeerProfile;
  firstSeen: string;
  lastSeen: string;
  photoCount: number;
  sightingCount: number;
};

export function getDeerProfileSummaries({
  profiles,
  photoRecords,
}: {
  profiles: DeerProfile[];
  photoRecords: PhotoRecord[];
}): DeerProfileSummary[] {
  return profiles
    .map((profile) => {
      const profilePhotos = photoRecords.filter(
        (photo) => photo.deerProfileId === profile.id,
      );
      const sightingKeys = new Set(
        profilePhotos.map((photo) => photo.cameraCheckId || photo.photoDate),
      );

      return {
        profile,
        firstSeen: profile.firstSeen
          ? formatDeerProfileDate(profile.firstSeen)
          : formatDeerProfileDate(earliestPhotoDate(profilePhotos)),
        lastSeen: profile.lastSeen
          ? formatDeerProfileDate(profile.lastSeen)
          : formatDeerProfileDate(latestPhotoDate(profilePhotos)),
        photoCount: profilePhotos.length,
        sightingCount: sightingKeys.size,
      };
    })
    .sort((left, right) =>
      left.profile.nickname.localeCompare(right.profile.nickname),
    );
}

export function formatDeerProfileDate(date: string | undefined) {
  if (!date) return "Not set";

  const time = dateInputTime(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function earliestPhotoDate(photoRecords: PhotoRecord[]) {
  return sortedPhotoDates(photoRecords).at(0);
}

function latestPhotoDate(photoRecords: PhotoRecord[]) {
  return sortedPhotoDates(photoRecords).at(-1);
}

function sortedPhotoDates(photoRecords: PhotoRecord[]) {
  return photoRecords
    .map((photo) => photo.photoDate)
    .filter(Boolean)
    .sort((left, right) => dateInputTime(left) - dateInputTime(right));
}

function dateInputTime(date: string | undefined) {
  if (!date) return Number.NaN;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (!dateOnlyMatch) return Date.parse(date);

  const [, year, month, day] = dateOnlyMatch;

  return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
}

import type { DeerProfile } from "@/types/deerProfile";
import type { PhotoRecord } from "@/types/photo";
import { photoLinksProfile } from "@/lib/photos";

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
      const profilePhotos = photoRecords.filter((photo) =>
        photoLinksProfile(photo, profile.id),
      );
      const sightingKeys = new Set(
        profilePhotos.map((photo) => photo.cameraCheckId || photo.photoDate),
      );

      // First/last seen span both what you typed and what your linked photos
      // show. Take the earliest of (manual first seen, oldest photo) and the
      // latest of (manual last seen, newest photo) so adding a newer photo
      // pushes "Last Seen" forward instead of being hidden by an older date
      // typed when the profile was created.
      return {
        profile,
        firstSeen: formatDeerProfileDate(
          earlierDate(profile.firstSeen, earliestPhotoDate(profilePhotos)),
        ),
        lastSeen: formatDeerProfileDate(
          laterDate(profile.lastSeen, latestPhotoDate(profilePhotos)),
        ),
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

/** The earlier of two dates; ignores empty/unparseable values. */
function earlierDate(left?: string, right?: string): string | undefined {
  return pickDate(left, right, (a, b) => a <= b);
}

/** The later of two dates; ignores empty/unparseable values. */
function laterDate(left?: string, right?: string): string | undefined {
  return pickDate(left, right, (a, b) => a >= b);
}

function pickDate(
  left: string | undefined,
  right: string | undefined,
  keepLeft: (leftTime: number, rightTime: number) => boolean,
): string | undefined {
  const leftTime = left ? dateInputTime(left) : Number.NaN;
  const rightTime = right ? dateInputTime(right) : Number.NaN;
  const leftValid = !Number.isNaN(leftTime);
  const rightValid = !Number.isNaN(rightTime);

  if (leftValid && rightValid) return keepLeft(leftTime, rightTime) ? left : right;
  if (leftValid) return left;
  if (rightValid) return right;

  // Neither parses to a real date — keep a manually typed value if there is one.
  return left || right || undefined;
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

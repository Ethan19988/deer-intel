import { getPhotoBuckNames, photoRecordTime } from "@/lib/photos";
import type { PhotoRecord } from "@/types/photo";

// When deer actually show up on this property's cameras, by hour of day. Built
// only from the hunter's own photos, so it answers "when should I be in the
// stand here" with real local evidence rather than a generic model.

export type HourlyActivity = {
  /** Deer photos per hour of day, index 0 = midnight hour. */
  counts: number[];
  /** Of those, photos showing a buck. */
  bucks: number[];
  total: number;
  /** Start hour of the busiest 2-hour window, or null with too little data. */
  peakStartHour: number | null;
  windowDays: number;
};

export const ACTIVITY_WINDOW_DAYS = 45;
// Fewer photos than this and a "peak" is noise, so none is claimed.
const MIN_PHOTOS_FOR_PEAK = 6;

const NOT_DEER = /\b(bear|turkey|coyote|raccoon|squirrel|fox|bobcat|human|person|vehicle|bird)\b/i;

/** Only records that carry a real capture time (not just a date) count. */
function hasTimeOfDay(photo: PhotoRecord): boolean {
  return /T?\d{1,2}:\d{2}/.test(photo.photoDate.slice(10));
}

/** A deer photo with a real capture time: the unit every timing chart counts. */
export function isTimedDeerPhoto(photo: PhotoRecord): boolean {
  return hasTimeOfDay(photo) && !NOT_DEER.test(photo.species);
}

export function isBuckRecord(photo: PhotoRecord): boolean {
  return getPhotoBuckNames(photo).length > 0 || /buck|antler/i.test(photo.species);
}

export function buildHourlyActivity(
  photos: PhotoRecord[],
  now: Date,
  windowDays: number = ACTIVITY_WINDOW_DAYS,
): HourlyActivity {
  const counts = new Array(24).fill(0);
  const bucks = new Array(24).fill(0);
  const since = now.getTime() - windowDays * 86_400_000;
  let total = 0;

  for (const photo of photos) {
    if (!isTimedDeerPhoto(photo)) continue;
    const time = photoRecordTime(photo);
    if (!time || time < since || time > now.getTime()) continue;

    const hour = new Date(time).getHours();
    counts[hour] += 1;
    if (isBuckRecord(photo)) bucks[hour] += 1;
    total += 1;
  }

  let peakStartHour: number | null = null;
  if (total >= MIN_PHOTOS_FOR_PEAK) {
    let best = -1;
    for (let hour = 0; hour < 24; hour += 1) {
      const pair = counts[hour] + counts[(hour + 1) % 24];
      if (pair > best) {
        best = pair;
        peakStartHour = hour;
      }
    }
  }

  return { counts, bucks, total, peakStartHour, windowDays };
}

export function hourLabel(hour: number): string {
  const h = ((hour % 24) + 24) % 24;
  const suffix = h < 12 ? "AM" : "PM";
  const twelve = h % 12 === 0 ? 12 : h % 12;
  return `${twelve} ${suffix}`;
}

// One buck's history at a glance: when he was first and last seen, how often
// on camera vs. from the stand, which cameras he shows up on, and his usual
// time window. Built from photos linked to his profile id and sits tagged with
// him — the same explicit links the travel learning uses.

import { formatDeerProfileDate } from "@/lib/deerProfiles";
import { dateInputTime, photoLinksProfile } from "@/lib/photos";
import type { Camera } from "@/types/camera";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";

export type DeerTimelineCamera = {
  cameraId: string;
  name: string;
  count: number;
  /** "Oct 28, 2026", or "" when none of his photos there have a date. */
  lastSeen: string;
};

export type DeerTimeWindow = {
  /** "Morning", "Midday", "Evening" or "Night". */
  label: string;
  /** "5–10 AM" */
  hours: string;
  count: number;
  /** Sightings that had a clock time (photos with a time, sits with an In). */
  sampleSize: number;
};

export type DeerProfileTimeline = {
  /** Formatted dates; "" when there's nothing to go on. */
  firstSeen: string;
  lastSeen: string;
  cameraHits: number;
  sitSightings: number;
  /** Most hits first. */
  cameras: DeerTimelineCamera[];
  timeWindow: DeerTimeWindow | null;
};

// Same daybreaks as lib/deerTravelIntelligence and the profile time pattern.
const WINDOWS: { label: string; hours: string; test: (hour: number) => boolean }[] = [
  { label: "Morning", hours: "5–10 AM", test: (hour) => hour >= 5 && hour <= 10 },
  { label: "Midday", hours: "11 AM–2 PM", test: (hour) => hour >= 11 && hour <= 14 },
  { label: "Evening", hours: "3–8 PM", test: (hour) => hour >= 15 && hour <= 20 },
  { label: "Night", hours: "9 PM–4 AM", test: () => true },
];

export function getDeerProfileTimeline({
  profile,
  photoRecords,
  hunts,
  cameras,
}: {
  profile: DeerProfile;
  photoRecords: PhotoRecord[];
  hunts: HuntLogEntry[];
  cameras: Camera[];
}): DeerProfileTimeline {
  const photos = photoRecords.filter((photo) => photoLinksProfile(photo, profile.id));
  const sits = hunts.filter((hunt) => hunt.deerProfileIds?.includes(profile.id));

  const times = [
    profile.firstSeen,
    profile.lastSeen,
    ...photos.map((photo) => photo.photoDate),
    ...sits.map((hunt) => hunt.date),
  ]
    .map((date) => ({ date, time: dateInputTime(date?.trim()) }))
    .filter((entry) => !Number.isNaN(entry.time))
    .sort((left, right) => left.time - right.time);

  return {
    firstSeen: times.length > 0 ? formatDeerProfileDate(times[0].date) : "",
    lastSeen: times.length > 0 ? formatDeerProfileDate(times.at(-1)?.date) : "",
    cameraHits: photos.length,
    sitSightings: sits.length,
    cameras: cameraCounts(photos, cameras),
    timeWindow: commonTimeWindow([
      ...photos.map((photo) => clockHour(photo.photoDate)),
      ...sits.map((hunt) => clockHour(hunt.startTime)),
    ]),
  };
}

function cameraCounts(photos: PhotoRecord[], cameras: Camera[]): DeerTimelineCamera[] {
  const nameById = new Map(cameras.map((camera) => [camera.id, camera.name]));
  const byCamera = new Map<string, { count: number; latest: number; latestDate: string }>();

  for (const photo of photos) {
    const id = photo.cameraSiteId;

    if (!id) continue;

    const entry = byCamera.get(id) ?? { count: 0, latest: Number.NaN, latestDate: "" };
    const time = dateInputTime(photo.photoDate);

    entry.count += 1;

    if (!Number.isNaN(time) && !(time <= entry.latest)) {
      entry.latest = time;
      entry.latestDate = photo.photoDate;
    }

    byCamera.set(id, entry);
  }

  return [...byCamera.entries()]
    .map(([cameraId, entry]) => ({
      cameraId,
      name: nameById.get(cameraId)?.trim() || "Removed camera",
      count: entry.count,
      lastSeen: entry.latestDate ? formatDeerProfileDate(entry.latestDate) : "",
      latest: Number.isNaN(entry.latest) ? 0 : entry.latest,
    }))
    .sort(
      (left, right) =>
        right.count - left.count ||
        right.latest - left.latest ||
        left.name.localeCompare(right.name),
    )
    .map(({ latest: _latest, ...camera }) => {
      void _latest;
      return camera;
    });
}

function commonTimeWindow(hours: (number | null)[]): DeerTimeWindow | null {
  const timed = hours.filter((hour): hour is number => hour !== null);

  if (timed.length === 0) return null;

  const counts = WINDOWS.map((window) => ({ window, count: 0 }));

  for (const hour of timed) {
    const slot = counts.find(({ window }) => window.test(hour));

    if (slot) slot.count += 1;
  }

  // Ties go to the earlier window in the day's order.
  const top = counts.reduce((best, slot) => (slot.count > best.count ? slot : best));

  return {
    label: top.window.label,
    hours: top.window.hours,
    count: top.count,
    sampleSize: timed.length,
  };
}

/** Hour from "YYYY-MM-DDTHH:MM" or "HH:MM"; null when there's no clock time. */
function clockHour(value: string | undefined): number | null {
  const match = /(?:^|T)(\d{2}):(\d{2})/.exec(value?.trim() ?? "");

  if (!match) return null;

  const hour = Number(match[1]);

  return hour >= 0 && hour <= 23 ? hour : null;
}

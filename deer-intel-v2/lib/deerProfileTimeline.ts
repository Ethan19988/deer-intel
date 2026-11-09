// One buck's history at a glance: when he was first and last seen, how often
// on camera vs. from the stand, which cameras he shows up on, and his usual
// time window. Built from photos linked to his profile id and sits tagged with
// him — the same explicit links the travel learning uses.

import { formatDeerProfileDate } from "@/lib/deerProfiles";
import { trustedPhotoDate } from "@/lib/photoDateTime";
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
  /** The next busiest window, for "no single time" wording. */
  runnerUpLabel?: string;
  runnerUpCount?: number;
  /**
   * True when one window clearly leads: at least 40% of timed sightings and
   * ahead of the next window by more than one sighting. Otherwise the buck
   * isn't "usually" anything yet.
   */
  clear?: boolean;
};

/** A window that clearly leads (see DeerTimeWindow.clear). */
export function isClearTimeWindow(window: DeerTimeWindow | null): boolean {
  return Boolean(window && window.clear !== false && window.sampleSize >= MIN_TIMED_FOR_PATTERN);
}

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
      // Only trusted capture times (not file-copy or date-only stamps).
      ...photos.map((photo) => clockHour(trustedPhotoDate(photo))),
      ...sits.map((hunt) => clockHour(hunt.startTime)),
    ]),
  };
}

/** Timed sightings needed before a buck's time window is called a pattern. */
export const MIN_TIMED_FOR_PATTERN = 2;

export type DeerTimeWindowText = {
  /** The one-line timeline summary. */
  line: string;
  /** "When He Moves" title and detail. */
  title: string;
  detail: string;
};

/**
 * Wording for a buck's time window, shared by the timeline line and the
 * Travel section's "When He Moves" so the two never disagree. Both read the
 * same sightings (timed photos plus tagged sits), and neither claims "usually"
 * until there are MIN_TIMED_FOR_PATTERN timed sightings.
 */
export function describeDeerTimeWindow(
  window: DeerTimeWindow | null,
): DeerTimeWindowText | null {
  if (!window) return null;

  const when = `${window.label.toLowerCase()} (${window.hours})`;

  if (window.sampleSize < MIN_TIMED_FOR_PATTERN) {
    return {
      line: `${window.sampleSize} timed sighting so far: ${when}`,
      title: "No time pattern yet",
      detail: `Only ${window.sampleSize} timed sighting so far (${when}); a pattern needs at least ${MIN_TIMED_FOR_PATTERN}.`,
    };
  }

  if (window.clear === false) {
    const other = (window.runnerUpLabel ?? "").toLowerCase();
    const both = other ? `${window.label.toLowerCase()} and ${other}` : window.label.toLowerCase();
    return {
      line: `No single time yet · ${both} (${window.count} and ${window.runnerUpCount ?? 0} of ${window.sampleSize} timed)`,
      title: "No single time yet",
      detail: `Seen in the ${both} about equally (${window.count} and ${window.runnerUpCount ?? 0} of ${window.sampleSize} timed sightings).`,
    };
  }

  return {
    line: `Usually ${when} · ${window.count} of ${window.sampleSize} timed`,
    title: `Usually ${when}`,
    detail: `${window.count} of ${window.sampleSize} timed sightings, from trail-cam photos and sits you tagged him on.`,
  };
}

/** "4.5 yrs" for a bare number like "4.5" or "3.5+"; anything else as typed. */
export function formatDeerAge(age: string | undefined): string {
  const text = (age ?? "").trim();

  if (!text) return "";

  return /^\d+(\.\d+)?\+?$/.test(text) ? `${text} yrs` : text;
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
  const runnerUp = counts
    .filter((slot) => slot !== top)
    .reduce((best, slot) => (slot.count > best.count ? slot : best));
  const clear =
    top.count >= 0.4 * timed.length && top.count - runnerUp.count > 1;

  return {
    label: top.window.label,
    hours: top.window.hours,
    count: top.count,
    sampleSize: timed.length,
    runnerUpLabel: runnerUp.window.label,
    runnerUpCount: runnerUp.count,
    clear,
  };
}

/** Hour from "YYYY-MM-DDTHH:MM" or "HH:MM"; null when there's no clock time. */
function clockHour(value: string | undefined): number | null {
  const match = /(?:^|T)(\d{2}):(\d{2})/.exec(value?.trim() ?? "");

  if (!match) return null;

  const hour = Number(match[1]);

  return hour >= 0 && hour <= 23 ? hour : null;
}

import {
  DEFAULT_STALE_CHECK_DAYS,
  LOW_PERCENT,
  getCameraHealth,
  readPercent,
} from "@/lib/cameraHealth";
import { hasTrustedPhotoTime } from "@/lib/photoDateTime";
import { isDeerPhotoRecord } from "@/lib/hourlyActivity";
import {
  NO_ANIMAL,
  ageClassYears,
  photoDeerCount,
} from "@/lib/photoOptions";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

export type CameraInsight = {
  title: string;
  detail: string;
  cameraId?: string;
  badge?: string;
};

export type CameraAttentionItem = {
  cameraId: string;
  cameraName: string;
  reason: string;
  detail: string;
  // "note" = worth knowing, not a problem (e.g. a site never checked yet);
  // unset = a real warning.
  tone?: "note";
};

export type CameraActivityCounts = {
  bucks: number;
  does: number;
  fawns: number;
};

// A single camera's own pattern, mined from its photo timestamps + weather
// snapshots: when it fires most, the wind it fires most on, and the buck/doe
// split. This is the read that turns a pile of photos into "sit here on a NW
// wind at last light."
export type CameraActivityProfile = {
  sampleSize: number;
  /** Most common time window (e.g. "Evening (3–8pm)"), or null if untimed. */
  peakWindow: string | null;
  peakShare: number;
  /** Wind direction the camera fires most on, or null if none recorded. */
  topWind: string | null;
  topWindShare: number;
  bucks: number;
  does: number;
};

// Minimum photos before a per-camera pattern is worth showing — fewer than this
// is anecdote, not a pattern.
const CAMERA_PROFILE_MIN_PHOTOS = 3;

const ACTIVITY_WINDOW_LABEL: Record<string, string> = {
  Morning: "Morning (5–10am)",
  Midday: "Midday (11am–2pm)",
  Evening: "Evening (3–8pm)",
  Night: "Night (9pm–4am)",
};

export function getCameraActivityProfile(
  allPhotoRecords: PhotoRecord[],
): CameraActivityProfile | null {
  // Only deer photos make a deer pattern — false triggers, turkeys and
  // unidentified frames would skew the window and the wind.
  const photoRecords = allPhotoRecords.filter(isDeerPhotoRecord);

  if (photoRecords.length < CAMERA_PROFILE_MIN_PHOTOS) return null;

  const windowCounts = new Map<string, number>();
  let windowTotal = 0;
  const windCounts = new Map<string, number>();
  let windTotal = 0;
  let bucks = 0;
  let does = 0;

  for (const photo of photoRecords) {
    const bucket = photoTimeBucket(photo);
    if (bucket) {
      windowCounts.set(bucket, (windowCounts.get(bucket) ?? 0) + 1);
      windowTotal += 1;
    }

    const wind = photo.weatherSnapshot?.windDirection?.trim();
    if (wind) {
      windCounts.set(wind, (windCounts.get(wind) ?? 0) + 1);
      windTotal += 1;
    }

    if (isBuckPhoto(photo)) bucks += 1;
    else if (speciesIncludes(photo.species, "doe")) does += 1;
  }

  const topWindow = [...windowCounts.entries()].sort((a, b) => b[1] - a[1])[0];
  const topWind = [...windCounts.entries()].sort((a, b) => b[1] - a[1])[0];

  return {
    sampleSize: photoRecords.length,
    peakWindow: topWindow
      ? (ACTIVITY_WINDOW_LABEL[topWindow[0]] ?? topWindow[0])
      : null,
    peakShare: topWindow && windowTotal ? topWindow[1] / windowTotal : 0,
    topWind: topWind ? topWind[0] : null,
    topWindShare: topWind && windTotal ? topWind[1] / windTotal : 0,
    bucks,
    does,
  };
}

export type CameraIntelligenceSummary = {
  hasCameraSites: boolean;
  hasCameraChecks: boolean;
  hasPhotoRecords: boolean;
  cameraCount: number;
  checkCount: number;
  photoCount: number;
  mostActiveCamera: CameraInsight;
  mostRecentActivity: CameraInsight;
  bestPhotoTime: CameraInsight;
  matureBuckActivity: CameraInsight;
  activityCounts: CameraActivityCounts;
  camerasWithNoRecentChecks: CameraAttentionItem[];
  attentionItems: CameraAttentionItem[];
};

type CameraActivityStat = {
  camera: Camera;
  checks: CameraCheck[];
  photos: PhotoRecord[];
  score: number;
  latestTime: number;
};

type CameraActivityEvent = {
  cameraId: string;
  cameraName: string;
  time: number;
  dateLabel: string;
  title: string;
  detail: string;
};

export function getCameraIntelligenceSummary({
  cameras,
  cameraChecks,
  photoRecords,
  now = new Date(),
}: {
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  photoRecords: PhotoRecord[];
  now?: Date;
}): CameraIntelligenceSummary {
  const cameraNameById = new Map(
    cameras.map((camera) => [camera.id, camera.name]),
  );
  const stats = cameras.map((camera) =>
    getCameraActivityStat(camera, cameraChecks, photoRecords),
  );
  const mostActiveCamera = getMostActiveCameraInsight(stats);
  const mostRecentActivity = getMostRecentActivityInsight({
    cameraChecks,
    photoRecords,
    cameraNameById,
  });
  const bestPhotoTime = getBestPhotoTimeInsight(photoRecords);
  const activityCounts = getActivityCounts(cameraChecks, photoRecords);
  const matureBuckActivity = getMatureBuckActivityInsight(
    photoRecords,
    cameraNameById,
  );
  const camerasWithNoRecentChecks = getCamerasWithNoRecentChecks(
    cameras,
    cameraChecks,
    now,
  );
  const attentionItems = getAttentionItems(cameras, cameraChecks, now);

  return {
    hasCameraSites: cameras.length > 0,
    hasCameraChecks: cameraChecks.length > 0,
    hasPhotoRecords: photoRecords.length > 0,
    cameraCount: cameras.length,
    checkCount: cameraChecks.length,
    photoCount: photoRecords.length,
    mostActiveCamera,
    mostRecentActivity,
    bestPhotoTime,
    matureBuckActivity,
    activityCounts,
    camerasWithNoRecentChecks,
    attentionItems,
  };
}

function getCameraActivityStat(
  camera: Camera,
  cameraChecks: CameraCheck[],
  photoRecords: PhotoRecord[],
): CameraActivityStat {
  const checks = cameraChecks.filter((check) => check.cameraId === camera.id);
  const photos = photoRecords.filter(
    (photo) => photo.cameraSiteId === camera.id && photo.species !== NO_ANIMAL,
  );
  const latestTime = Math.max(
    ...checks.map((check) => dateInputTime(check.date)),
    ...photos.map((photo) => dateInputTime(photo.photoDate)),
    0,
  );

  return {
    camera,
    checks,
    photos,
    score: checks.length + photos.length,
    latestTime,
  };
}

function getMostActiveCameraInsight(
  stats: CameraActivityStat[],
): CameraInsight {
  if (stats.length === 0) {
    return {
      title: "No camera sites yet",
      detail: "Add a camera site before Deer Intel can summarize activity.",
    };
  }

  const topStat = [...stats].sort(
    (left, right) =>
      right.score - left.score || right.latestTime - left.latestTime,
  )[0];

  if (!topStat || topStat.score === 0) {
    return {
      title: "No activity yet",
      detail: "Save camera checks or photo records to see the most active site.",
    };
  }

  return {
    title: topStat.camera.name,
    detail: `${topStat.score} activity records: ${topStat.checks.length} checks and ${topStat.photos.length} photo records.`,
    cameraId: topStat.camera.id,
    badge: "Most Active",
  };
}

function getMostRecentActivityInsight({
  cameraChecks,
  photoRecords,
  cameraNameById,
}: {
  cameraChecks: CameraCheck[];
  photoRecords: PhotoRecord[];
  cameraNameById: Map<string, string>;
}): CameraInsight {
  const events: CameraActivityEvent[] = [
    ...cameraChecks.map((check) => ({
      cameraId: check.cameraId,
      cameraName: cameraNameById.get(check.cameraId) ?? "Camera site",
      time: dateInputTime(check.date),
      dateLabel: formatDate(check.date),
      title: "Camera check",
      detail: wildlifeSummary(check),
    })),
    ...photoRecords
      .filter((photo) => photo.species !== NO_ANIMAL)
      .map((photo) => ({
        cameraId: photo.cameraSiteId,
        cameraName: cameraNameById.get(photo.cameraSiteId) ?? "Camera site",
        time: dateInputTime(photo.photoDate),
        dateLabel: formatDate(photo.photoDate),
        title: "Photo record",
        detail: `${photo.species || "Wildlife"}: ${photo.fileName}`,
      })),
  ].filter((event) => event.time > 0);

  const latestEvent = events.sort((left, right) => right.time - left.time)[0];

  if (!latestEvent) {
    return {
      title: "No recent camera activity",
      detail: "Camera checks and photo records will appear here once saved.",
    };
  }

  return {
    title: latestEvent.cameraName,
    detail: `${latestEvent.title} on ${latestEvent.dateLabel}. ${latestEvent.detail}`,
    cameraId: latestEvent.cameraId,
    badge: "Latest",
  };
}

function getBestPhotoTimeInsight(allPhotoRecords: PhotoRecord[]): CameraInsight {
  if (allPhotoRecords.length === 0) {
    return {
      title: "No photo records yet",
      detail: "Add photo records to start seeing time-of-day patterns.",
    };
  }

  const bucketCounts = new Map<string, number>();
  // Deer photos only: an hour full of false triggers isn't a good hour to hunt.
  const photoRecords = allPhotoRecords.filter(isDeerPhotoRecord);

  photoRecords.forEach((photo) => {
    const bucket = photoTimeBucket(photo);

    if (!bucket) return;

    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  });

  const topBucket = [...bucketCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  if (!topBucket) {
    return {
      title: "Photo times not recorded yet",
      detail: "No deer photos with a real capture time yet. Photos whose time was read or set will power this pattern.",
    };
  }

  return {
    title: topBucket[0],
    detail: `${topBucket[1]} deer ${topBucket[1] === 1 ? "photo falls" : "photos fall"} in this time window.`,
    badge: "Best Time",
  };
}

// Each deer counted once: a check whose photos were imported counts from
// those photos (its logged tally describes the same deer); a check with no
// linked photos counts from its tally; photos not tied to a check still count.
function getActivityCounts(
  cameraChecks: CameraCheck[],
  photoRecords: PhotoRecord[],
): CameraActivityCounts {
  const checkIdsWithPhotos = new Set(
    photoRecords.map((photo) => photo.cameraCheckId).filter(Boolean),
  );
  const checkCounts = cameraChecks.reduce(
    (counts, check) =>
      checkIdsWithPhotos.has(check.id)
        ? counts
        : {
            bucks: counts.bucks + check.bucks,
            does: counts.does + check.does,
            fawns: counts.fawns + check.fawns,
          },
    { bucks: 0, does: 0, fawns: 0 },
  );

  // A photo of three does counts three does (deerCount, default 1).
  return photoRecords.reduce((counts, photo) => {
    const deer = photoDeerCount(photo);

    if (isBuckPhoto(photo)) {
      return { ...counts, bucks: counts.bucks + deer };
    }

    if (speciesIncludes(photo.species, "doe")) {
      return { ...counts, does: counts.does + deer };
    }

    if (speciesIncludes(photo.species, "fawn")) {
      return { ...counts, fawns: counts.fawns + deer };
    }

    return counts;
  }, checkCounts);
}

function getMatureBuckActivityInsight(
  photoRecords: PhotoRecord[],
  cameraNameById: Map<string, string>,
): CameraInsight {
  const latestMatureBuckPhoto = photoRecords
    .filter(isMatureBuckPhoto)
    .sort((left, right) => dateInputTime(right.photoDate) - dateInputTime(left.photoDate))[0];

  if (!latestMatureBuckPhoto) {
    return {
      title: "No mature buck activity marked",
      detail: "Set an age class of 3.5 or older on buck photos (or note mature, shooter, 4.5) to flag this.",
    };
  }

  return {
    title:
      cameraNameById.get(latestMatureBuckPhoto.cameraSiteId) ??
      "Camera site",
    detail: `${latestMatureBuckPhoto.fileName} on ${formatDate(
      latestMatureBuckPhoto.photoDate,
    )}.`,
    cameraId: latestMatureBuckPhoto.cameraSiteId,
    badge: "Mature Buck",
  };
}

// Same rule as the Today line and camera rows (lib/cameraHealth): an active
// camera unchecked for more than DEFAULT_STALE_CHECK_DAYS needs a visit; a
// pulled (inactive) camera never does; a site never checked is a neutral note.
function getCamerasWithNoRecentChecks(
  cameras: Camera[],
  cameraChecks: CameraCheck[],
  now: Date,
): CameraAttentionItem[] {
  return cameras
    .filter((camera) => camera.status === "Active")
    .map((camera): CameraAttentionItem | null => {
      const health = getCameraHealth(camera, cameraChecks, { now });

      if (!health.latestCheck) {
        return {
          cameraId: camera.id,
          cameraName: camera.name,
          reason: "No checks yet",
          detail: "Log a check on your next visit to track battery and SD card.",
          tone: "note",
        };
      }

      const overdue = health.issues.find((issue) => issue.kind === "overdue");

      if (!overdue) return null;

      return {
        cameraId: camera.id,
        cameraName: camera.name,
        reason: "Check due",
        detail: `Last checked ${overdue.days} days ago (over ${DEFAULT_STALE_CHECK_DAYS}).`,
      };
    })
    .filter((item): item is CameraAttentionItem => item !== null);
}

function getAttentionItems(
  cameras: Camera[],
  cameraChecks: CameraCheck[],
  now: Date,
): CameraAttentionItem[] {
  const checkAttentionItems = getCamerasWithNoRecentChecks(
    cameras,
    cameraChecks,
    now,
  );
  // Battery / SD readings come from the shared health rule, which already
  // skips inactive cameras; weak cellular signal is the one extra here.
  const conditionItems = cameras.flatMap((camera) => {
    const health = getCameraHealth(camera, cameraChecks, { now });
    const latestCheck = health.latestCheck;
    const items: CameraAttentionItem[] = health.issues
      .filter((issue) => issue.kind !== "overdue")
      .map((issue) => ({
        cameraId: camera.id,
        cameraName: camera.name,
        reason: issue.label,
        detail: conditionDetail(issue.kind, latestCheck),
      }));
    const signalStrength = readPercent(latestCheck?.signalStrength);

    if (
      camera.status === "Active" &&
      camera.cameraType === "Cellular" &&
      signalStrength !== null &&
      signalStrength <= LOW_PERCENT
    ) {
      items.push({
        cameraId: camera.id,
        cameraName: camera.name,
        reason: "Weak signal",
        detail: `${signalStrength}% cellular signal reported.`,
      });
    }

    return items;
  });

  return [...checkAttentionItems, ...conditionItems];
}

function conditionDetail(kind: string, check: CameraCheck | null): string {
  const battery = readPercent(check?.batteryPercent);
  const sd = readPercent(check?.sdCardPercent);

  switch (kind) {
    case "batteryDead":
    case "batteryLow":
      return `${battery ?? 0}% battery reported.`;
    case "sdMissing":
      return "SD card reported missing.";
    case "sdFull":
    case "sdLow":
      return `${sd ?? 0}% SD card space left.`;
    default:
      return "";
  }
}

function wildlifeSummary(check: CameraCheck) {
  const parts = [
    check.bucks > 0 ? `${check.bucks} bucks` : "",
    check.does > 0 ? `${check.does} does` : "",
    check.fawns > 0 ? `${check.fawns} fawns` : "",
  ].filter(Boolean);

  if (parts.length > 0) return parts.join(", ");

  return check.notes || "No deer counts saved.";
}

function isMatureBuckPhoto(photo: PhotoRecord) {
  if (!isBuckPhoto(photo)) return false;

  // A judged age class is the real answer; the word search below is only a
  // fallback for photos saved before age classes existed.
  if (photo.ageClass) return ageClassYears(photo.ageClass) >= 3.5;

  const searchableText = [
    photo.fileName,
    photo.buckName,
    photo.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return [
    "mature",
    "shooter",
    "big buck",
    "old buck",
    "4.5",
    "5.5",
    "6.5",
  ].some((term) => searchableText.includes(term));
}

function isBuckPhoto(photo: PhotoRecord) {
  return speciesIncludes(photo.species, "buck") || Boolean(photo.buckName?.trim());
}

function speciesIncludes(species: string, value: string) {
  return species.trim().toLowerCase().includes(value);
}

function photoTimeBucket(photo: PhotoRecord) {
  // A file-modified or date-only-stamp time isn't the shutter time.
  if (!hasTrustedPhotoTime(photo)) return null;

  const hour = dateHour(photo.photoDate);

  if (hour === null) return null;
  if (hour >= 5 && hour <= 10) return "Morning";
  if (hour >= 11 && hour <= 14) return "Midday";
  if (hour >= 15 && hour <= 20) return "Evening";

  return "Night";
}

function dateHour(date: string) {
  if (!date || /^\d{4}-\d{2}-\d{2}$/.test(date)) return null;

  const time = Date.parse(date);

  if (Number.isNaN(time)) return null;

  return new Date(time).getHours();
}


function formatDate(date: string | undefined) {
  if (!date) return "No date";

  const time = dateInputTime(date);

  if (time <= 0) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function dateInputTime(date: string | undefined) {
  if (!date) return 0;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;

    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const parsedTime = Date.parse(date);

  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

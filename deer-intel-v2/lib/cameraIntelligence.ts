import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { PhotoRecord } from "@/types/photo";

const RECENT_CHECK_DAYS = 30;
const LOW_PERCENT_THRESHOLD = 25;

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
};

export type CameraActivityCounts = {
  bucks: number;
  does: number;
  fawns: number;
};

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
    (photo) => photo.cameraSiteId === camera.id,
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
    ...photoRecords.map((photo) => ({
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

function getBestPhotoTimeInsight(photoRecords: PhotoRecord[]): CameraInsight {
  if (photoRecords.length === 0) {
    return {
      title: "No photo records yet",
      detail: "Add photo records to start seeing time-of-day patterns.",
    };
  }

  const bucketCounts = new Map<string, number>();

  photoRecords.forEach((photo) => {
    const bucket = photoTimeBucket(photo.photoDate);

    if (!bucket) return;

    bucketCounts.set(bucket, (bucketCounts.get(bucket) ?? 0) + 1);
  });

  const topBucket = [...bucketCounts.entries()].sort(
    (left, right) => right[1] - left[1],
  )[0];

  if (!topBucket) {
    return {
      title: "Photo times not recorded yet",
      detail: "Current photo records use dates only. Future time entries can power this pattern.",
    };
  }

  return {
    title: topBucket[0],
    detail: `${topBucket[1]} photo records fall in this time window.`,
    badge: "Best Time",
  };
}

function getActivityCounts(
  cameraChecks: CameraCheck[],
  photoRecords: PhotoRecord[],
): CameraActivityCounts {
  const checkCounts = cameraChecks.reduce(
    (counts, check) => ({
      bucks: counts.bucks + check.bucks,
      does: counts.does + check.does,
      fawns: counts.fawns + check.fawns,
    }),
    { bucks: 0, does: 0, fawns: 0 },
  );

  return photoRecords.reduce((counts, photo) => {
    if (isBuckPhoto(photo)) {
      return { ...counts, bucks: counts.bucks + 1 };
    }

    if (speciesIncludes(photo.species, "doe")) {
      return { ...counts, does: counts.does + 1 };
    }

    if (speciesIncludes(photo.species, "fawn")) {
      return { ...counts, fawns: counts.fawns + 1 };
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
      detail: "Use photo labels or notes like mature buck, shooter, or 4.5 to flag this later.",
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

function getCamerasWithNoRecentChecks(
  cameras: Camera[],
  cameraChecks: CameraCheck[],
  now: Date,
): CameraAttentionItem[] {
  return cameras
    .map((camera) => {
      const latestCheckDate = latestCameraCheckDate(camera, cameraChecks);

      if (!latestCheckDate) {
        return {
          cameraId: camera.id,
          cameraName: camera.name,
          reason: "No checks yet",
          detail: "This camera site has not had a check saved.",
        };
      }

      const daysSinceCheck = daysBetween(latestCheckDate, now);

      if (daysSinceCheck <= RECENT_CHECK_DAYS) return null;

      return {
        cameraId: camera.id,
        cameraName: camera.name,
        reason: "Check due",
        detail: `Last checked ${daysSinceCheck} days ago.`,
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
  const conditionItems = cameras.flatMap((camera) => {
    const latestCheck = latestCameraCheck(camera.id, cameraChecks);
    const batteryPercent = percentNumber(latestCheck?.batteryPercent);
    const sdCardPercent = percentNumber(latestCheck?.sdCardPercent);
    const signalStrength = percentNumber(latestCheck?.signalStrength);
    const items: CameraAttentionItem[] = [];

    if (camera.status === "Inactive") {
      items.push({
        cameraId: camera.id,
        cameraName: camera.name,
        reason: "Inactive",
        detail: "This camera site is marked inactive.",
      });
    }

    if (batteryPercent !== null && batteryPercent <= LOW_PERCENT_THRESHOLD) {
      items.push({
        cameraId: camera.id,
        cameraName: camera.name,
        reason: "Battery low",
        detail: `${batteryPercent}% battery reported.`,
      });
    }

    if (sdCardPercent !== null && sdCardPercent <= LOW_PERCENT_THRESHOLD) {
      items.push({
        cameraId: camera.id,
        cameraName: camera.name,
        reason: "SD card low",
        detail: `${sdCardPercent}% SD card reported.`,
      });
    }

    if (
      camera.cameraType === "Cellular" &&
      signalStrength !== null &&
      signalStrength <= LOW_PERCENT_THRESHOLD
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

function latestCameraCheck(cameraId: string, cameraChecks: CameraCheck[]) {
  return cameraChecks
    .filter((check) => check.cameraId === cameraId)
    .sort((left, right) => dateInputTime(right.date) - dateInputTime(left.date))[0];
}

function latestCameraCheckDate(camera: Camera, cameraChecks: CameraCheck[]) {
  const latestCheck = latestCameraCheck(camera.id, cameraChecks);
  const latestCheckTime = dateInputTime(latestCheck?.date);

  if (latestCheckTime > 0) return new Date(latestCheckTime);

  return null;
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

function photoTimeBucket(date: string) {
  const hour = dateHour(date);

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

function daysBetween(date: Date, now: Date) {
  const difference = now.getTime() - date.getTime();

  return Math.max(0, Math.floor(difference / 86_400_000));
}

function percentNumber(value: string | undefined) {
  if (!value) return null;

  const parsedValue = Number(value.replace("%", "").trim());

  return Number.isNaN(parsedValue) ? null : parsedValue;
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

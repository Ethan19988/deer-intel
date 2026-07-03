import { getCameraIntelligenceSummary } from "@/lib/cameraIntelligence";
import { formatCameraCheckDate } from "@/lib/cameraChecks";
import { getHuntPlannerIntelligence } from "@/lib/huntPlannerIntelligence";
import { sortHuntsChronologically } from "@/lib/hunts";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

export type DeerHubItem = {
  title: string;
  detail: string;
  href?: string;
};

export type DeerHubBestStand = {
  name: string;
  reason: string;
  href?: string;
};

export type DeerHubBuckActivity = {
  title: string;
  camera: string;
  property: string;
  date: string;
  time: string;
  detail: string;
  href?: string;
};

export type DeerHubSnapshot = {
  cameras: number;
  stands: number;
  deerProfiles: number;
  hunts: number;
  photos: number;
};

export type DeerIntelligenceHubSummary = {
  whatsHappening: string[];
  bestStand: DeerHubBestStand;
  recentBuckActivity: DeerHubBuckActivity;
  needsAttention: DeerHubItem[];
  snapshot: DeerHubSnapshot;
};

type DeerIntelligenceHubInput = {
  property: Property;
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  stands: Stand[];
  hunts: HuntLogEntry[];
  photoRecords: PhotoRecord[];
  deerProfiles: DeerProfile[];
  pins: MapPin[];
  now?: Date;
};

export function getDeerIntelligenceHubSummary({
  property,
  cameras,
  cameraChecks,
  stands,
  hunts,
  photoRecords,
  deerProfiles,
  pins,
  now = new Date(),
}: DeerIntelligenceHubInput): DeerIntelligenceHubSummary {
  const cameraSummary = getCameraIntelligenceSummary({
    cameras,
    cameraChecks,
    photoRecords,
    now,
  });
  const huntPlanner = getHuntPlannerIntelligence({
    property,
    stands,
    cameras,
    cameraChecks,
    deerProfiles,
    hunts,
    photoRecords,
    pins,
    now,
  });
  const bestStand = getBestStand(property, huntPlanner.bestStandCandidates);
  const recentBuckActivity = getRecentBuckActivity({
    property,
    cameras,
    photoRecords,
    cameraChecks,
  });
  const needsAttention = getNeedsAttention({
    property,
    cameras,
    cameraChecks,
    stands,
    hunts,
    photoRecords,
    cameraAttention: cameraSummary.attentionItems,
  });
  const whatsHappening = getWhatsHappening({
    bestStand,
    recentBuckActivity,
    needsAttention,
    cameraSummary,
    hunts,
    stands,
  });

  return {
    whatsHappening,
    bestStand,
    recentBuckActivity,
    needsAttention,
    snapshot: {
      cameras: cameras.length,
      stands: stands.length,
      deerProfiles: deerProfiles.length,
      hunts: hunts.length,
      photos: photoRecords.length,
    },
  };
}

function getBestStand(
  property: Property,
  candidates: Array<{ title: string; detail: string; href?: string }>,
): DeerHubBestStand {
  const bestCandidate = candidates[0];

  if (!bestCandidate) {
    return {
      name: "No stand picked yet",
      reason: `Add stands, wind notes, hunts, and camera activity for ${property.name} to pick a stand.`,
    };
  }

  return {
    name: bestCandidate.title,
    reason: bestCandidate.detail || "Best current stand from saved Deer Intel data.",
    href: bestCandidate.href,
  };
}

function getRecentBuckActivity({
  property,
  cameras,
  photoRecords,
  cameraChecks,
}: {
  property: Property;
  cameras: Camera[];
  photoRecords: PhotoRecord[];
  cameraChecks: CameraCheck[];
}): DeerHubBuckActivity {
  const cameraNameById = new Map(
    cameras.map((camera) => [camera.id, camera.name]),
  );
  const matureBuckPhoto = [...photoRecords]
    .filter(isMatureBuckPhoto)
    .sort((left, right) => recordTime(right.photoDate) - recordTime(left.photoDate))[0];

  if (matureBuckPhoto) {
    return {
      title: matureBuckPhoto.buckName || matureBuckPhoto.fileName,
      camera: cameraNameById.get(matureBuckPhoto.cameraSiteId) ?? "Camera site",
      property: property.name,
      date: formatDate(matureBuckPhoto.photoDate),
      time: formatTime(matureBuckPhoto.photoDate),
      detail: matureBuckPhoto.notes || "Marked mature buck activity.",
      href: `/properties/${property.id}/assets/${matureBuckPhoto.cameraSiteId}`,
    };
  }

  const buckPhoto = [...photoRecords]
    .filter(isBuckPhoto)
    .sort((left, right) => recordTime(right.photoDate) - recordTime(left.photoDate))[0];

  if (buckPhoto) {
    return {
      title: buckPhoto.buckName || "Latest buck photo",
      camera: cameraNameById.get(buckPhoto.cameraSiteId) ?? "Camera site",
      property: property.name,
      date: formatDate(buckPhoto.photoDate),
      time: formatTime(buckPhoto.photoDate),
      detail: "No mature buck label yet, but buck activity is saved.",
      href: `/properties/${property.id}/assets/${buckPhoto.cameraSiteId}`,
    };
  }

  const buckCheck = [...cameraChecks]
    .filter((check) => check.bucks > 0)
    .sort((left, right) => recordTime(right.date) - recordTime(left.date))[0];

  if (buckCheck) {
    return {
      title: `${buckCheck.bucks} bucks seen`,
      camera: cameraNameById.get(buckCheck.cameraId) ?? "Camera site",
      property: property.name,
      date: formatDate(buckCheck.date),
      time: formatTime(buckCheck.date),
      detail: "Buck activity came from a camera check.",
      href: `/properties/${property.id}/assets/${buckCheck.cameraId}`,
    };
  }

  return {
    title: "No buck activity yet",
    camera: "Not recorded",
    property: property.name,
    date: "Not recorded",
    time: "Not recorded",
    detail: "Add buck photo records or camera checks to fill this in.",
  };
}

function getNeedsAttention({
  property,
  cameras,
  cameraChecks,
  stands,
  hunts,
  photoRecords,
  cameraAttention,
}: {
  property: Property;
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  stands: Stand[];
  hunts: HuntLogEntry[];
  photoRecords: PhotoRecord[];
  cameraAttention: Array<{ cameraId: string; cameraName: string; reason: string; detail: string }>;
}): DeerHubItem[] {
  const huntedStandIds = new Set(hunts.map((hunt) => hunt.standId).filter(Boolean));
  const checkedCameraIds = new Set(cameraChecks.map((check) => check.cameraId));
  const items: DeerHubItem[] = [];

  cameraAttention.slice(0, 3).forEach((camera) => {
    items.push({
      title: camera.cameraName,
      detail: `${camera.reason}: ${camera.detail}`,
      href: `/properties/${property.id}/assets/${camera.cameraId}`,
    });
  });

  stands
    .filter((stand) => !huntedStandIds.has(stand.id))
    .slice(0, 2)
    .forEach((stand) => {
      items.push({
        title: stand.name,
        detail: "This stand has not been hunted yet.",
        href: `/properties/${property.id}/assets/${stand.id}`,
      });
    });

  stands
    .filter((stand) => !stand.bestWinds.trim())
    .slice(0, 2)
    .forEach((stand) => {
      items.push({
        title: stand.name,
        detail: "Missing best wind notes.",
        href: `/properties/${property.id}/assets/${stand.id}`,
      });
    });

  cameras
    .filter((camera) => !checkedCameraIds.has(camera.id))
    .slice(0, 2)
    .forEach((camera) => {
      items.push({
        title: camera.name,
        detail: "No camera checks saved yet.",
        href: `/properties/${property.id}/assets/${camera.id}`,
      });
    });

  if (cameras.length === 0) {
    items.push({
      title: "Camera Sites",
      detail: "No camera sites are saved for this property.",
      href: `/properties/${property.id}#camera-sites`,
    });
  }

  if (photoRecords.length === 0) {
    items.push({
      title: "Photo Records",
      detail: "No photo records are saved yet.",
      href: "/cameras/import",
    });
  }

  return uniqueItems(items).slice(0, 6);
}

function getWhatsHappening({
  bestStand,
  recentBuckActivity,
  needsAttention,
  cameraSummary,
  hunts,
  stands,
}: {
  bestStand: DeerHubBestStand;
  recentBuckActivity: DeerHubBuckActivity;
  needsAttention: DeerHubItem[];
  cameraSummary: ReturnType<typeof getCameraIntelligenceSummary>;
  hunts: HuntLogEntry[];
  stands: Stand[];
}) {
  const items: string[] = [];
  const latestHunt = sortHuntsChronologically(hunts).at(-1);

  if (bestStand.href) {
    items.push(`${bestStand.name} is the current best stand pick.`);
  }

  if (recentBuckActivity.title !== "No buck activity yet") {
    items.push(`${recentBuckActivity.title} was last recorded at ${recentBuckActivity.camera}.`);
  }

  if (cameraSummary.mostRecentActivity.cameraId) {
    items.push(`${cameraSummary.mostRecentActivity.title} has the latest camera activity.`);
  }

  if (latestHunt) {
    items.push(`Last hunt was ${formatCameraCheckDate(latestHunt.date)} at ${latestHunt.standName || "a stand"}.`);
  }

  if (needsAttention.length > 0) {
    items.push(`${needsAttention.length} item${needsAttention.length === 1 ? "" : "s"} need attention before the next sit.`);
  }

  if (items.length === 0 && stands.length === 0) {
    items.push("Add stands to start building property intelligence.");
  }

  if (items.length === 0) {
    items.push("Add hunts, camera checks, and photo records to build better insights.");
  }

  return items.slice(0, 5);
}

function uniqueItems(items: DeerHubItem[]) {
  const seen = new Set<string>();

  return items.filter((item) => {
    const key = `${item.title}-${item.detail}`;

    if (seen.has(key)) return false;

    seen.add(key);

    return true;
  });
}

function isMatureBuckPhoto(photo: PhotoRecord) {
  if (!isBuckPhoto(photo)) return false;

  const searchableText = [photo.fileName, photo.buckName, photo.notes]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();

  return ["mature", "shooter", "target", "big buck", "old buck", "4.5", "5.5", "6.5"].some((term) =>
    searchableText.includes(term),
  );
}

function isBuckPhoto(photo: PhotoRecord) {
  return (
    photo.species.trim().toLowerCase().includes("buck") ||
    Boolean(photo.buckName?.trim())
  );
}

function formatDate(value: string | undefined) {
  const time = recordTime(value);

  if (time <= 0) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function formatTime(value: string | undefined) {
  if (!value || /^\d{4}-\d{2}-\d{2}$/.test(value)) return "Not recorded";

  const time = recordTime(value);

  if (time <= 0) return "Not recorded";

  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
  }).format(time);
}

function recordTime(value: string | undefined) {
  if (!value) return 0;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);

  if (dateOnlyMatch) {
    const [, year, month, day] = dateOnlyMatch;

    return new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  }

  const parsedTime = Date.parse(value);

  return Number.isNaN(parsedTime) ? 0 : parsedTime;
}

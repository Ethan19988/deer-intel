import { getCameraIntelligenceSummary } from "@/lib/cameraIntelligence";
import { formatCameraCheckDate } from "@/lib/cameraChecks";
import { sortHuntsChronologically } from "@/lib/hunts";
import { getStandIntelligenceSummary } from "@/lib/standIntelligence";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

const RECENT_HUNT_DAYS = 21;
const RECENT_CAMERA_DAYS = 14;

export type HuntPlannerItem = {
  id: string;
  title: string;
  detail: string;
  href?: string;
  badge?: string;
};

export type HuntPlannerCandidate = HuntPlannerItem & {
  score: number;
  reasons: string[];
};

export type HuntPlannerIntelligence = {
  propertyName: string;
  hasStands: boolean;
  hasCameraActivity: boolean;
  hasHuntHistory: boolean;
  hasWindData: boolean;
  bestStandCandidates: HuntPlannerCandidate[];
  standsNotHuntedRecently: HuntPlannerItem[];
  standsWithRecentCameraActivity: HuntPlannerItem[];
  standsWithGoodWindNotes: HuntPlannerItem[];
  recentBuckAreas: HuntPlannerItem[];
  areasNeedingMoreScouting: HuntPlannerItem[];
};

type HuntPlannerIntelligenceInput = {
  property: Property;
  stands: Stand[];
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  deerProfiles: DeerProfile[];
  hunts: HuntLogEntry[];
  photoRecords: PhotoRecord[];
  pins: MapPin[];
  now?: Date;
};

export function getHuntPlannerIntelligence({
  property,
  stands,
  cameras,
  cameraChecks,
  deerProfiles,
  hunts,
  photoRecords,
  pins,
  now = new Date(),
}: HuntPlannerIntelligenceInput): HuntPlannerIntelligence {
  const cameraSummary = getCameraIntelligenceSummary({
    cameras,
    cameraChecks,
    photoRecords,
    now,
  });
  const standSummaries = stands.map((stand) => ({
    stand,
    intelligence: getStandIntelligenceSummary({
      stand,
      propertyId: property.id,
      cameras,
      cameraChecks,
      hunts,
      pins,
      now,
    }),
    hunts: getStandHunts({ stand, propertyId: property.id, hunts }),
  }));
  const latestCameraActivity = getLatestCameraActivity({ cameras, cameraChecks });
  const hasWindData = stands.some((stand) => stand.bestWinds.trim());

  return {
    propertyName: property.name,
    hasStands: stands.length > 0,
    hasCameraActivity: cameraChecks.length > 0 || photoRecords.length > 0,
    hasHuntHistory: hunts.length > 0,
    hasWindData,
    bestStandCandidates: getBestStandCandidates({
      propertyId: property.id,
      standSummaries,
      latestCameraActivity,
      cameraSummary,
      photoRecords,
      now,
    }),
    standsNotHuntedRecently: getStandsNotHuntedRecently({
      propertyId: property.id,
      standSummaries,
      now,
    }),
    standsWithRecentCameraActivity: getStandsWithRecentCameraActivity({
      propertyId: property.id,
      stands,
      latestCameraActivity,
      now,
    }),
    standsWithGoodWindNotes: getStandsWithGoodWindNotes(property.id, stands),
    recentBuckAreas: getRecentBuckAreas({
      propertyId: property.id,
      cameras,
      cameraChecks,
      photoRecords,
      deerProfiles,
    }),
    areasNeedingMoreScouting: getAreasNeedingMoreScouting({
      propertyId: property.id,
      stands,
      cameras,
      cameraChecks,
      hunts,
      pins,
    }),
  };
}

type StandSummary = {
  stand: Stand;
  intelligence: ReturnType<typeof getStandIntelligenceSummary>;
  hunts: HuntLogEntry[];
};

function getBestStandCandidates({
  propertyId,
  standSummaries,
  latestCameraActivity,
  cameraSummary,
  photoRecords,
  now,
}: {
  propertyId: string;
  standSummaries: StandSummary[];
  latestCameraActivity: PlannerCameraActivity | null;
  cameraSummary: ReturnType<typeof getCameraIntelligenceSummary>;
  photoRecords: PhotoRecord[];
  now: Date;
}): HuntPlannerCandidate[] {
  return standSummaries
    .map(({ stand, intelligence, hunts }) => {
      const latestHunt = sortHuntsChronologically(hunts).at(-1);
      const daysSinceHunt = latestHunt ? daysSince(latestHunt.date, now) : null;
      const observationCount = hunts.reduce(
        (total, hunt) => total + hunt.bucks + hunt.does + hunt.fawns,
        0,
      );
      const reasons: string[] = [];
      let score = 0;

      if (stand.bestWinds.trim()) {
        score += 3;
        reasons.push(`Good for ${stand.bestWinds} wind`);
      }

      if (daysSinceHunt === null) {
        score += 2;
        reasons.push("Has not been hunted yet");
      } else if (daysSinceHunt > RECENT_HUNT_DAYS) {
        score += 3;
        reasons.push("Has not been hunted recently");
      } else if (daysSinceHunt <= 7) {
        score -= 2;
        reasons.push("Recently hunted");
      }

      if (latestCameraActivity && daysSince(latestCameraActivity.date, now) <= RECENT_CAMERA_DAYS) {
        score += 2;
        reasons.push("Recent camera activity nearby");
      }

      if (observationCount > 0) {
        score += 2;
        reasons.push(`${observationCount} deer observed from this stand`);
      }

      if (stand.accessRouteNotes.trim() || stand.exitRouteNotes.trim()) {
        score += 1;
        reasons.push("Access notes saved");
      }

      if (cameraSummary.activityCounts.bucks > 0 || hasRecentBuckPhoto(photoRecords)) {
        score += 1;
        reasons.push("Buck activity recorded on this property");
      }

      if (reasons.length === 0) {
        reasons.push(intelligence.bestWind.title);
      }

      return {
        id: stand.id,
        title: stand.name,
        detail: reasons.slice(0, 3).join(". "),
        href: `/properties/${propertyId}/assets/${stand.id}`,
        badge: score > 0 ? `${score} pts` : "Needs Data",
        score,
        reasons,
      };
    })
    .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
    .slice(0, 3);
}

function getStandsNotHuntedRecently({
  propertyId,
  standSummaries,
  now,
}: {
  propertyId: string;
  standSummaries: StandSummary[];
  now: Date;
}): HuntPlannerItem[] {
  return standSummaries.reduce<HuntPlannerItem[]>((items, { stand, hunts }) => {
      const latestHunt = sortHuntsChronologically(hunts).at(-1);
      const latestHuntDays = latestHunt ? daysSince(latestHunt.date, now) : null;

      if (latestHuntDays !== null && latestHuntDays <= RECENT_HUNT_DAYS) {
        return items;
      }

      items.push({
        id: stand.id,
        title: stand.name,
        detail:
          latestHuntDays === null
            ? "No hunts logged from this stand yet."
            : `Last hunted ${latestHuntDays} days ago.`,
        href: `/properties/${propertyId}/assets/${stand.id}`,
        badge: "Low Pressure",
      });

      return items;
    }, []);
}

function getStandsWithRecentCameraActivity({
  propertyId,
  stands,
  latestCameraActivity,
  now,
}: {
  propertyId: string;
  stands: Stand[];
  latestCameraActivity: PlannerCameraActivity | null;
  now: Date;
}): HuntPlannerItem[] {
  if (!latestCameraActivity || daysSince(latestCameraActivity.date, now) > RECENT_CAMERA_DAYS) {
    return [];
  }

  return stands.slice(0, 4).map((stand) => ({
    id: stand.id,
    title: stand.name,
    detail: `${latestCameraActivity.cameraName} had deer activity on ${formatCameraCheckDate(latestCameraActivity.date)}.`,
    href: `/properties/${propertyId}/assets/${stand.id}`,
    badge: "Camera Activity",
  }));
}

function getStandsWithGoodWindNotes(
  propertyId: string,
  stands: Stand[],
): HuntPlannerItem[] {
  return stands
    .filter((stand) => stand.bestWinds.trim())
    .map((stand) => ({
      id: stand.id,
      title: stand.name,
      detail: `Good for ${stand.bestWinds} wind. Avoid ${stand.avoidWinds || "not set"}.`,
      href: `/properties/${propertyId}/assets/${stand.id}`,
      badge: "Wind Notes",
    }));
}

function getRecentBuckAreas({
  propertyId,
  cameras,
  cameraChecks,
  photoRecords,
  deerProfiles,
}: {
  propertyId: string;
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  photoRecords: PhotoRecord[];
  deerProfiles: DeerProfile[];
}): HuntPlannerItem[] {
  const cameraNameById = new Map(cameras.map((camera) => [camera.id, camera.name]));
  const buckPhotos = photoRecords
    .filter((photo) => isBuckPhoto(photo))
    .sort((left, right) => dateInputTime(right.photoDate) - dateInputTime(left.photoDate))
    .slice(0, 3)
    .map((photo) => ({
      id: photo.id,
      title: cameraNameById.get(photo.cameraSiteId) ?? "Camera site",
      detail: `${photo.fileName} on ${formatCameraCheckDate(photo.photoDate)}.`,
      href: `/properties/${propertyId}/assets/${photo.cameraSiteId}`,
      badge: photo.buckName || "Buck",
    }));
  const buckChecks = cameraChecks
    .filter((check) => check.bucks > 0)
    .sort((left, right) => dateInputTime(right.date) - dateInputTime(left.date))
    .slice(0, 3)
    .map((check) => ({
      id: check.id,
      title: cameraNameById.get(check.cameraId) ?? "Camera site",
      detail: `${check.bucks} bucks on ${formatCameraCheckDate(check.date)}.`,
      href: `/properties/${propertyId}/assets/${check.cameraId}`,
      badge: "Buck Check",
    }));
  const profileAreas = deerProfiles
    .slice(0, 2)
    .map((profile) => ({
      id: profile.id,
      title: profile.nickname,
      detail: `Profile tracked on this property. Last seen: ${profile.lastSeen || "not set"}.`,
      badge: profile.estimatedAge || "Deer Profile",
    }));

  return uniquePlannerItems([...buckPhotos, ...buckChecks, ...profileAreas]).slice(0, 4);
}

function getAreasNeedingMoreScouting({
  propertyId,
  stands,
  cameras,
  cameraChecks,
  hunts,
  pins,
}: {
  propertyId: string;
  stands: Stand[];
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
}): HuntPlannerItem[] {
  const items: HuntPlannerItem[] = [];
  const huntedStandIds = new Set(hunts.map((hunt) => hunt.standId).filter(Boolean));
  const checkedCameraIds = new Set(cameraChecks.map((check) => check.cameraId));

  stands
    .filter((stand) => !huntedStandIds.has(stand.id))
    .slice(0, 3)
    .forEach((stand) => {
      items.push({
        id: `stand-${stand.id}`,
        title: stand.name,
        detail: "No hunts logged from this stand yet.",
        href: `/properties/${propertyId}/assets/${stand.id}`,
        badge: "Needs Hunt History",
      });
    });

  cameras
    .filter((camera) => !checkedCameraIds.has(camera.id))
    .slice(0, 3)
    .forEach((camera) => {
      items.push({
        id: `camera-${camera.id}`,
        title: camera.name,
        detail: "No camera checks saved yet.",
        href: `/properties/${propertyId}/assets/${camera.id}`,
        badge: "Needs Check",
      });
    });

  if (pins.length > 0 && hunts.length === 0) {
    items.push({
      id: "map-assets",
      title: "Mapped Assets",
      detail: `${pins.length} map assets saved, but no hunt history yet.`,
      href: "/map",
      badge: "Scout Map",
    });
  }

  return uniquePlannerItems(items).slice(0, 5);
}

type PlannerCameraActivity = {
  cameraName: string;
  date: string;
};

function getLatestCameraActivity({
  cameras,
  cameraChecks,
}: {
  cameras: Camera[];
  cameraChecks: CameraCheck[];
}): PlannerCameraActivity | null {
  const cameraNameById = new Map(cameras.map((camera) => [camera.id, camera.name]));
  const latestCheck = [...cameraChecks]
    .filter((check) => check.bucks + check.does + check.fawns > 0)
    .sort((left, right) => dateInputTime(right.date) - dateInputTime(left.date))[0];

  if (!latestCheck) return null;

  return {
    cameraName: cameraNameById.get(latestCheck.cameraId) ?? "Camera site",
    date: latestCheck.date,
  };
}

function getStandHunts({
  stand,
  propertyId,
  hunts,
}: {
  stand: Stand;
  propertyId: string;
  hunts: HuntLogEntry[];
}) {
  const standName = stand.name.trim().toLowerCase();

  return hunts.filter(
    (hunt) =>
      hunt.propertyId === propertyId &&
      (hunt.standId === stand.id ||
        (!hunt.standId && hunt.standName.trim().toLowerCase() === standName)),
  );
}

function uniquePlannerItems(items: HuntPlannerItem[]) {
  const seenIds = new Set<string>();

  return items.filter((item) => {
    if (seenIds.has(item.id)) return false;

    seenIds.add(item.id);

    return true;
  });
}

function hasRecentBuckPhoto(photoRecords: PhotoRecord[]) {
  return photoRecords.some(isBuckPhoto);
}

function isBuckPhoto(photo: PhotoRecord) {
  return (
    photo.species.trim().toLowerCase().includes("buck") ||
    Boolean(photo.buckName?.trim())
  );
}

function daysSince(date: string | undefined, now: Date) {
  const time = dateInputTime(date);

  if (time <= 0) return Number.POSITIVE_INFINITY;

  return Math.max(0, Math.floor((now.getTime() - time) / 86_400_000));
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

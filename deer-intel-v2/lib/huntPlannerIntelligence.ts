import { getCameraIntelligenceSummary } from "@/lib/cameraIntelligence";
import { formatCameraCheckDate } from "@/lib/cameraChecks";
import { sortHuntsChronologically } from "@/lib/hunts";
import { getStandIntelligenceSummary } from "@/lib/standIntelligence";
import { getStandWindCheck } from "@/lib/standWind";
import { camerasNear, standPoint } from "@/lib/aiScoutSpatial";
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
  /**
   * Forecast wind (compass point) and speed for the next sit, e.g. from
   * usePropertyToday's verdict. Stands are only scored on wind when it's known;
   * a saved "best wind" alone says nothing about today.
   */
  sitWind?: string;
  sitWindSpeed?: string;
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
  sitWind,
  sitWindSpeed,
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
  const nearbyActivity = getNearbyCameraActivity({ stands, cameras, cameraChecks, pins, now });
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
      nearbyActivity,
      cameraSummary,
      photoRecords,
      now,
      sitWind,
      sitWindSpeed,
    }),
    standsNotHuntedRecently: getStandsNotHuntedRecently({
      propertyId: property.id,
      standSummaries,
      now,
    }),
    standsWithRecentCameraActivity: getStandsWithRecentCameraActivity({
      propertyId: property.id,
      stands,
      nearbyActivity,
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
  nearbyActivity,
  cameraSummary,
  photoRecords,
  now,
  sitWind,
  sitWindSpeed,
}: {
  propertyId: string;
  standSummaries: StandSummary[];
  nearbyActivity: Map<string, PlannerCameraActivity>;
  cameraSummary: ReturnType<typeof getCameraIntelligenceSummary>;
  photoRecords: PhotoRecord[];
  now: Date;
  sitWind?: string;
  sitWindSpeed?: string;
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

      // Score the stand against the forecast wind for the next sit, not just
      // for having a "best wind" saved.
      if (stand.bestWinds.trim() || stand.avoidWinds.trim()) {
        const wind = sitWind?.trim() ? getStandWindCheck(stand, sitWind, sitWindSpeed) : null;
        if (!wind || wind.status === "unknown") {
          if (stand.bestWinds.trim()) {
            reasons.push(`Best on ${stand.bestWinds} — next sit's wind not loaded`);
          }
        } else if (wind.status === "good") {
          score += 3;
          reasons.push(`${wind.label} for the next sit`);
        } else if (wind.status === "avoid") {
          score -= 4;
          reasons.push(`${wind.label} for the next sit`);
        } else {
          reasons.push(wind.calm ? "Light & variable wind for the next sit" : `${wind.label} for the next sit`);
        }
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

      // Only a camera actually near this stand (by map location) counts.
      const activity = nearbyActivity.get(stand.id);
      if (activity) {
        score += 2;
        reasons.push(
          `Deer on ${activity.cameraName} (${activity.yards} yd) ${formatCameraCheckDate(activity.date)}`,
        );
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
  nearbyActivity,
}: {
  propertyId: string;
  stands: Stand[];
  nearbyActivity: Map<string, PlannerCameraActivity>;
}): HuntPlannerItem[] {
  return stands
    .flatMap((stand) => {
      const activity = nearbyActivity.get(stand.id);
      return activity ? [{ stand, activity }] : [];
    })
    .sort(
      (left, right) =>
        dateInputTime(right.activity.date) - dateInputTime(left.activity.date) ||
        left.activity.yards - right.activity.yards,
    )
    .slice(0, 4)
    .map(({ stand, activity }) => ({
      id: stand.id,
      title: stand.name,
      detail: `${activity.cameraName} (${activity.yards} yd away) had deer activity on ${formatCameraCheckDate(activity.date)}.`,
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
      detail: `${check.bucks} ${check.bucks === 1 ? "buck" : "bucks"} on ${formatCameraCheckDate(check.date)}.`,
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
  yards: number;
};

/**
 * Per stand: the most recent deer check (last RECENT_CAMERA_DAYS days) on a
 * camera within 800 yd of it, by map location. Stands or cameras without a
 * location get nothing — no "activity nearby" claim we can't back up.
 */
export function getNearbyCameraActivity({
  stands,
  cameras,
  cameraChecks,
  pins,
  now,
}: {
  stands: Stand[];
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  pins: MapPin[];
  now: Date;
}): Map<string, PlannerCameraActivity> {
  const latestByCamera = new Map<string, CameraCheck>();
  for (const check of cameraChecks) {
    if (check.bucks + check.does + check.fawns <= 0) continue;
    if (daysSince(check.date, now) > RECENT_CAMERA_DAYS) continue;
    const current = latestByCamera.get(check.cameraId);
    if (!current || dateInputTime(check.date) > dateInputTime(current.date)) {
      latestByCamera.set(check.cameraId, check);
    }
  }

  const out = new Map<string, PlannerCameraActivity>();
  if (latestByCamera.size === 0) return out;

  for (const stand of stands) {
    const point = standPoint(stand, pins);
    if (!point) continue;
    let best: PlannerCameraActivity | null = null;
    for (const { camera, yards } of camerasNear(point, cameras)) {
      const check = latestByCamera.get(camera.id);
      if (!check) continue;
      if (!best || dateInputTime(check.date) > dateInputTime(best.date)) {
        best = { cameraName: camera.name, date: check.date, yards };
      }
    }
    if (best) out.set(stand.id, best);
  }
  return out;
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

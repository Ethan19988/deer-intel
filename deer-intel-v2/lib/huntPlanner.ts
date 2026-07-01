import {
  formatCameraCheckDate,
  sortCameraChecksChronologically,
} from "@/lib/cameraChecks";
import { formatHuntDate, formatHuntTimeRange, sortHuntsChronologically } from "@/lib/hunts";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import type { Property } from "@/types/property";

export type PlannerCameraActivity = {
  id: string;
  cameraName: string;
  propertyName: string;
  description: string;
  dateLabel: string;
  time: number;
};

export type PlannerRecommendation = {
  property: Property | null;
  reason: string;
  scoreLabel: string;
};

export type PlannerLastHunt = {
  hunt: HuntLogEntry | null;
  propertyName: string;
  detail: string;
};

export type HuntPlannerSummary = {
  recommendedProperty: PlannerRecommendation;
  recentCameraActivity: PlannerCameraActivity[];
  lastHunt: PlannerLastHunt;
};

export function getHuntPlannerSummary(
  state: DeerIntelState,
): HuntPlannerSummary {
  return {
    recommendedProperty: getRecommendedProperty(state),
    recentCameraActivity: getRecentCameraActivity(state),
    lastHunt: getLastHunt(state),
  };
}

function getRecommendedProperty(state: DeerIntelState): PlannerRecommendation {
  if (state.properties.length === 0) {
    return {
      property: null,
      reason: "Add a property to start building hunt recommendations.",
      scoreLabel: "No data",
    };
  }

  const scoredProperties = state.properties
    .map((property) => {
      const cameras = state.cameras.filter(
        (camera) => camera.propertyId === property.id,
      );
      const stands = state.stands.filter(
        (stand) => stand.propertyId === property.id,
      );
      const hunts = state.hunts.filter((hunt) => hunt.propertyId === property.id);
      const checks = state.cameraChecks.filter(
        (check) => check.propertyId === property.id,
      );

      return {
        property,
        score:
          cameras.length * 2 +
          stands.length * 2 +
          hunts.length * 4 +
          checks.length * 3,
        cameraCount: cameras.length,
        standCount: stands.length,
        huntCount: hunts.length,
        checkCount: checks.length,
      };
    })
    .sort((left, right) => right.score - left.score);

  const selectedProperty =
    scoredProperties.find(
      (item) => item.property.id === state.selectedPropertyId,
    ) ?? scoredProperties[0];
  const topProperty =
    scoredProperties[0].score > 0 ? scoredProperties[0] : selectedProperty;

  return {
    property: topProperty.property,
    reason:
      topProperty.score > 0
        ? [
            `${topProperty.cameraCount} cameras`,
            `${topProperty.standCount} stands`,
            `${topProperty.huntCount} hunts`,
            `${topProperty.checkCount} camera checks`,
          ].join(" / ")
        : "Starter pick until weather and AI recommendations are ready.",
    scoreLabel: topProperty.score > 0 ? "Saved Data" : "Placeholder",
  };
}

function getRecentCameraActivity(
  state: DeerIntelState,
): PlannerCameraActivity[] {
  const checkActivity = sortCameraChecksChronologically(state.cameraChecks).map(
    (check) => {
      const camera = findCamera(state.cameras, check.cameraId);
      const property = findProperty(state.properties, check.propertyId);

      return {
        id: check.id,
        cameraName: camera?.name ?? "Camera Site",
        propertyName: property?.name ?? "Unknown property",
        description: cameraCheckDescription(check),
        dateLabel: formatCameraCheckDate(check.date),
        time: activityTime(check.date),
      };
    },
  );

  const cameraActivity = state.cameras
    .map((camera) => {
      const date = camera.lastTransmission || camera.lastChecked;
      const property = findProperty(state.properties, camera.propertyId);

      return {
        id: camera.id,
        cameraName: camera.name,
        propertyName: property?.name ?? "Unknown property",
        description:
          camera.cameraType === "Cellular"
            ? "Cellular camera details saved."
            : "Camera site details saved.",
        dateLabel: formatCameraCheckDate(date),
        time: activityTime(date),
      };
    })
    .filter((activity) => activity.time > 0);

  return [...checkActivity, ...cameraActivity]
    .sort((left, right) => right.time - left.time)
    .slice(0, 4);
}

function getLastHunt(state: DeerIntelState): PlannerLastHunt {
  const lastHunt = sortHuntsChronologically(state.hunts).at(-1) ?? null;

  if (!lastHunt) {
    return {
      hunt: null,
      propertyName: "No hunts yet",
      detail: "Log a hunt to start building field history.",
    };
  }

  const property = findProperty(state.properties, lastHunt.propertyId);

  return {
    hunt: lastHunt,
    propertyName: property?.name ?? "Unknown property",
    detail: formatHuntTimeRange(lastHunt),
  };
}

function findCamera(cameras: Camera[], cameraId: string) {
  return cameras.find((camera) => camera.id === cameraId);
}

function findProperty(properties: Property[], propertyId: string) {
  return properties.find((property) => property.id === propertyId);
}

function cameraCheckDescription(check: CameraCheck) {
  const deerSeen = check.bucks + check.does + check.fawns;

  if (deerSeen > 0) return `${deerSeen} deer seen on this check.`;
  if (check.turkeys > 0) return `${check.turkeys} turkeys seen on this check.`;
  if (check.bears > 0 || check.coyotes > 0) {
    return "Predator activity noted on this check.";
  }

  return "Camera check saved.";
}

function activityTime(date: string | undefined) {
  if (!date) return 0;

  const time = Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

export function plannerHuntDate(hunt: HuntLogEntry | null) {
  return hunt ? formatHuntDate(hunt.date) : "No hunt logged";
}

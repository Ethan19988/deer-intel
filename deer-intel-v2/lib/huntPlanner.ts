import {
  formatCameraCheckDate,
  sortCameraChecksChronologically,
} from "@/lib/cameraChecks";
import { formatHuntDate, formatHuntTimeRange, sortHuntsChronologically } from "@/lib/hunts";
import type { ForecastDay } from "@/lib/liveWeather";
import { getStandWindCheck } from "@/lib/standWind";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

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

  return [...checkActivity]
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

// One ranked day in the "best window" outlook: the wind, whether a front is
// passing, and which of your stands the wind favors. Deliberately day-grained —
// the free daily forecast is daily, so inventing AM/PM differences would be
// false precision. The prime sits within a good day are still first and last
// light, which the panel says.
export type HuntWindow = {
  date: string;
  dayLabel: string;
  windCompass: string | null;
  isFront: boolean;
  goodStandNames: string[];
  score: number;
  reasons: string[];
};

/** Pull the leading compass point out of a day's wind string ("NW 8 mph"). */
export function parseWindCompass(wind: string): string | null {
  const match = /^([NSEW]{1,3})/i.exec(wind.trim());
  return match ? match[1].toUpperCase() : null;
}

// Scoring weights. A falling barometer (front) is the strongest single movement
// trigger, so it outweighs a lone wind match; two good stands caps the wind
// contribution so a property with many stands doesn't drown out the front.
const FRONT_BONUS = 2;
const PER_GOOD_STAND = 1.5;
const MAX_GOOD_STAND_BONUS = 3;
const BLOWOUT_PENALTY = 1;

export function buildHuntWindows(
  days: ForecastDay[],
  stands: Stand[],
): HuntWindow[] {
  return days
    .map((day) => {
      const windCompass = parseWindCompass(day.wind);
      const good = windCompass
        ? stands.filter(
            (stand) => getStandWindCheck(stand, windCompass).status === "good",
          )
        : [];
      const avoid = windCompass
        ? stands.filter(
            (stand) => getStandWindCheck(stand, windCompass).status === "avoid",
          )
        : [];
      const isFront = day.pressureTrend === "falling";

      let score = 1;
      const reasons: string[] = [];

      score += Math.min(good.length * PER_GOOD_STAND, MAX_GOOD_STAND_BONUS);

      if (isFront) {
        score += FRONT_BONUS;
        reasons.push("front passing — movement likely");
      }

      if (good.length > 0 && windCompass) {
        reasons.push(
          `${windCompass} wind favors ${good.length} stand${
            good.length === 1 ? "" : "s"
          }`,
        );
      } else if (stands.length > 0 && avoid.length > 0 && good.length === 0) {
        score -= BLOWOUT_PENALTY;
        reasons.push(`${windCompass ?? "wind"} is wrong for your stands`);
      }

      return {
        date: day.date,
        dayLabel: day.label,
        windCompass,
        isFront,
        goodStandNames: good.map((stand) => stand.name).slice(0, 3),
        score,
        reasons,
      };
    })
    .sort((a, b) => b.score - a.score || a.date.localeCompare(b.date));
}

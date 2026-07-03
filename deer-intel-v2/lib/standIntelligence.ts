import { deerSeenSummary, formatHuntDate, sortHuntsChronologically } from "@/lib/hunts";
import { formatCameraCheckDate } from "@/lib/cameraChecks";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

const RECENT_HUNT_DAYS = 21;
const RECENT_CAMERA_ACTIVITY_DAYS = 14;

export type StandInsight = {
  title: string;
  detail: string;
};

export type StandRecommendation = {
  title: string;
  detail: string;
  tone: "default" | "success" | "warning";
};

export type RelatedCameraSite = {
  id: string;
  name: string;
  status: string;
  detail: string;
};

export type StandRecentHunt = {
  id: string;
  title: string;
  detail: string;
};

export type StandIntelligenceSummary = {
  hasWindData: boolean;
  hasHuntHistory: boolean;
  hasCameraActivity: boolean;
  hasRelatedCameras: boolean;
  hasAccessNotes: boolean;
  bestWind: StandInsight;
  lastHunted: StandInsight;
  recentDeerActivity: StandInsight;
  accessPlan: StandInsight;
  pressureNotes: StandInsight;
  successHistory: StandInsight;
  relatedCameraSites: RelatedCameraSite[];
  recentHunts: StandRecentHunt[];
  recommendations: StandRecommendation[];
};

type StandIntelligenceInput = {
  stand: Stand;
  propertyId: string;
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
  now?: Date;
};

export function getStandIntelligenceSummary({
  stand,
  propertyId,
  cameras,
  cameraChecks,
  hunts,
  pins,
  now = new Date(),
}: StandIntelligenceInput): StandIntelligenceSummary {
  const propertyCameras = cameras.filter(
    (camera) => camera.propertyId === propertyId,
  );
  const propertyCameraChecks = cameraChecks.filter(
    (check) => check.propertyId === propertyId,
  );
  const standHunts = getStandHunts({ stand, propertyId, hunts });
  const chronologicalHunts = sortHuntsChronologically(standHunts);
  const latestHunt = chronologicalHunts.at(-1);
  const latestHuntDays = latestHunt
    ? daysSince(latestHunt.date, now)
    : null;
  const recentHunts = chronologicalHunts
    .slice(-3)
    .reverse()
    .map((hunt) => ({
      id: hunt.id,
      title: formatHuntDate(hunt.date),
      detail: `${deerSeenSummary(hunt)}. ${hunt.windDirection || "Wind not set"}.`,
    }));
  const latestCameraActivity = getLatestCameraActivity({
    cameraChecks: propertyCameraChecks,
    cameras: propertyCameras,
  });
  const relatedCameraSites = getRelatedCameraSites({
    cameras: propertyCameras,
    cameraChecks: propertyCameraChecks,
  });
  const hasWindData = Boolean(stand.bestWinds.trim() || stand.avoidWinds.trim());
  const hasAccessNotes = Boolean(
    stand.accessRouteNotes.trim() || stand.exitRouteNotes.trim(),
  );
  const bestWind = getBestWindInsight(stand);
  const lastHunted = getLastHuntedInsight(latestHunt, latestHuntDays);
  const recentDeerActivity = getRecentDeerActivityInsight(
    latestCameraActivity,
    now,
  );
  const accessPlan = getAccessPlanInsight(stand);
  const pressureNotes = getPressureNotes({
    stand,
    standHunts,
    latestHuntDays,
    pins,
  });
  const successHistory = getSuccessHistory(standHunts);
  const recommendations = getRecommendations({
    stand,
    hasWindData,
    latestHuntDays,
    latestCameraActivity,
    now,
  });

  return {
    hasWindData,
    hasHuntHistory: standHunts.length > 0,
    hasCameraActivity: propertyCameraChecks.length > 0,
    hasRelatedCameras: relatedCameraSites.length > 0,
    hasAccessNotes,
    bestWind,
    lastHunted,
    recentDeerActivity,
    accessPlan,
    pressureNotes,
    successHistory,
    relatedCameraSites,
    recentHunts,
    recommendations,
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

function getBestWindInsight(stand: Stand): StandInsight {
  if (stand.bestWinds.trim()) {
    return {
      title: stand.bestWinds,
      detail: `Good for ${stand.bestWinds} wind.`,
    };
  }

  if (stand.avoidWinds.trim()) {
    return {
      title: "Avoid winds recorded",
      detail: `Avoid ${stand.avoidWinds} until a best wind is added.`,
    };
  }

  return {
    title: "No wind data recorded yet",
    detail: "Add best winds to make this stand easier to choose in the field.",
  };
}

function getLastHuntedInsight(
  latestHunt: HuntLogEntry | undefined,
  latestHuntDays: number | null,
): StandInsight {
  if (!latestHunt) {
    return {
      title: "No hunts logged yet",
      detail: "Log a hunt from this stand to start tracking pressure.",
    };
  }

  return {
    title: formatHuntDate(latestHunt.date),
    detail:
      latestHuntDays === null
        ? "Latest hunt saved for this stand."
        : `Last hunted ${latestHuntDays} days ago.`,
  };
}

function getRecentDeerActivityInsight(
  latestCameraActivity: CameraActivity | null,
  now: Date,
): StandInsight {
  if (!latestCameraActivity) {
    return {
      title: "No camera activity nearby",
      detail: "Camera checks from related property camera sites will show here.",
    };
  }

  const activityDays = daysSince(latestCameraActivity.date, now);
  const deerTotal =
    latestCameraActivity.check.bucks +
    latestCameraActivity.check.does +
    latestCameraActivity.check.fawns;
  const activityAge =
    activityDays === null ? "Date not set" : `${activityDays} days ago`;

  return {
    title: latestCameraActivity.cameraName,
    detail: `${deerTotal} deer on ${formatCameraCheckDate(
      latestCameraActivity.date,
    )}. ${activityAge}.`,
  };
}

function getAccessPlanInsight(stand: Stand): StandInsight {
  if (stand.accessRouteNotes.trim() || stand.exitRouteNotes.trim()) {
    return {
      title: "Access notes saved",
      detail: [
        stand.accessRouteNotes ? `In: ${stand.accessRouteNotes}` : "",
        stand.exitRouteNotes ? `Out: ${stand.exitRouteNotes}` : "",
      ]
        .filter(Boolean)
        .join(" "),
    };
  }

  return {
    title: "No access notes yet",
    detail: "Add entry and exit notes to make this stand easier to hunt cleanly.",
  };
}

function getPressureNotes({
  stand,
  standHunts,
  latestHuntDays,
  pins,
}: {
  stand: Stand;
  standHunts: HuntLogEntry[];
  latestHuntDays: number | null;
  pins: MapPin[];
}): StandInsight {
  const explicitPressureNotes = [
    stand.notes,
    ...standHunts.map((hunt) => hunt.notes),
    ...pins
      .filter((pin) => pin.propertyId === stand.propertyId)
      .map((pin) => pin.notes),
  ]
    .filter((note) => note.toLowerCase().includes("pressure"))
    .at(0);

  if (explicitPressureNotes) {
    return {
      title: "Pressure note found",
      detail: explicitPressureNotes,
    };
  }

  if (latestHuntDays === null) {
    return {
      title: "Pressure unknown",
      detail: "No hunts logged from this stand yet.",
    };
  }

  if (latestHuntDays > RECENT_HUNT_DAYS) {
    return {
      title: "Has not been hunted recently",
      detail: `Last hunt was ${latestHuntDays} days ago.`,
    };
  }

  return {
    title: "Recently hunted",
    detail: `Last hunt was ${latestHuntDays} days ago. Consider pressure before going back.`,
  };
}

function getSuccessHistory(standHunts: HuntLogEntry[]): StandInsight {
  if (standHunts.length === 0) {
    return {
      title: "No hunt history yet",
      detail: "Log hunts to track deer seen, shot chances, and harvests.",
    };
  }

  const totals = standHunts.reduce(
    (summary, hunt) => ({
      bucks: summary.bucks + hunt.bucks,
      does: summary.does + hunt.does,
      fawns: summary.fawns + hunt.fawns,
      shotOpportunities:
        summary.shotOpportunities + (hunt.shotOpportunity ? 1 : 0),
      harvests: summary.harvests + (hunt.harvest ? 1 : 0),
    }),
    { bucks: 0, does: 0, fawns: 0, shotOpportunities: 0, harvests: 0 },
  );

  return {
    title: `${standHunts.length} ${standHunts.length === 1 ? "hunt" : "hunts"}`,
    detail: `${totals.bucks} bucks / ${totals.does} does / ${totals.fawns} fawns. ${totals.shotOpportunities} shot chances, ${totals.harvests} harvests.`,
  };
}

function getRecommendations({
  stand,
  hasWindData,
  latestHuntDays,
  latestCameraActivity,
  now,
}: {
  stand: Stand;
  hasWindData: boolean;
  latestHuntDays: number | null;
  latestCameraActivity: CameraActivity | null;
  now: Date;
}): StandRecommendation[] {
  const recommendations: StandRecommendation[] = [];

  if (stand.bestWinds.trim()) {
    recommendations.push({
      title: `Good for ${stand.bestWinds} wind`,
      detail: "Best wind directions are recorded for this stand.",
      tone: "success",
    });
  } else if (!hasWindData) {
    recommendations.push({
      title: "No wind data recorded yet",
      detail: "Add best winds before relying on this stand recommendation.",
      tone: "warning",
    });
  }

  if (latestHuntDays === null) {
    recommendations.push({
      title: "No hunts logged yet",
      detail: "Hunt history will help Deer Intel understand pressure and results.",
      tone: "default",
    });
  } else if (latestHuntDays > RECENT_HUNT_DAYS) {
    recommendations.push({
      title: "Has not been hunted recently",
      detail: "This stand may have lower recent pressure.",
      tone: "success",
    });
  }

  const latestActivityDays = latestCameraActivity
    ? daysSince(latestCameraActivity.date, now)
    : null;

  if (
    latestCameraActivity &&
    latestActivityDays !== null &&
    latestActivityDays <= RECENT_CAMERA_ACTIVITY_DAYS
  ) {
    recommendations.push({
      title: "Recent camera activity nearby",
      detail: `${latestCameraActivity.cameraName} had deer activity recently.`,
      tone: "success",
    });
  }

  return recommendations;
}

type CameraActivity = {
  cameraName: string;
  date: string;
  check: CameraCheck;
};

function getLatestCameraActivity({
  cameraChecks,
  cameras,
}: {
  cameraChecks: CameraCheck[];
  cameras: Camera[];
}): CameraActivity | null {
  const cameraNameById = new Map(
    cameras.map((camera) => [camera.id, camera.name]),
  );
  const latestCheck = [...cameraChecks]
    .filter((check) => check.bucks + check.does + check.fawns > 0)
    .sort((left, right) => dateInputTime(right.date) - dateInputTime(left.date))[0];

  if (!latestCheck) return null;

  return {
    cameraName: cameraNameById.get(latestCheck.cameraId) ?? "Camera site",
    date: latestCheck.date,
    check: latestCheck,
  };
}

function getRelatedCameraSites({
  cameras,
  cameraChecks,
}: {
  cameras: Camera[];
  cameraChecks: CameraCheck[];
}): RelatedCameraSite[] {
  return cameras.map((camera) => {
    const latestCheck = cameraChecks
      .filter((check) => check.cameraId === camera.id)
      .sort((left, right) => dateInputTime(right.date) - dateInputTime(left.date))[0];

    return {
      id: camera.id,
      name: camera.name,
      status: camera.status,
      detail: latestCheck
        ? `Latest check: ${formatCameraCheckDate(latestCheck.date)}`
        : "No checks saved yet.",
    };
  });
}

function daysSince(date: string | undefined, now: Date) {
  const time = dateInputTime(date);

  if (time <= 0) return null;

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

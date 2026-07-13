import type { Camera } from "@/types/camera";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Property } from "@/types/property";

export type ActivityItem = {
  title: string;
  description: string;
  dateLabel: string;
  time: number;
};

export type AiConfidence = {
  label: "High" | "Building" | "Learning";
  description: string;
};

type KnowledgeScoreInput = {
  property: Property;
  cameraCount: number;
  standCount: number;
  huntCount: number;
  deerProfileCount: number;
  pinCount: number;
};

export function getKnowledgeScore({
  property,
  cameraCount,
  standCount,
  huntCount,
  deerProfileCount,
  pinCount,
}: KnowledgeScoreInput) {
  const propertyNotesScore = property.notes.trim() ? 15 : 0;
  const cameraScore = Math.min(cameraCount * 10, 20);
  const standScore = Math.min(standCount * 10, 20);
  const huntScore = Math.min(huntCount * 10, 20);
  const deerScore = Math.min(deerProfileCount * 10, 10);
  const mapScore = Math.min(pinCount * 3, 15);

  return Math.min(
    100,
    20 +
      propertyNotesScore +
      cameraScore +
      standScore +
      huntScore +
      deerScore +
      mapScore,
  );
}

export function getAiConfidence(knowledgeScore: number): AiConfidence {
  if (knowledgeScore >= 75) {
    return {
      label: "High",
      description:
        "Enough property data is forming for stronger future AI guidance.",
    };
  }

  if (knowledgeScore >= 45) {
    return {
      label: "Building",
      description:
        "Add hunts, stand rules, and camera history to improve recommendations.",
    };
  }

  return {
    label: "Learning",
    description:
      "The assistant needs more property data before recommendations are reliable.",
  };
}

export function getRecentActivity({
  pins,
  hunts,
}: {
  pins: MapPin[];
  hunts: HuntLogEntry[];
}): ActivityItem[] {
  const pinActivity = pins.map((pin) => ({
    title: `${pin.type} pin added`,
    description: pin.notes || "Map intelligence saved.",
    dateLabel: formatActivityDate(pin.createdAt),
    time: activityTime(pin.createdAt),
  }));
  const huntActivity = hunts.map((hunt) => ({
    title: "Hunt logged",
    description:
      [hunt.standName, hunt.harvest ? "Harvest" : "", hunt.windDirection]
        .filter(Boolean)
        .join(" - ") ||
      hunt.notes ||
      "Hunt entry saved.",
    dateLabel: formatActivityDate(hunt.date),
    time: activityTime(hunt.date),
  }));

  return [...pinActivity, ...huntActivity]
    .sort((left, right) => right.time - left.time)
    .slice(0, 5);
}

export function activeCameraCount(cameras: Camera[]) {
  return cameras.filter((camera) => camera.status === "Active").length;
}

function activityTime(date: string | undefined) {
  if (!date) return 0;

  const time = Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

function formatActivityDate(date: string | undefined) {
  if (!date) return "No date";

  const time = Date.parse(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

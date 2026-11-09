import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import { cleanPropertyField } from "@/lib/propertyFields";
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
  // Old saves store "No notes yet." for blank notes; that isn't knowledge.
  const propertyNotesScore = cleanPropertyField(property.notes) ? 15 : 0;
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
        "Log sits, stand rules, and camera checks to improve recommendations.",
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
  cameraChecks = [],
  cameras = [],
}: {
  pins: MapPin[];
  hunts: HuntLogEntry[];
  cameraChecks?: CameraCheck[];
  /** Used to name the camera on each check. */
  cameras?: Camera[];
}): ActivityItem[] {
  const pinActivity = pins.map((pin) => ({
    title: `${pin.type} pin added`,
    description: pin.notes || "Map intelligence saved.",
    dateLabel: formatActivityDate(pin.createdAt),
    time: activityTime(pin.createdAt),
  }));
  const huntActivity = hunts.map((hunt) => ({
    title: "Sit logged",
    description:
      [hunt.standName, hunt.harvest ? "Harvest" : "", hunt.windDirection]
        .filter(Boolean)
        .join(" - ") ||
      hunt.notes ||
      "Sit saved.",
    dateLabel: formatActivityDate(hunt.date),
    time: activityTime(hunt.date),
  }));
  const cameraNames = new Map(cameras.map((camera) => [camera.id, camera.name]));
  const checkActivity = cameraChecks.map((check) => ({
    title: "Camera checked",
    description:
      [cameraNames.get(check.cameraId), deerCountLabel(check), check.notes]
        .filter(Boolean)
        .join(" - ") || "Camera check saved.",
    dateLabel: formatActivityDate(check.date),
    time: activityTime(check.date),
  }));

  return [...pinActivity, ...huntActivity, ...checkActivity]
    .sort((left, right) => right.time - left.time)
    .slice(0, 5);
}

function deerCountLabel(check: Pick<CameraCheck, "bucks" | "does" | "fawns">) {
  return [
    plural(check.bucks, "buck", "bucks"),
    plural(check.does, "doe", "does"),
    plural(check.fawns, "fawn", "fawns"),
  ]
    .filter(Boolean)
    .join(", ");
}

function plural(count: number, one: string, many: string) {
  const value = Number.isFinite(count) ? Math.max(0, Math.floor(count)) : 0;

  return value === 0 ? "" : `${value} ${value === 1 ? one : many}`;
}

export function activeCameraCount(cameras: Camera[]) {
  return cameras.filter((camera) => camera.status === "Active").length;
}

// Hunt dates are stored date-only ("YYYY-MM-DD"). Date.parse reads those as
// UTC midnight, which shows a day early in US time zones; read them as local.
function parseActivityDate(date: string): number {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);

  return dateOnly
    ? new Date(
        Number(dateOnly[1]),
        Number(dateOnly[2]) - 1,
        Number(dateOnly[3]),
      ).getTime()
    : Date.parse(date);
}

function activityTime(date: string | undefined) {
  if (!date) return 0;

  const time = parseActivityDate(date);

  return Number.isNaN(time) ? 0 : time;
}

function formatActivityDate(date: string | undefined) {
  if (!date) return "No date";

  const time = parseActivityDate(date);

  if (Number.isNaN(time)) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";
import type { Stand } from "@/types/stand";

export type PropertyTimelineEventIcon =
  | "camera"
  | "photo"
  | "hunt"
  | "asset"
  | "stand";

export type PropertyTimelineEvent = {
  id: string;
  icon: PropertyTimelineEventIcon;
  title: string;
  dateLabel: string;
  description: string;
  time: number;
};

export function getPropertyTimelineEvents({
  state,
  propertyId,
}: {
  state: DeerIntelState;
  propertyId: string;
}): PropertyTimelineEvent[] {
  const propertyCameras = state.cameras.filter(
    (camera) => camera.propertyId === propertyId,
  );
  const propertyStands = state.stands.filter(
    (stand) => stand.propertyId === propertyId,
  );
  const propertyChecks = state.cameraChecks.filter(
    (check) => check.propertyId === propertyId,
  );
  const propertyPhotos = state.photoRecords.filter(
    (photo) => photo.propertyId === propertyId,
  );
  const propertyHunts = state.hunts.filter(
    (hunt) => hunt.propertyId === propertyId,
  );

  return [
    ...propertyChecks.map((check) =>
      cameraCheckEvent(check, propertyCameras),
    ),
    ...propertyPhotos.map((photo) =>
      photoRecordEvent(photo, propertyCameras),
    ),
    ...propertyHunts.map(huntEvent),
    ...propertyStands.map(standAssetEvent),
  ].sort((left, right) => right.time - left.time);
}

function cameraCheckEvent(
  check: CameraCheck,
  propertyCameras: Camera[],
): PropertyTimelineEvent {
  const camera = propertyCameras.find((item) => item.id === check.cameraId);
  const deerSeen = check.bucks + check.does + check.fawns;
  const wildlifeParts = [
    deerSeen > 0 ? `${deerSeen} deer` : "",
    check.turkeys > 0 ? `${check.turkeys} turkeys` : "",
    check.bears > 0 ? `${check.bears} bears` : "",
    check.coyotes > 0 ? `${check.coyotes} coyotes` : "",
  ].filter(Boolean);

  return {
    id: `camera-check-${check.id}`,
    icon: "camera",
    title: "Camera check",
    dateLabel: formatTimelineDate(check.date),
    description:
      `${camera?.name ?? "Camera site"}: ${
        wildlifeParts.join(", ") || check.notes || "check saved"
      }`,
    time: timelineTime(check.date),
  };
}

function photoRecordEvent(
  photo: PhotoRecord,
  propertyCameras: Camera[],
): PropertyTimelineEvent {
  const camera = propertyCameras.find((item) => item.id === photo.cameraSiteId);
  const buckText = photo.buckName ? ` - ${photo.buckName}` : "";

  return {
    id: `photo-${photo.id}`,
    icon: "photo",
    title: "Photo record",
    dateLabel: formatTimelineDate(photo.photoDate),
    description: `${camera?.name ?? "Camera site"}: ${photo.species}${buckText} (${photo.fileName})`,
    time: timelineTime(photo.photoDate || photo.createdAt),
  };
}

function huntEvent(hunt: HuntLogEntry): PropertyTimelineEvent {
  const deerSeen = hunt.bucks + hunt.does + hunt.fawns;
  const outcome = hunt.harvest
    ? "harvest"
    : hunt.shotOpportunity
      ? "shot opportunity"
      : "hunt logged";

  return {
    id: `hunt-${hunt.id}`,
    icon: "hunt",
    title: "Hunt logged",
    dateLabel: formatTimelineDate(hunt.date),
    description: `${hunt.standName || "Stand"}: ${outcome}, ${deerSeen} deer seen`,
    time: timelineTime(
      hunt.startTime ? `${hunt.date}T${hunt.startTime}` : hunt.date,
    ),
  };
}

function standAssetEvent(stand: Stand): PropertyTimelineEvent {
  return {
    id: `stand-asset-${stand.id}`,
    icon: "stand",
    title: "Stand added",
    dateLabel: "No date",
    description: `${stand.name} saved as a ${stand.standType.toLowerCase()} stand.`,
    time: 0,
  };
}

function formatTimelineDate(date: string | undefined) {
  if (!date) return "No date";

  const time = timelineTime(date);

  if (time === 0) return date;

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(time);
}

function timelineTime(date: string | undefined) {
  if (!date) return 0;

  const dateOnlyMatch = /^(\d{4})-(\d{2})-(\d{2})$/.exec(date);
  const time = dateOnlyMatch
    ? new Date(
        Number(dateOnlyMatch[1]),
        Number(dateOnlyMatch[2]) - 1,
        Number(dateOnlyMatch[3]),
      ).getTime()
    : Date.parse(date);

  return Number.isNaN(time) ? 0 : time;
}

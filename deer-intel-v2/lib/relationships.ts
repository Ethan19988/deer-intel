import {
  formatCameraCheckDate,
  sortCameraChecksChronologically,
} from "@/lib/cameraChecks";
import { formatHuntDate, sortHuntsChronologically } from "@/lib/hunts";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { HuntLogEntry } from "@/types/hunt";
import type { Stand } from "@/types/stand";

export type RelationshipCardData = {
  id: string;
  title: string;
  description: string;
  badge: string;
  href?: string;
};

export type RelationshipGroupData = {
  id: string;
  title: string;
  emptyDescription: string;
  relationships: RelationshipCardData[];
};

type CameraRelationshipInput = {
  propertyId: string;
  camera: Camera;
  cameras: Camera[];
  stands: Stand[];
  checks: CameraCheck[];
};

type StandRelationshipInput = {
  propertyId: string;
  stand: Stand;
  cameras: Camera[];
  stands: Stand[];
  hunts: HuntLogEntry[];
};

export function getCameraRelationshipGroups({
  propertyId,
  camera,
  cameras,
  stands,
  checks,
}: CameraRelationshipInput): RelationshipGroupData[] {
  const relatedStands = stands.filter((stand) => stand.propertyId === propertyId);
  const relatedCameras = cameras.filter(
    (item) => item.propertyId === propertyId && item.id !== camera.id,
  );
  const latestCheck = sortCameraChecksChronologically(checks).at(-1);

  return [
    {
      id: "camera-checks",
      title: "Camera Checks",
      emptyDescription: "No camera checks saved yet.",
      relationships: [
        {
          id: `camera-checks-${camera.id}`,
          title: `${checks.length} ${checks.length === 1 ? "check" : "checks"}`,
          description: latestCheck
            ? `Latest check: ${formatCameraCheckDate(latestCheck.date)}`
            : "Save checks to build camera history for this site.",
          badge: "Checks",
        },
      ],
    },
    {
      id: "nearby-stands",
      title: "Nearby Stands",
      emptyDescription: "No stands saved on this property yet.",
      relationships: relatedStands.map((stand) => ({
        id: stand.id,
        href: `/properties/${propertyId}/assets/${stand.id}`,
        title: stand.name,
        description: standRelationshipDescription(stand),
        badge: stand.standType,
      })),
    },
    {
      id: "other-camera-sites",
      title: "Other Camera Sites",
      emptyDescription: "No other camera sites saved on this property yet.",
      relationships: relatedCameras.map((relatedCamera) => ({
        id: relatedCamera.id,
        href: `/properties/${propertyId}/assets/${relatedCamera.id}`,
        title: relatedCamera.name,
        description: cameraRelationshipDescription(relatedCamera),
        badge: relatedCamera.status,
      })),
    },
  ];
}

export function getStandRelationshipGroups({
  propertyId,
  stand,
  cameras,
  stands,
  hunts,
}: StandRelationshipInput): RelationshipGroupData[] {
  const relatedCameras = cameras.filter(
    (camera) => camera.propertyId === propertyId,
  );
  const relatedStands = stands.filter(
    (item) => item.propertyId === propertyId && item.id !== stand.id,
  );
  const chronologicalHunts = sortHuntsChronologically(hunts);
  const latestHunt = chronologicalHunts.at(-1);

  return [
    {
      id: "hunt-history",
      title: "Hunt History",
      emptyDescription: "No hunts logged for this stand yet.",
      relationships: [
        {
          id: `hunts-${stand.id}`,
          href: `/hunt-log?propertyId=${propertyId}&standId=${stand.id}`,
          title: `${hunts.length} ${hunts.length === 1 ? "hunt" : "hunts"}`,
          description: latestHunt
            ? `Latest hunt: ${formatHuntDate(latestHunt.date)}`
            : "Log hunts to connect field history to this stand.",
          badge: "Hunts",
        },
      ],
    },
    {
      id: "nearby-camera-sites",
      title: "Nearby Camera Sites",
      emptyDescription: "No camera sites saved on this property yet.",
      relationships: relatedCameras.map((camera) => ({
        id: camera.id,
        href: `/properties/${propertyId}/assets/${camera.id}`,
        title: camera.name,
        description: cameraRelationshipDescription(camera),
        badge: camera.status,
      })),
    },
    {
      id: "nearby-stands",
      title: "Nearby Stands",
      emptyDescription: "No other stands saved on this property yet.",
      relationships: relatedStands.map((nearbyStand) => ({
        id: nearbyStand.id,
        href: `/properties/${propertyId}/assets/${nearbyStand.id}`,
        title: nearbyStand.name,
        description: standRelationshipDescription(nearbyStand),
        badge: nearbyStand.standType,
      })),
    },
  ];
}

export function cameraRelationshipDescription(camera: Camera) {
  const modelText = [camera.manufacturer, camera.model]
    .filter(Boolean)
    .join(" ");

  return modelText || `${camera.cameraType} trail camera`;
}

export function standRelationshipDescription(stand: Stand) {
  const windText = stand.bestWinds ? `Best on ${stand.bestWinds}` : "";

  return windText || `${stand.standType} stand`;
}

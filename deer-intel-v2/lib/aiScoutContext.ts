import { formatCameraCheckDate } from "@/lib/cameraChecks";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type {
  AiScoutBuckPhotoContext,
  AiScoutCameraCheckContext,
  AiScoutConditions,
  AiScoutDeerProfileContext,
  AiScoutHuntContext,
  AiScoutRequestContext,
  AiScoutStandContext,
} from "@/types/aiScout";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

const MAX_RECENT_HUNTS = 15;
const MAX_RECENT_CAMERA_CHECKS = 15;
const MAX_RECENT_BUCK_PHOTOS = 10;
const MAX_DEER_PROFILES = 20;
const NOTES_CHAR_LIMIT = 240;

export const EMPTY_AI_SCOUT_CONDITIONS: AiScoutConditions = {
  windDirection: "",
  windSpeed: "",
  temperature: "",
  moonPhase: "",
  notes: "",
};

type BuildAiScoutContextInput = {
  property: Property;
  stands: Stand[];
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  photoRecords: PhotoRecord[];
  deerProfiles: DeerProfile[];
  conditions: AiScoutConditions;
};

/**
 * Builds the compact, privacy-conscious payload sent to the AI Scout API route.
 * Only the selected property's own data is included, notes are trimmed, and
 * lists are capped so a single request stays small and inexpensive.
 */
export function buildAiScoutRequestContext({
  property,
  stands,
  cameras,
  cameraChecks,
  hunts,
  photoRecords,
  deerProfiles,
  conditions,
}: BuildAiScoutContextInput): AiScoutRequestContext {
  const cameraNameById = new Map(cameras.map((camera) => [camera.id, camera.name]));

  const standContexts: AiScoutStandContext[] = stands.map((stand) => {
    const standHunts = hunts.filter((hunt) => hunt.standId === stand.id);
    const lastHunt = [...standHunts].sort(
      (left, right) => recordTime(right.date) - recordTime(left.date),
    )[0];

    return {
      name: stand.name,
      standType: stand.standType,
      bestWinds: stand.bestWinds,
      avoidWinds: stand.avoidWinds,
      accessRouteNotes: truncate(stand.accessRouteNotes),
      exitRouteNotes: truncate(stand.exitRouteNotes),
      notes: truncate(stand.notes),
      huntCount: standHunts.length,
      lastHuntDate: lastHunt?.date,
    };
  });

  const recentHunts: AiScoutHuntContext[] = [...hunts]
    .sort((left, right) => recordTime(right.date) - recordTime(left.date))
    .slice(0, MAX_RECENT_HUNTS)
    .map((hunt) => ({
      date: hunt.date,
      standName: hunt.standName,
      windDirection: hunt.windDirection,
      windSpeed: hunt.windSpeed,
      temperature: hunt.temperature,
      weather: hunt.weather,
      moonPhase: hunt.moonPhase,
      bucks: hunt.bucks,
      does: hunt.does,
      fawns: hunt.fawns,
      shotOpportunity: hunt.shotOpportunity,
      harvest: hunt.harvest,
      notes: truncate(hunt.notes),
    }));

  const recentCameraChecks: AiScoutCameraCheckContext[] = [...cameraChecks]
    .sort((left, right) => recordTime(right.date) - recordTime(left.date))
    .slice(0, MAX_RECENT_CAMERA_CHECKS)
    .map((check) => ({
      date: formatCameraCheckDate(check.date),
      cameraName: cameraNameById.get(check.cameraId) ?? "Camera site",
      bucks: check.bucks,
      does: check.does,
      fawns: check.fawns,
      notes: truncate(check.notes),
    }));

  const deerProfileContexts: AiScoutDeerProfileContext[] = deerProfiles
    .slice(0, MAX_DEER_PROFILES)
    .map((profile) => ({
      nickname: profile.nickname,
      estimatedAge: profile.estimatedAge,
      firstSeen: profile.firstSeen,
      lastSeen: profile.lastSeen,
      notes: truncate(profile.notes),
    }));

  const recentBuckPhotos: AiScoutBuckPhotoContext[] = [...photoRecords]
    .filter(
      (photo) =>
        photo.species.trim().toLowerCase().includes("buck") ||
        Boolean(photo.buckName?.trim()),
    )
    .sort((left, right) => recordTime(right.photoDate) - recordTime(left.photoDate))
    .slice(0, MAX_RECENT_BUCK_PHOTOS)
    .map((photo) => ({
      date: photo.photoDate,
      cameraName: cameraNameById.get(photo.cameraSiteId) ?? "Camera site",
      species: photo.species,
      buckName: photo.buckName,
      // The conditions this photo was taken in — captured at import from the
      // photo's stamp or weather history — so the scout can pattern movement
      // against temperature, wind, and moon.
      temperature: photo.weatherSnapshot?.temperature || undefined,
      windDirection: photo.weatherSnapshot?.windDirection || undefined,
      moonPhase: photo.weatherSnapshot?.moonPhase || undefined,
      notes: truncate(photo.notes),
    }));

  return {
    property: {
      name: property.name,
      county: property.county,
      acres: property.acres,
      notes: truncate(property.notes),
    },
    conditions,
    stands: standContexts,
    recentHunts,
    recentCameraChecks,
    deerProfiles: deerProfileContexts,
    recentBuckPhotos,
  };
}

function truncate(value: string) {
  const trimmed = value.trim();

  if (trimmed.length <= NOTES_CHAR_LIMIT) return trimmed;

  return `${trimmed.slice(0, NOTES_CHAR_LIMIT)}…`;
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

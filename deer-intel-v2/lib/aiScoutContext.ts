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
import type { ScoutPick } from "@/lib/terrainMovementData";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import { huntsForStand } from "@/lib/standHunts";
import {
  STAND_BEST_TIME_LABEL,
  STAND_WEAPON_LABEL,
  shotYardsLabel,
  type Stand,
} from "@/types/stand";

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

type StandContextWithDetails = AiScoutStandContext & {
  /** "Morning" / "Evening" / "All day". */
  bestTime?: string;
  setup?: string[];
  /** "Bow" / "Gun" / "Bow & gun". */
  weapon?: string;
  /** e.g. "40 yd" or "200+ yd". */
  maxShot?: string;
  heightFeet?: number;
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
  /** Terrain-predicted spots for this property, if a LiDAR read covers it. */
  scoutPicks?: ScoutPick[];
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
  scoutPicks = [],
}: BuildAiScoutContextInput): AiScoutRequestContext {
  const cameraNameById = new Map(cameras.map((camera) => [camera.id, camera.name]));

  // Optional stand details ride along only when set. The route JSON-stringifies
  // the whole context, so these reach the model as-is.
  const standContexts: StandContextWithDetails[] = stands.map((stand) => {
    const standHunts = huntsForStand(stand, hunts);
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
      ...(stand.bestTime ? { bestTime: STAND_BEST_TIME_LABEL[stand.bestTime] } : {}),
      ...(stand.setup?.length ? { setup: stand.setup } : {}),
      ...(stand.weapon ? { weapon: STAND_WEAPON_LABEL[stand.weapon] } : {}),
      ...(stand.maxShotYards ? { maxShot: shotYardsLabel(stand.maxShotYards) } : {}),
      ...(stand.heightFeet ? { heightFeet: stand.heightFeet } : {}),
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

  // What each buck photo tells the scout beyond the date: behavior, travel
  // heading, how many deer, and the judged age / points. (Extra keys ride
  // along in the JSON the scout reads.)
  type ScoutBuckPhoto = AiScoutBuckPhotoContext & {
    behavior?: string;
    travelDirection?: string;
    deerCount?: number;
    ageClass?: string;
    antlerPoints?: number;
  };
  const recentBuckPhotos: ScoutBuckPhoto[] = [...photoRecords]
    .filter(
      (photo) =>
        photo.species.trim().toLowerCase().includes("buck") ||
        Boolean(photo.buckName?.trim()),
    )
    .sort((left, right) => recordTime(right.photoDate) - recordTime(left.photoDate))
    .slice(0, MAX_RECENT_BUCK_PHOTOS)
    .map((photo) => {
      // A time from the file's modified date or a date-only stamp isn't the
      // shutter time, so the scout only gets the day for those.
      const timeTrusted =
        photo.captureTimeSource !== "file" &&
        photo.captureTimeSource !== "stampDate";

      return {
        date: timeTrusted ? photo.photoDate : photo.photoDate.slice(0, 10),
        cameraName: cameraNameById.get(photo.cameraSiteId) ?? "Camera site",
        species: photo.species,
        buckName: photo.buckName,
        behavior: photo.behavior || undefined,
        travelDirection: photo.travelDirection || undefined,
        deerCount: photo.deerCount,
        ageClass: photo.ageClass,
        antlerPoints: photo.antlerPoints,
        // The conditions this photo was taken in — captured at import from the
        // photo's stamp or weather history — so the scout can pattern movement
        // against temperature, wind, and moon.
        temperature: photo.weatherSnapshot?.temperature || undefined,
        windDirection: photo.weatherSnapshot?.windDirection || undefined,
        moonPhase: photo.weatherSnapshot?.moonPhase || undefined,
        notes: truncate(photo.notes),
      };
    });

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
    terrainPicks: scoutPicks.map((pick) => ({
      kind: pick.kind,
      title: pick.title,
      detail: truncate(pick.reason),
      bestWind: pick.windNote,
    })),
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

"use client";

import { useSyncExternalStore } from "react";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import { normalizeWeatherSnapshot } from "@/lib/weather";
import type { Camera, CameraStatus, CameraType } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { DocumentRecord } from "@/types/document";
import type { HuntLogEntry } from "@/types/hunt";
import { PIN_TYPES, type MapPin, type PinType } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { HuntAreaPoint, Property } from "@/types/property";
import { STAND_TYPES, type Stand, type StandType } from "@/types/stand";
import type { WalkTrack, WalkTrackPoint } from "@/types/walkTrack";

export { PIN_TYPES, PROPERTY_ASSET_PIN_TYPES } from "@/types/mapPin";
export type { DeerIntelState } from "@/types/deerIntelStore";
export type { HuntLogEntry } from "@/types/hunt";
export type { MapPin, PinType } from "@/types/mapPin";
export type { WalkTrack, WalkTrackPoint } from "@/types/walkTrack";

const STORAGE_KEY = "deer-intel:state";
const LEGACY_PROPERTIES_STORAGE_KEY = "deer-intel:properties";

// New accounts start empty — the hunter adds their own properties. Kept as an
// exported constant so seeding, default-state, and cloud-sync logic share one
// source of truth for "what a fresh store looks like".
export const DEFAULT_PROPERTIES: Property[] = [];

// Bumped to 2 so the one-time "drop the old seeded sample properties" migration
// runs once against each existing store, then never again.
const CURRENT_STATE_VERSION = 2 as const;

// The two sample properties every store used to be seeded with (see git history
// of DEFAULT_PROPERTIES). Existing users still carry these; the migration below
// removes them, but only while they remain untouched sample data.
const LEGACY_SEED_PROPERTIES: readonly {
  id: string;
  name: string;
  county: string;
  acres: string;
  notes: string;
}[] = [
  {
    id: "finley-run",
    name: "Finley Run",
    county: "Northern PA",
    acres: "Unknown",
    notes: "Creek bottom, laurel, clear cut, ridge travel.",
  },
  {
    id: "moore-hill-area",
    name: "Moore Hill Area",
    county: "Northern PA",
    acres: "Unknown",
    notes: "Road access, ridges, saddles, old field movement.",
  },
];

const DEFAULT_STATE: DeerIntelState = {
  version: CURRENT_STATE_VERSION,
  properties: DEFAULT_PROPERTIES,
  selectedPropertyId: DEFAULT_PROPERTIES[0]?.id ?? "",
  cameras: [],
  cameraChecks: [],
  stands: [],
  pins: [],
  hunts: [],
  photoRecords: [],
  deerProfiles: [],
  walkTracks: [],
  documents: [],
};

const listeners = new Set<() => void>();

let memoryState: DeerIntelState | null = null;
let cachedStorage:
  | {
      stateRaw: string | null;
      legacyPropertiesRaw: string | null;
      state: DeerIntelState;
    }
  | null = null;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function stringValue(value: unknown, fallback = "") {
  return typeof value === "string" ? value : fallback;
}

function optionalStringValue(value: unknown): string | undefined {
  const text = stringValue(value).trim();

  return text ? text : undefined;
}

function optionalNumberValue(value: unknown): number | undefined {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value !== "string") return undefined;

  const trimmedValue = value.trim();
  if (!trimmedValue) return undefined;

  const parsedValue = Number(trimmedValue);

  return Number.isFinite(parsedValue) ? parsedValue : undefined;
}

// Reject an out-of-range coordinate (e.g. a fat-fingered "5000") so a camera
// can't be stored off-map with a silently-failing weather lookup; an invalid
// value is treated as "not set" rather than clamped to a wrong-but-valid point.
function coordinateInRange(
  value: number | undefined,
  max: number,
): number | undefined {
  if (value === undefined) return undefined;
  return Math.abs(value) <= max ? value : undefined;
}

function countValue(value: unknown): number {
  const parsedValue =
    typeof value === "number"
      ? value
      : typeof value === "string"
        ? Number(value.trim())
        : 0;

  if (!Number.isFinite(parsedValue) || parsedValue < 0) return 0;

  return Math.floor(parsedValue);
}

function booleanValue(value: unknown, fallback = false): boolean {
  if (typeof value === "boolean") return value;
  if (typeof value !== "string") return fallback;

  const normalizedValue = value.trim().toLowerCase();

  if (["true", "yes", "y"].includes(normalizedValue)) return true;
  if (["false", "no", "n"].includes(normalizedValue)) return false;

  return fallback;
}

function normalizeProperty(value: unknown): Property | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const name = stringValue(value.name).trim();

  if (!id || !name) return null;

  return {
    id,
    name,
    county: stringValue(value.county, "Unknown"),
    acres: stringValue(value.acres, "Unknown"),
    notes: stringValue(value.notes, "No notes yet."),
    latitude: optionalNumberValue(value.latitude),
    longitude: optionalNumberValue(value.longitude),
    huntArea: normalizeHuntArea(value.huntArea),
  };
}

function normalizeHuntArea(value: unknown): HuntAreaPoint[] | undefined {
  if (!Array.isArray(value)) return undefined;

  const points = value
    .map((point) => {
      if (!isRecord(point)) return null;

      const lat = optionalNumberValue(point.lat);
      const lng = optionalNumberValue(point.lng);

      if (typeof lat !== "number" || typeof lng !== "number") return null;

      return { lat, lng };
    })
    .filter((point): point is HuntAreaPoint => point !== null);

  // A polygon needs at least three points; anything less isn't an area.
  return points.length >= 3 ? points : undefined;
}

function normalizePin(value: unknown): MapPin | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const type = PIN_TYPES.includes(value.type as PinType)
    ? (value.type as PinType)
    : null;

  if (
    !id ||
    !propertyId ||
    !type ||
    typeof value.lat !== "number" ||
    typeof value.lng !== "number"
  ) {
    return null;
  }

  return {
    id,
    propertyId,
    type,
    lat: value.lat,
    lng: value.lng,
    createdAt: stringValue(value.createdAt),
    name: stringValue(value.name),
    notes: stringValue(value.notes),
    facingDirection: stringValue(value.facingDirection),
  };
}

function normalizeCamera(value: unknown): Camera | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const name = stringValue(value.name).trim();
  const cameraType: CameraType =
    value.cameraType === "Cellular" ? "Cellular" : "Standard";
  const status: CameraStatus =
    value.status === "Inactive" ? "Inactive" : "Active";

  if (!id || !propertyId || !name) return null;

  return {
    id,
    propertyId,
    name,
    cameraType,
    manufacturer: stringValue(value.manufacturer),
    model: stringValue(value.model),
    status,
    latitude: coordinateInRange(optionalNumberValue(value.latitude ?? value.lat), 90),
    longitude: coordinateInRange(
      optionalNumberValue(value.longitude ?? value.lng),
      180,
    ),
    facingDirection: optionalStringValue(value.facingDirection),
    locationNotes: stringValue(value.locationNotes),
    notes: stringValue(value.notes, "No notes yet."),
  };
}

function normalizeCameraCheck(value: unknown): CameraCheck | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const cameraId =
    typeof value.cameraId === "string" || typeof value.cameraId === "number"
      ? String(value.cameraId)
      : "";
  const date = stringValue(value.date).trim();

  if (!id || !propertyId || !cameraId || !date) return null;

  return {
    id,
    propertyId,
    cameraId,
    date,
    batteryPercent: stringValue(value.batteryPercent),
    sdCardPercent: stringValue(value.sdCardPercent),
    signalStrength: optionalStringValue(value.signalStrength),
    weatherSnapshot: normalizeWeatherSnapshot(value.weatherSnapshot, {
      temperature: stringValue(value.temperature),
      windDirection: stringValue(value.windDirection, stringValue(value.wind)),
      windSpeed: stringValue(value.windSpeed),
      conditions: stringValue(value.weather, stringValue(value.conditions)),
      moonPhase: stringValue(value.moonPhase),
    }),
    bucks: countValue(value.bucks),
    does: countValue(value.does),
    fawns: countValue(value.fawns),
    turkeys: countValue(value.turkeys),
    bears: countValue(value.bears),
    coyotes: countValue(value.coyotes),
    otherWildlife: stringValue(value.otherWildlife),
    notes: stringValue(value.notes),
  };
}

function normalizeStand(value: unknown): Stand | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const name = stringValue(value.name).trim();
  const standType = STAND_TYPES.includes(value.standType as StandType)
    ? (value.standType as StandType)
    : "Other";

  if (!id || !propertyId || !name) return null;

  const sourcePinId = optionalStringValue(value.sourcePinId);

  return {
    id,
    propertyId,
    name,
    standType,
    bestWinds: stringValue(value.bestWinds),
    avoidWinds: stringValue(value.avoidWinds),
    accessRouteNotes: stringValue(value.accessRouteNotes),
    exitRouteNotes: stringValue(value.exitRouteNotes),
    notes: stringValue(value.notes, "No notes yet."),
    ...(sourcePinId ? { sourcePinId } : {}),
  };
}

function normalizeHunt(value: unknown): HuntLogEntry | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const standId =
    typeof value.standId === "string" || typeof value.standId === "number"
      ? String(value.standId)
      : "";
  const legacyResult = stringValue(value.result);
  const legacyResultText = legacyResult.toLowerCase();
  const savedWeatherSnapshot = normalizeWeatherSnapshot(value.weatherSnapshot);
  const windDirection = stringValue(
    value.windDirection,
    stringValue(value.wind, savedWeatherSnapshot.windDirection),
  );
  const windSpeed = stringValue(value.windSpeed, savedWeatherSnapshot.windSpeed);
  const temperature = stringValue(
    value.temperature,
    savedWeatherSnapshot.temperature,
  );
  const weather = stringValue(value.weather, savedWeatherSnapshot.conditions);
  const moonPhase = stringValue(
    value.moonPhase,
    savedWeatherSnapshot.moonPhase,
  );

  if (!id || !propertyId) return null;

  return {
    id,
    propertyId,
    standId,
    standName: stringValue(value.standName, stringValue(value.stand)),
    date: stringValue(value.date),
    startTime: stringValue(value.startTime),
    endTime: stringValue(value.endTime),
    windDirection,
    windSpeed,
    temperature,
    weather,
    moonPhase,
    weatherSnapshot: normalizeWeatherSnapshot(value.weatherSnapshot, {
      temperature,
      windDirection,
      windSpeed,
      conditions: weather,
      moonPhase,
    }),
    bucks: countValue(value.bucks),
    does: countValue(value.does),
    fawns: countValue(value.fawns),
    shotOpportunity: booleanValue(
      value.shotOpportunity,
      legacyResultText.includes("shot"),
    ),
    harvest: booleanValue(value.harvest, legacyResultText.includes("harvest")),
    notes: stringValue(value.notes),
  };
}

function normalizePhotoRecord(value: unknown): PhotoRecord | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const cameraSiteId =
    typeof value.cameraSiteId === "string" ||
    typeof value.cameraSiteId === "number"
      ? String(value.cameraSiteId)
      : "";
  const cameraCheckId =
    typeof value.cameraCheckId === "string" ||
    typeof value.cameraCheckId === "number"
      ? String(value.cameraCheckId)
      : "";
  const fileName = stringValue(value.fileName).trim();
  const photoDate = stringValue(value.photoDate).trim();
  const species = stringValue(value.species).trim();

  // cameraCheckId is optional: cellular cameras transmit photos over service,
  // so those records attach directly to the camera site with no card-pull check.
  if (!id || !propertyId || !cameraSiteId || !fileName || !photoDate || !species) {
    return null;
  }

  const imageId = optionalStringValue(value.imageId);
  const imageWidth = optionalNumberValue(value.imageWidth);
  const imageHeight = optionalNumberValue(value.imageHeight);
  const weatherSnapshot = isRecord(value.weatherSnapshot)
    ? normalizeWeatherSnapshot(value.weatherSnapshot)
    : undefined;

  return {
    id,
    propertyId,
    cameraSiteId,
    cameraCheckId,
    fileName,
    photoDate,
    species,
    deerProfileId: optionalStringValue(value.deerProfileId),
    buckName: optionalStringValue(value.buckName),
    travelDirection: optionalStringValue(value.travelDirection),
    behavior: optionalStringValue(value.behavior),
    notes: stringValue(value.notes),
    createdAt: stringValue(value.createdAt, photoDate),
    imageId,
    imageWidth: imageId && imageWidth && imageWidth > 0 ? imageWidth : undefined,
    imageHeight:
      imageId && imageHeight && imageHeight > 0 ? imageHeight : undefined,
    weatherSnapshot,
  };
}

function normalizeDeerProfile(value: unknown): DeerProfile | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const nickname = stringValue(value.nickname).trim();

  if (!id || !propertyId || !nickname) return null;

  return {
    id,
    propertyId,
    nickname,
    estimatedAge: stringValue(value.estimatedAge),
    firstSeen: stringValue(value.firstSeen),
    lastSeen: stringValue(value.lastSeen),
    notes: stringValue(value.notes),
  };
}

function normalizeWalkTrackPoint(value: unknown): WalkTrackPoint | null {
  if (!isRecord(value)) return null;

  const lat = optionalNumberValue(value.lat);
  const lng = optionalNumberValue(value.lng);

  if (typeof lat !== "number" || typeof lng !== "number") return null;

  return { lat, lng, at: stringValue(value.at) };
}

function normalizeWalkTrack(value: unknown): WalkTrack | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const points = Array.isArray(value.points)
    ? value.points
        .map(normalizeWalkTrackPoint)
        .filter((point): point is WalkTrackPoint => point !== null)
    : [];

  // A trail needs at least two points to draw a line worth keeping.
  if (!id || !propertyId || points.length < 2) return null;

  const startedAt = stringValue(value.startedAt, points[0]?.at ?? "");
  const endedAt = stringValue(
    value.endedAt,
    points[points.length - 1]?.at ?? startedAt,
  );

  return {
    id,
    propertyId,
    name: stringValue(value.name, "Walk"),
    points,
    startedAt,
    endedAt,
  };
}

function normalizeDocument(value: unknown): DocumentRecord | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";

  if (!id || !propertyId) return null;

  const fileName = stringValue(value.fileName);

  return {
    id,
    propertyId,
    label: stringValue(value.label) || fileName || "Document",
    fileName,
    fileType: stringValue(value.fileType),
    fileSize: countValue(value.fileSize),
    fileId: stringValue(value.fileId),
    notes: stringValue(value.notes),
    createdAt: stringValue(value.createdAt),
  };
}

function createState(properties: Property[]): DeerIntelState {
  return {
    ...DEFAULT_STATE,
    properties,
    selectedPropertyId: properties[0]?.id ?? "",
  };
}

function normalizeState(value: unknown): DeerIntelState | null {
  if (!isRecord(value)) return null;
  if (!Array.isArray(value.properties)) return null;

  const properties = value.properties
    .map(normalizeProperty)
    .filter((property): property is Property => property !== null);
  const pins = Array.isArray(value.pins)
    ? value.pins
        .map(normalizePin)
        .filter((pin): pin is MapPin => pin !== null)
    : [];
  const cameras = Array.isArray(value.cameras)
    ? value.cameras
        .map(normalizeCamera)
        .filter((camera): camera is Camera => camera !== null)
    : [];
  const cameraChecks = Array.isArray(value.cameraChecks)
    ? value.cameraChecks
        .map(normalizeCameraCheck)
        .filter((check): check is CameraCheck => check !== null)
    : [];
  const stands = Array.isArray(value.stands)
    ? value.stands
        .map(normalizeStand)
        .filter((stand): stand is Stand => stand !== null)
    : [];
  const hunts = Array.isArray(value.hunts)
    ? value.hunts
        .map(normalizeHunt)
        .filter((hunt): hunt is HuntLogEntry => hunt !== null)
    : [];
  const photoRecords = Array.isArray(value.photoRecords)
    ? value.photoRecords
        .map(normalizePhotoRecord)
        .filter((photo): photo is PhotoRecord => photo !== null)
    : [];
  const deerProfiles = Array.isArray(value.deerProfiles)
    ? value.deerProfiles
        .map(normalizeDeerProfile)
        .filter((profile): profile is DeerProfile => profile !== null)
    : [];
  const walkTracks = Array.isArray(value.walkTracks)
    ? value.walkTracks
        .map(normalizeWalkTrack)
        .filter((track): track is WalkTrack => track !== null)
    : [];
  const documents = Array.isArray(value.documents)
    ? value.documents
        .map(normalizeDocument)
        .filter((document): document is DocumentRecord => document !== null)
    : [];
  const selectedPropertyId = properties.some(
    (property) => property.id === value.selectedPropertyId,
  )
    ? String(value.selectedPropertyId)
    : properties[0]?.id ?? "";

  const normalized: DeerIntelState = {
    version: CURRENT_STATE_VERSION,
    properties,
    selectedPropertyId,
    cameras,
    cameraChecks,
    stands,
    pins,
    hunts,
    photoRecords,
    deerProfiles,
    walkTracks,
    documents,
  };

  // Collapse duplicate stand sites created from the same map pin. Rapid taps on
  // "Save as stand site" before the UI refreshed could promote one pin several
  // times; this heals any store that already carries those copies. Runs on
  // every load so affected devices self-correct on the next visit.
  const deduped = dedupeStandsFromPins(normalized);

  // A store written before version 2 may still carry the old seeded sample
  // properties. Run the one-time cleanup only when upgrading from an older
  // version; states already at the current version are left untouched.
  const incomingVersion =
    typeof value.version === "number" ? value.version : 1;

  return incomingVersion < CURRENT_STATE_VERSION
    ? removeUntouchedLegacyProperties(deduped)
    : deduped;
}

/**
 * Remove duplicate stand sites that were promoted from the same map pin,
 * keeping the first one. Any hunts logged against a removed duplicate are
 * repointed to the kept stand so no history is lost.
 *
 * Duplicates are matched by sourcePinId, or — for stands promoted before pins
 * were tracked — by the identical auto-generated "map pin at" note (same
 * property, name, and location line). Stands added by hand (no pin origin) are
 * never merged, even when they share a name.
 */
function dedupeStandsFromPins(state: DeerIntelState): DeerIntelState {
  const keptStandByKey = new Map<string, string>();
  const removedStandIdToKeptId = new Map<string, string>();
  const stands: Stand[] = [];

  for (const stand of state.stands) {
    // Only stands that came from a map pin can be duplicates of each other:
    // a sourcePinId, or the note signature left by createStandFromPin.
    const dedupeKey = stand.sourcePinId
      ? `pin:${stand.sourcePinId}`
      : stand.notes.includes("map pin at ")
        ? `sig:${stand.propertyId}|${stand.name.toLowerCase()}|${stand.notes}`
        : null;

    if (!dedupeKey) {
      stands.push(stand);
      continue;
    }

    const existingKeptId = keptStandByKey.get(dedupeKey);

    if (existingKeptId) {
      removedStandIdToKeptId.set(stand.id, existingKeptId);
      continue;
    }

    keptStandByKey.set(dedupeKey, stand.id);
    stands.push(stand);
  }

  if (removedStandIdToKeptId.size === 0) return state;

  const hunts = state.hunts.map((hunt) => {
    const keptId = removedStandIdToKeptId.get(hunt.standId);

    return keptId ? { ...hunt, standId: keptId } : hunt;
  });

  return { ...state, stands, hunts };
}

/**
 * True when a property is still one of the old seeded samples exactly as it was
 * shipped — same id and fields, no location or hunt area added. Once the hunter
 * renames it, gives it a location/hunt area, or otherwise edits it, it's theirs
 * and this returns false. Shared with cloud sync so both agree on what counts
 * as untouched sample data (versus data worth syncing/keeping).
 */
export function isUntouchedLegacySeedProperty(property: Property): boolean {
  const seed = LEGACY_SEED_PROPERTIES.find((s) => s.id === property.id);

  if (!seed) return false;

  return (
    property.name === seed.name &&
    property.county === seed.county &&
    property.acres === seed.acres &&
    property.notes === seed.notes &&
    property.latitude === undefined &&
    property.longitude === undefined &&
    property.huntArea === undefined
  );
}

/**
 * Drop the old seeded sample properties (Finley Run, Moore Hill Area) from an
 * existing store — but only ones the hunter never made their own. A legacy
 * property is removed only when it still exactly matches the original seed and
 * has no cameras, stands, hunts, pins, photos, or deer attached to it. Anything
 * the user edited or built on is kept, so no real data is ever destroyed.
 */
function removeUntouchedLegacyProperties(
  state: DeerIntelState,
): DeerIntelState {
  const referencedPropertyIds = new Set<string>();

  for (const camera of state.cameras) referencedPropertyIds.add(camera.propertyId);
  for (const check of state.cameraChecks) referencedPropertyIds.add(check.propertyId);
  for (const stand of state.stands) referencedPropertyIds.add(stand.propertyId);
  for (const pin of state.pins) referencedPropertyIds.add(pin.propertyId);
  for (const hunt of state.hunts) referencedPropertyIds.add(hunt.propertyId);
  for (const photo of state.photoRecords) referencedPropertyIds.add(photo.propertyId);
  for (const profile of state.deerProfiles) referencedPropertyIds.add(profile.propertyId);
  for (const track of state.walkTracks) referencedPropertyIds.add(track.propertyId);
  for (const document of state.documents) referencedPropertyIds.add(document.propertyId);

  const remainingProperties = state.properties.filter((property) => {
    // Keep anything the hunter made their own, or that has data attached.
    if (!isUntouchedLegacySeedProperty(property)) return true;
    if (referencedPropertyIds.has(property.id)) return true;

    return false;
  });

  if (remainingProperties.length === state.properties.length) return state;

  const selectedPropertyId = remainingProperties.some(
    (property) => property.id === state.selectedPropertyId,
  )
    ? state.selectedPropertyId
    : remainingProperties[0]?.id ?? "";

  return { ...state, properties: remainingProperties, selectedPropertyId };
}

function parseState(rawState: string | null): DeerIntelState | null {
  if (rawState === null) return null;

  try {
    return normalizeState(JSON.parse(rawState));
  } catch {
    return null;
  }
}

function parseLegacyProperties(rawProperties: string | null): Property[] | null {
  if (rawProperties === null) return null;

  try {
    const parsedProperties: unknown = JSON.parse(rawProperties);

    if (!Array.isArray(parsedProperties)) return null;

    return parsedProperties
      .map(normalizeProperty)
      .filter((property): property is Property => property !== null);
  } catch {
    return null;
  }
}

function readStateFromStorage(): DeerIntelState {
  if (typeof window === "undefined") return DEFAULT_STATE;

  const stateRaw = readStorageValue(STORAGE_KEY);
  const legacyPropertiesRaw =
    stateRaw === null ? readStorageValue(LEGACY_PROPERTIES_STORAGE_KEY) : null;

  if (
    cachedStorage?.stateRaw === stateRaw &&
    cachedStorage.legacyPropertiesRaw === legacyPropertiesRaw
  ) {
    return cachedStorage.state;
  }

  const state =
    parseState(stateRaw) ??
    createState(parseLegacyProperties(legacyPropertiesRaw) ?? DEFAULT_PROPERTIES);

  cachedStorage = {
    stateRaw,
    legacyPropertiesRaw,
    state,
  };

  return state;
}

function getSnapshot(): DeerIntelState {
  return memoryState ?? readStateFromStorage();
}

function getServerSnapshot(): DeerIntelState {
  return DEFAULT_STATE;
}

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (
      event.key !== STORAGE_KEY &&
      event.key !== LEGACY_PROPERTIES_STORAGE_KEY &&
      event.key !== null
    ) {
      return;
    }

    memoryState = null;
    cachedStorage = null;
    listener();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useDeerIntelStore() {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

export function saveDeerIntelStore(nextState: DeerIntelState) {
  const normalizedState = normalizeState(nextState) ?? DEFAULT_STATE;
  memoryState = normalizedState;
  cachedStorage = null;

  // The in-memory state above keeps the current session working; but if the
  // write fails (localStorage quota exhausted), the change won't survive a
  // reload. Track that so the UI can warn instead of silently losing data.
  const persisted = writeStorageValue(STORAGE_KEY, JSON.stringify(normalizedState));
  setStoragePersistenceFailed(!persisted);

  notifyListeners();
}

export function updateDeerIntelStore(
  updater: (currentState: DeerIntelState) => DeerIntelState,
) {
  saveDeerIntelStore(updater(getSnapshot()));
}

// --- Storage-persistence signal ---------------------------------------------
// True once a save couldn't be written to localStorage (quota full). A small
// global banner subscribes to this so the hunter learns their changes aren't
// being saved rather than losing them silently on the next reload.
let storagePersistenceFailed = false;
const persistenceListeners = new Set<() => void>();

function setStoragePersistenceFailed(failed: boolean) {
  if (storagePersistenceFailed === failed) return;
  storagePersistenceFailed = failed;
  persistenceListeners.forEach((listener) => listener());
}

function subscribeToStoragePersistence(listener: () => void) {
  persistenceListeners.add(listener);
  return () => {
    persistenceListeners.delete(listener);
  };
}

function getStoragePersistenceFailed() {
  return storagePersistenceFailed;
}

export function useStoragePersistenceFailed(): boolean {
  return useSyncExternalStore(
    subscribeToStoragePersistence,
    getStoragePersistenceFailed,
    () => false,
  );
}

export function createDeerIntelId(prefix: string) {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

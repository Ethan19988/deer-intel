"use client";

import { useSyncExternalStore } from "react";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import { normalizeWeatherSnapshot } from "@/lib/weather";
import type { Camera, CameraStatus, CameraType } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import {
  MAP_DRAWING_TYPES,
  type MapDrawing,
  type MapDrawingGeometry,
  type MapDrawingPoint,
  type MapDrawingType,
} from "@/types/mapDrawing";
import { PIN_TYPES, type MapPin, type PinType } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import { STAND_TYPES, type Stand, type StandType } from "@/types/stand";

export { PIN_TYPES, PROPERTY_ASSET_PIN_TYPES } from "@/types/mapPin";
export type { DeerIntelState } from "@/types/deerIntelStore";
export type { HuntLogEntry } from "@/types/hunt";
export type { MapDrawing } from "@/types/mapDrawing";
export type { MapPin, PinType } from "@/types/mapPin";

const STORAGE_KEY = "deer-intel:state";
const LEGACY_PROPERTIES_STORAGE_KEY = "deer-intel:properties";

export const DEFAULT_PROPERTIES: Property[] = [
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
  version: 1,
  properties: DEFAULT_PROPERTIES,
  selectedPropertyId: DEFAULT_PROPERTIES[0]?.id ?? "",
  cameras: [],
  cameraChecks: [],
  stands: [],
  pins: [],
  mapDrawings: [],
  hunts: [],
  photoRecords: [],
  deerProfiles: [],
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
  };
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
    notes: stringValue(value.notes),
  };
}

function normalizeMapDrawingPoint(value: unknown): MapDrawingPoint | null {
  if (!isRecord(value)) return null;

  const lat = optionalNumberValue(value.lat);
  const lng = optionalNumberValue(value.lng);

  if (lat === undefined || lng === undefined) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;

  return {
    lat,
    lng,
  };
}

function normalizeMapDrawing(value: unknown): MapDrawing | null {
  if (!isRecord(value)) return null;

  const id =
    typeof value.id === "string" || typeof value.id === "number"
      ? String(value.id)
      : "";
  const propertyId =
    typeof value.propertyId === "string" || typeof value.propertyId === "number"
      ? String(value.propertyId)
      : "";
  const type = MAP_DRAWING_TYPES.some((drawingType) => drawingType.type === value.type)
    ? (value.type as MapDrawingType)
    : null;
  const expectedGeometry = MAP_DRAWING_TYPES.find(
    (drawingType) => drawingType.type === type,
  )?.geometry ?? null;
  const geometry: MapDrawingGeometry | null =
    value.geometry === expectedGeometry ? expectedGeometry : null;
  const name = stringValue(value.name).trim();
  const points = Array.isArray(value.points)
    ? value.points
        .map(normalizeMapDrawingPoint)
        .filter((point): point is MapDrawingPoint => point !== null)
    : [];

  if (
    !id ||
    !propertyId ||
    !type ||
    !geometry ||
    !name ||
    points.length < (geometry === "polygon" ? 3 : 2)
  ) {
    return null;
  }

  return {
    id,
    propertyId,
    type,
    geometry,
    name,
    points,
    createdAt: stringValue(value.createdAt),
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
    latitude: optionalNumberValue(value.latitude ?? value.lat),
    longitude: optionalNumberValue(value.longitude ?? value.lng),
    locationNotes: stringValue(value.locationNotes),
    batteryPercent: stringValue(
      value.batteryPercent,
      stringValue(value.battery),
    ),
    sdCardPercent: stringValue(value.sdCardPercent, stringValue(value.sdCard)),
    signalStrength:
      cameraType === "Cellular"
        ? optionalStringValue(value.signalStrength)
        : undefined,
    carrier:
      cameraType === "Cellular" ? optionalStringValue(value.carrier) : undefined,
    lastChecked: stringValue(
      value.lastChecked,
      stringValue(value.lastCheckedDate),
    ),
    lastTransmission:
      cameraType === "Cellular"
        ? optionalStringValue(value.lastTransmission)
        : undefined,
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

  if (
    !id ||
    !propertyId ||
    !cameraSiteId ||
    !cameraCheckId ||
    !fileName ||
    !photoDate ||
    !species
  ) {
    return null;
  }

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
    notes: stringValue(value.notes),
    createdAt: stringValue(value.createdAt, photoDate),
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
  const mapDrawings = Array.isArray(value.mapDrawings)
    ? value.mapDrawings
        .map(normalizeMapDrawing)
        .filter((drawing): drawing is MapDrawing => drawing !== null)
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
  const selectedPropertyId = properties.some(
    (property) => property.id === value.selectedPropertyId,
  )
    ? String(value.selectedPropertyId)
    : properties[0]?.id ?? "";

  return {
    version: 1,
    properties,
    selectedPropertyId,
    cameras,
    cameraChecks,
    stands,
    pins,
    mapDrawings,
    hunts,
    photoRecords,
    deerProfiles,
  };
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

  writeStorageValue(STORAGE_KEY, JSON.stringify(normalizedState));

  notifyListeners();
}

export function updateDeerIntelStore(
  updater: (currentState: DeerIntelState) => DeerIntelState,
) {
  saveDeerIntelStore(updater(getSnapshot()));
}

export function createDeerIntelId(prefix: string) {
  if (typeof window !== "undefined" && window.crypto?.randomUUID) {
    return `${prefix}-${window.crypto.randomUUID()}`;
  }

  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

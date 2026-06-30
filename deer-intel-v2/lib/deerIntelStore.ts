"use client";

import { useSyncExternalStore } from "react";
import { readStorageValue, writeStorageValue } from "@/lib/storage";
import type { Camera, CameraStatus, CameraType } from "@/types/camera";
import type { DeerIntelState } from "@/types/deerIntelStore";
import type { HuntLogEntry } from "@/types/hunt";
import { PIN_TYPES, type MapPin, type PinType } from "@/types/mapPin";
import type { Property } from "@/types/property";

export { PIN_TYPES } from "@/types/mapPin";
export type { DeerIntelState } from "@/types/deerIntelStore";
export type { HuntLogEntry } from "@/types/hunt";
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
  pins: [],
  hunts: [],
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

  if (!id || !propertyId) return null;

  return {
    id,
    propertyId,
    date: stringValue(value.date),
    stand: stringValue(value.stand),
    wind: stringValue(value.wind),
    result: stringValue(value.result),
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
  const cameras = Array.isArray(value.cameras)
    ? value.cameras
        .map(normalizeCamera)
        .filter((camera): camera is Camera => camera !== null)
    : [];
  const hunts = Array.isArray(value.hunts)
    ? value.hunts
        .map(normalizeHunt)
        .filter((hunt): hunt is HuntLogEntry => hunt !== null)
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
    pins,
    hunts,
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

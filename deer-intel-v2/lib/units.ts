"use client";

import { useSyncExternalStore } from "react";

// Measurement units are a device-local preference (like the theme), stored in
// their own localStorage key and kept out of the synced DeerIntelState. They
// drive the LIVE weather layer going forward; already-saved hunt logs and
// camera checks keep whatever units they were recorded in.
export type TemperatureUnit = "F" | "C";
export type WindSpeedUnit = "mph" | "kmh";

export type UnitPreferences = {
  temperature: TemperatureUnit;
  wind: WindSpeedUnit;
};

export const UNITS_STORAGE_KEY = "deer-intel:units";

export const DEFAULT_UNITS: UnitPreferences = {
  temperature: "F",
  wind: "mph",
};

export const TEMPERATURE_UNIT_LABEL: Record<TemperatureUnit, string> = {
  F: "°F",
  C: "°C",
};

export const WIND_UNIT_LABEL: Record<WindSpeedUnit, string> = {
  mph: "mph",
  kmh: "km/h",
};

// Open-Meteo query-parameter values for each unit.
export function openMeteoTemperatureUnit(unit: TemperatureUnit): string {
  return unit === "C" ? "celsius" : "fahrenheit";
}

export function openMeteoWindSpeedUnit(unit: WindSpeedUnit): string {
  return unit === "kmh" ? "kmh" : "mph";
}

function isTemperatureUnit(value: unknown): value is TemperatureUnit {
  return value === "F" || value === "C";
}

function isWindSpeedUnit(value: unknown): value is WindSpeedUnit {
  return value === "mph" || value === "kmh";
}

function parseUnits(raw: string | null): UnitPreferences {
  if (!raw) return DEFAULT_UNITS;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== "object" || parsed === null) return DEFAULT_UNITS;

    const record = parsed as Record<string, unknown>;

    return {
      temperature: isTemperatureUnit(record.temperature)
        ? record.temperature
        : DEFAULT_UNITS.temperature,
      wind: isWindSpeedUnit(record.wind) ? record.wind : DEFAULT_UNITS.wind,
    };
  } catch {
    return DEFAULT_UNITS;
  }
}

// useSyncExternalStore compares snapshots by reference, so cache the parsed
// object and only rebuild it when the stored string actually changes — reading
// a fresh object every render would loop forever.
let cachedRaw: string | null = null;
let cachedUnits: UnitPreferences = DEFAULT_UNITS;

export function readUnitPreferences(): UnitPreferences {
  if (typeof window === "undefined") return DEFAULT_UNITS;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(UNITS_STORAGE_KEY);
  } catch {
    return DEFAULT_UNITS;
  }

  if (raw === cachedRaw) return cachedUnits;

  cachedRaw = raw;
  cachedUnits = parseUnits(raw);
  return cachedUnits;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setUnitPreferences(next: UnitPreferences): void {
  const serialized = JSON.stringify(next);

  cachedRaw = serialized;
  cachedUnits = next;

  try {
    window.localStorage.setItem(UNITS_STORAGE_KEY, serialized);
  } catch {
    // Ignore write failures (private mode / quota); the cached value above still
    // takes effect for this session.
  }

  notifyListeners();
}

// Update one unit at a time by merging against the latest stored value rather
// than a value captured in a render closure, so toggling temperature then wind
// in quick succession can't clobber each other.
export function setTemperatureUnit(temperature: TemperatureUnit): void {
  setUnitPreferences({ ...readUnitPreferences(), temperature });
}

export function setWindUnit(wind: WindSpeedUnit): void {
  setUnitPreferences({ ...readUnitPreferences(), wind });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key !== UNITS_STORAGE_KEY && event.key !== null) return;
    // Force a re-read on the next snapshot, then wake every subscriber.
    cachedRaw = null;
    notifyListeners();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): UnitPreferences {
  return readUnitPreferences();
}

function getServerSnapshot(): UnitPreferences {
  return DEFAULT_UNITS;
}

export function useUnitPreferences(): UnitPreferences {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

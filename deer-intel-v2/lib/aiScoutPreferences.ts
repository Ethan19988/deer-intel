"use client";

import { useSyncExternalStore } from "react";

// Whether the hunter wants AI Scout's LLM recommendations. Device-local (its own
// localStorage key, like the theme/units), defaulting to ON so behavior is
// unchanged wherever ANTHROPIC_API_KEY is configured. Turning it off is a cost /
// privacy control: no property data is ever sent to Anthropic while it's off,
// regardless of the server key.
const AI_SCOUT_STORAGE_KEY = "deer-intel:ai-scout-enabled";

function readRaw(): string | null {
  if (typeof window === "undefined") return null;
  try {
    return window.localStorage.getItem(AI_SCOUT_STORAGE_KEY);
  } catch {
    return null;
  }
}

// Enabled unless explicitly turned off, so a missing key means "on".
export function readAiScoutEnabled(): boolean {
  return readRaw() !== "off";
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setAiScoutEnabled(enabled: boolean): void {
  try {
    window.localStorage.setItem(AI_SCOUT_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Ignore write failures (private mode / quota).
  }
  notifyListeners();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key !== AI_SCOUT_STORAGE_KEY && event.key !== null) return;
    notifyListeners();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): boolean {
  return readAiScoutEnabled();
}

function getServerSnapshot(): boolean {
  return true;
}

export function useAiScoutEnabled(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

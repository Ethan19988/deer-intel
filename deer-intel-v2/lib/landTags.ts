"use client";

import { useSyncExternalStore } from "react";

// Land you've tagged on the parcel map: parcels you have permission to hunt,
// and neighbors you want to keep an eye on. The statewide parcel tiles carry an
// owner name but no parcel id, so a tag follows the owner name — the same key
// the map already uses to print one label per owner holding.
//
// Kept on this device (like the theme) for now; not part of cloud sync yet.

export type LandTagKind = "permission" | "neighbor";

export type LandTag = {
  kind: LandTagKind;
  ownerName: string;
  acres: number;
  /** Where the parcel was tapped, to fly back to it. */
  lat: number;
  lng: number;
  savedAt: string;
};

export type LandTags = Record<string, LandTag>;

export const LAND_TAGS_STORAGE_KEY = "deer-intel:land-tags";
const CHANGE_EVENT = "deer-intel:land-tags-change";
const EMPTY: LandTags = {};

/** The key a tag is stored under: the owner name, trimmed and upper-cased. */
export function landTagKey(ownerName: string): string {
  return ownerName.trim().replace(/\s+/g, " ").toUpperCase();
}

let cachedRaw: string | null = null;
let cachedTags: LandTags = EMPTY;

function readTags(): LandTags {
  if (typeof window === "undefined") return EMPTY;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(LAND_TAGS_STORAGE_KEY);
  } catch {
    return EMPTY;
  }
  if (raw === cachedRaw) return cachedTags;
  cachedRaw = raw;
  try {
    const parsed = raw ? JSON.parse(raw) : null;
    cachedTags = parsed && typeof parsed === "object" ? (parsed as LandTags) : EMPTY;
  } catch {
    cachedTags = EMPTY;
  }
  return cachedTags;
}

function writeTags(tags: LandTags) {
  try {
    window.localStorage.setItem(LAND_TAGS_STORAGE_KEY, JSON.stringify(tags));
  } catch {
    // Storage full or blocked: the tag just won't stick this session.
  }
  window.dispatchEvent(new Event(CHANGE_EVENT));
}

/** Tag a parcel owner, change its tag, or clear it (kind = null). */
export function setLandTag(
  info: Omit<LandTag, "kind" | "savedAt">,
  kind: LandTagKind | null,
) {
  const key = landTagKey(info.ownerName);
  if (!key) return;
  const next = { ...readTags() };
  if (kind) {
    next[key] = { ...info, kind, savedAt: new Date().toISOString() };
  } else {
    delete next[key];
  }
  writeTags(next);
}

function subscribe(onChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === LAND_TAGS_STORAGE_KEY) onChange();
  };
  window.addEventListener(CHANGE_EVENT, onChange);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(CHANGE_EVENT, onChange);
    window.removeEventListener("storage", onStorage);
  };
}

export function useLandTags(): LandTags {
  return useSyncExternalStore(subscribe, readTags, () => EMPTY);
}

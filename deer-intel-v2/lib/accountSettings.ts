"use client";

import { useSyncExternalStore } from "react";

// Account-level choices (not per device): sharing switches that must agree on
// every device signed in to the same account, or two devices fight over them
// (one shares, the other deletes). Saved on this device as a cache, tagged with
// the account they belong to, and carried in the cloud row by lib/cloudSync,
// where each setting is merged newest-wins by its own updatedAt.

export type AccountSettingValue = string | boolean;

export type AccountSetting = {
  value: AccountSettingValue;
  // ISO time the choice was made (newest wins across devices).
  updatedAt: string;
};

/** Keyed by setting name. Unknown keys are kept, so newer builds' settings survive. */
export type AccountSettings = Record<string, AccountSetting>;

export const ACCOUNT_SETTING = {
  // "on" | "off": share anonymous sighting times (lib/sharedSightings).
  shareSightings: "shareSightings",
  // boolean: share my map pins with the active party.
  partyPinSharing: "partyPinSharing",
  // boolean: share my buck hit list with the active party.
  partyBuckSharing: "partyBuckSharing",
  // string: the property whose pins are shared (one property at a time).
  partyPinPropertyId: "partyPinPropertyId",
} as const;

export const ACCOUNT_SETTINGS_STORAGE_KEY = "deer-intel:account-settings";
export const ACCOUNT_SETTINGS_EVENT = "deer-intel:account-settings-change";
const MAX_STRING_LENGTH = 200;
const MAX_KEYS = 64;

type StoredSettings = { userId: string; settings: AccountSettings };

/** Keep only well-formed settings so a bad cloud row can't break anything. */
export function sanitizeAccountSettings(value: unknown): AccountSettings {
  if (!value || typeof value !== "object" || Array.isArray(value)) return {};
  const clean: AccountSettings = {};
  for (const [key, raw] of Object.entries(value as Record<string, unknown>).slice(0, MAX_KEYS)) {
    const entry = raw as Partial<AccountSetting> | null;
    if (!key || !entry || typeof entry !== "object") continue;
    const settingValue = entry.value;
    if (typeof settingValue !== "boolean" && typeof settingValue !== "string") continue;
    if (typeof settingValue === "string" && settingValue.length > MAX_STRING_LENGTH) continue;
    clean[key] = {
      value: settingValue,
      updatedAt: typeof entry.updatedAt === "string" ? entry.updatedAt : "",
    };
  }
  return clean;
}

function settingTime(setting: AccountSetting | undefined): number {
  const time = Date.parse(setting?.updatedAt ?? "");
  return Number.isFinite(time) ? time : -Infinity;
}

/**
 * Union of both sides; when both hold a setting the newer updatedAt wins (the
 * remote copy on a tie, so every device converges on the same value).
 */
export function mergeAccountSettings(
  local: AccountSettings | undefined,
  remote: AccountSettings | undefined,
): AccountSettings {
  const merged: AccountSettings = { ...(remote ?? {}) };
  for (const [key, setting] of Object.entries(local ?? {})) {
    const other = merged[key];
    if (!other || settingTime(setting) > settingTime(other)) merged[key] = setting;
  }
  return merged;
}

// --- Device cache -----------------------------------------------------------

let cachedRaw: string | null | undefined;
let cachedStored: StoredSettings | null = null;

function readStored(): StoredSettings | null {
  if (typeof window === "undefined") return null;
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(ACCOUNT_SETTINGS_STORAGE_KEY);
  } catch {
    return null;
  }
  if (raw === cachedRaw) return cachedStored;
  cachedRaw = raw;
  try {
    const parsed = raw ? (JSON.parse(raw) as Partial<StoredSettings>) : null;
    cachedStored =
      parsed && typeof parsed.userId === "string" && parsed.userId
        ? { userId: parsed.userId, settings: sanitizeAccountSettings(parsed.settings) }
        : null;
  } catch {
    cachedStored = null;
  }
  return cachedStored;
}

function writeStored(stored: StoredSettings) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(ACCOUNT_SETTINGS_STORAGE_KEY, JSON.stringify(stored));
  } catch {
    // Storage full or blocked: the choice doesn't stick (like other settings).
  }
  window.dispatchEvent(new Event(ACCOUNT_SETTINGS_EVENT));
  // Older listeners for the sightings choice.
  window.dispatchEvent(new CustomEvent("deer-intel:sharing-changed"));
}

/**
 * This account's settings as cached on this device, or undefined when the
 * cache holds nothing for this account (never another account's choices).
 */
export function readAccountSettings(userId: string): AccountSettings | undefined {
  const stored = readStored();
  return stored && stored.userId === userId ? stored.settings : undefined;
}

export function readAccountSetting(
  userId: string,
  key: string,
): AccountSetting | undefined {
  return readAccountSettings(userId)?.[key];
}

/** Make a choice on this device; it reaches other devices with the next sync. */
export function writeAccountSetting(
  userId: string,
  key: string,
  value: AccountSettingValue,
  now: Date = new Date(),
) {
  if (!userId) return;
  const current = readAccountSettings(userId) ?? {};
  writeStored({
    userId,
    settings: { ...current, [key]: { value, updatedAt: now.toISOString() } },
  });
}

/** Replace this account's settings at once (cloud pull or merge). */
export function replaceAccountSettings(userId: string, settings: AccountSettings) {
  if (!userId) return;
  const clean = sanitizeAccountSettings(settings);
  const current = readAccountSettings(userId);
  if (current && JSON.stringify(current) === JSON.stringify(clean)) return;
  writeStored({ userId, settings: clean });
}

function subscribe(listener: () => void) {
  if (typeof window === "undefined") return () => undefined;
  const handleStorage = (event: StorageEvent) => {
    if (event.key === ACCOUNT_SETTINGS_STORAGE_KEY || event.key === null) listener();
  };
  window.addEventListener(ACCOUNT_SETTINGS_EVENT, listener);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(ACCOUNT_SETTINGS_EVENT, listener);
    window.removeEventListener("storage", handleStorage);
  };
}

/** Live view of this account's cached settings (undefined when none). */
export function useAccountSettings(userId: string | null | undefined): AccountSettings | undefined {
  const stored = useSyncExternalStore(subscribe, readStored, () => null);
  return userId && stored && stored.userId === userId ? stored.settings : undefined;
}

/** A boolean setting's value, or `fallback` when it was never set. */
export function booleanSetting(
  settings: AccountSettings | undefined,
  key: string,
  fallback: boolean,
): boolean {
  const value = settings?.[key]?.value;
  return typeof value === "boolean" ? value : fallback;
}

/** A string setting's value, or undefined when it was never set. */
export function stringSetting(
  settings: AccountSettings | undefined,
  key: string,
): string | undefined {
  const value = settings?.[key]?.value;
  return typeof value === "string" ? value : undefined;
}

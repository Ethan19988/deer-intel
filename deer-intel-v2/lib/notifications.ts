"use client";

import { useSyncExternalStore } from "react";

// Local hunting-condition notifications. These fire while Deer Intel is open and
// checks conditions (a local-first PWA can't run always-on background push
// without a server), so alerts are best-effort "when you open the app" nudges.
// Preferences are device-local, like the theme/units.

export type NotificationPrefs = {
  coldFront: boolean;
  goodWind: boolean;
};

export type NotificationPermissionState =
  | "unsupported"
  | "default"
  | "granted"
  | "denied";

const PREFS_STORAGE_KEY = "deer-intel:notifications";
const DEDUPE_STORAGE_KEY = "deer-intel:notified";

export const DEFAULT_NOTIFICATION_PREFS: NotificationPrefs = {
  coldFront: true,
  goodWind: true,
};

// --- Capability + permission -----------------------------------------------

export function notificationsSupported(): boolean {
  return typeof window !== "undefined" && "Notification" in window;
}

export function getNotificationPermission(): NotificationPermissionState {
  if (!notificationsSupported()) return "unsupported";
  return Notification.permission;
}

export async function requestNotificationPermission(): Promise<NotificationPermissionState> {
  if (!notificationsSupported()) return "unsupported";
  try {
    return await Notification.requestPermission();
  } catch {
    return Notification.permission;
  }
}

// --- Preference store (device-local) ---------------------------------------

function parsePrefs(raw: string | null): NotificationPrefs {
  if (!raw) return DEFAULT_NOTIFICATION_PREFS;
  try {
    const parsed = JSON.parse(raw) as Partial<NotificationPrefs>;
    return {
      coldFront:
        typeof parsed.coldFront === "boolean"
          ? parsed.coldFront
          : DEFAULT_NOTIFICATION_PREFS.coldFront,
      goodWind:
        typeof parsed.goodWind === "boolean"
          ? parsed.goodWind
          : DEFAULT_NOTIFICATION_PREFS.goodWind,
    };
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }
}

let cachedRaw: string | null = null;
let cachedPrefs: NotificationPrefs = DEFAULT_NOTIFICATION_PREFS;

export function readNotificationPrefs(): NotificationPrefs {
  if (typeof window === "undefined") return DEFAULT_NOTIFICATION_PREFS;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
  } catch {
    return DEFAULT_NOTIFICATION_PREFS;
  }

  if (raw === cachedRaw) return cachedPrefs;

  cachedRaw = raw;
  cachedPrefs = parsePrefs(raw);
  return cachedPrefs;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

export function setNotificationPrefs(next: NotificationPrefs): void {
  const serialized = JSON.stringify(next);
  cachedRaw = serialized;
  cachedPrefs = next;

  try {
    window.localStorage.setItem(PREFS_STORAGE_KEY, serialized);
  } catch {
    // Ignore write failures.
  }

  notifyListeners();
}

// Merge against the latest stored value so toggling one alert type can't clobber
// the other from a stale render closure.
export function setNotificationPref(
  key: keyof NotificationPrefs,
  value: boolean,
): void {
  setNotificationPrefs({ ...readNotificationPrefs(), [key]: value });
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key !== PREFS_STORAGE_KEY && event.key !== null) return;
    cachedRaw = null;
    notifyListeners();
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function getSnapshot(): NotificationPrefs {
  return readNotificationPrefs();
}

function getServerSnapshot(): NotificationPrefs {
  return DEFAULT_NOTIFICATION_PREFS;
}

export function useNotificationPrefs(): NotificationPrefs {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}

// --- Delivery + per-day dedupe ---------------------------------------------

function todayKey(): string {
  return new Date().toISOString().slice(0, 10);
}

function readDedupe(): Record<string, string> {
  try {
    const raw = window.localStorage.getItem(DEDUPE_STORAGE_KEY);
    if (!raw) return {};
    const parsed = JSON.parse(raw) as unknown;
    return parsed && typeof parsed === "object"
      ? (parsed as Record<string, string>)
      : {};
  } catch {
    return {};
  }
}

function alreadyNotifiedToday(key: string): boolean {
  return readDedupe()[key] === todayKey();
}

function markNotifiedToday(key: string): void {
  try {
    const map = readDedupe();
    const today = todayKey();
    // Drop stale entries so this map can't grow forever.
    const pruned: Record<string, string> = { [key]: today };
    for (const [entryKey, value] of Object.entries(map)) {
      if (value === today) pruned[entryKey] = value;
    }
    window.localStorage.setItem(DEDUPE_STORAGE_KEY, JSON.stringify(pruned));
  } catch {
    // Ignore write failures; worst case an alert can repeat.
  }
}

type FireOptions = { force?: boolean };

// Show a notification if permitted and (unless forced) not already shown today
// for this key. Prefers the service worker's showNotification (required on many
// mobile browsers), falling back to the page-level Notification constructor.
export async function fireNotification(
  key: string,
  title: string,
  body: string,
  options: FireOptions = {},
): Promise<boolean> {
  if (getNotificationPermission() !== "granted") return false;
  if (!options.force && alreadyNotifiedToday(key)) return false;

  const notificationOptions: NotificationOptions & { tag?: string } = {
    body,
    icon: "/icons/icon-192.png",
    badge: "/icons/icon-192.png",
    tag: key,
  };

  try {
    if ("serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.getRegistration();
      if (registration) {
        await registration.showNotification(title, notificationOptions);
        if (!options.force) markNotifiedToday(key);
        return true;
      }
    }

    new Notification(title, notificationOptions);
    if (!options.force) markNotifiedToday(key);
    return true;
  } catch {
    return false;
  }
}

export function sendTestNotification(): Promise<boolean> {
  return fireNotification(
    "test",
    "Deer Intel",
    "Notifications are on. You'll get alerts like this when you open Deer Intel and conditions line up.",
    { force: true },
  );
}

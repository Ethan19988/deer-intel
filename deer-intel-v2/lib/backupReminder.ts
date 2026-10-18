"use client";

import { useSyncExternalStore } from "react";
import type { DeerIntelState } from "@/types/deerIntelStore";

// When the hunter last downloaded a backup, and how many records it held — the
// pair the dashboard nudge compares against to know if it's time to back up
// again. Device-local (its own key, like the theme/units/map prefs); a backup's
// own recency is a per-device fact, not something to sync or export.
const STORAGE_KEY = "deer-intel:last-backup";

// Don't nag a near-empty app; do nudge once it's been a while or a fair amount
// of new data has piled up since the last backup.
export const BACKUP_REMINDER_MIN_RECORDS = 5;
export const BACKUP_REMINDER_STALE_DAYS = 14;
export const BACKUP_REMINDER_NEW_RECORDS = 15;

export type LastBackup = { at: string; recordCount: number } | null;

export type BackupReminderReason = "never" | "stale" | "many-new";

export type BackupReminderStatus = {
  shouldRemind: boolean;
  reason: BackupReminderReason | null;
  daysSince: number | null;
  newRecords: number;
};

// The total saved records across every list — the same tally the Settings data
// tab shows. One home for it so the reminder and the settings summary agree.
export function countRecords(state: DeerIntelState): number {
  return (
    state.properties.length +
    state.cameras.length +
    state.cameraChecks.length +
    state.stands.length +
    state.pins.length +
    state.hunts.length +
    state.photoRecords.length +
    state.deerProfiles.length
  );
}

function parse(raw: string | null): LastBackup {
  if (!raw) return null;

  try {
    const parsed: unknown = JSON.parse(raw);
    if (
      parsed &&
      typeof parsed === "object" &&
      typeof (parsed as LastBackup & object).at === "string" &&
      typeof (parsed as { recordCount?: unknown }).recordCount === "number"
    ) {
      return parsed as { at: string; recordCount: number };
    }
  } catch {
    return null;
  }

  return null;
}

let cachedRaw: string | null = null;
let cachedValue: LastBackup = null;

export function readLastBackup(): LastBackup {
  if (typeof window === "undefined") return null;

  let raw: string | null;
  try {
    raw = window.localStorage.getItem(STORAGE_KEY);
  } catch {
    return null;
  }

  if (raw === cachedRaw) return cachedValue;

  cachedRaw = raw;
  cachedValue = parse(raw);
  return cachedValue;
}

const listeners = new Set<() => void>();

function notifyListeners() {
  listeners.forEach((listener) => listener());
}

// Record that a backup was just downloaded. Called from the export handlers, so
// downloading a backup clears the nudge until enough time or new data passes.
export function recordBackup(recordCount: number): void {
  const value = { at: new Date().toISOString(), recordCount };
  const raw = JSON.stringify(value);

  cachedRaw = raw;
  cachedValue = value;

  try {
    window.localStorage.setItem(STORAGE_KEY, raw);
  } catch {
    // Ignore write failures (private mode / quota); the cached value still
    // applies for this session.
  }

  notifyListeners();
}

function subscribe(listener: () => void) {
  listeners.add(listener);

  function handleStorage(event: StorageEvent) {
    if (event.key === null || event.key === STORAGE_KEY) {
      cachedRaw = null;
      notifyListeners();
    }
  }

  window.addEventListener("storage", handleStorage);

  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

export function useLastBackup(): LastBackup {
  return useSyncExternalStore(subscribe, readLastBackup, () => null);
}

// Pure and testable — the caller passes `nowMs` so there's no clock read here.
export function backupReminderStatus(input: {
  lastBackup: LastBackup;
  currentRecordCount: number;
  nowMs: number;
}): BackupReminderStatus {
  const { lastBackup, currentRecordCount, nowMs } = input;

  // Nothing worth nagging about on a near-empty app.
  if (currentRecordCount < BACKUP_REMINDER_MIN_RECORDS) {
    return { shouldRemind: false, reason: null, daysSince: null, newRecords: 0 };
  }

  if (!lastBackup) {
    return {
      shouldRemind: true,
      reason: "never",
      daysSince: null,
      newRecords: currentRecordCount,
    };
  }

  const lastMs = Date.parse(lastBackup.at);
  const daysSince = Number.isNaN(lastMs)
    ? null
    : Math.floor((nowMs - lastMs) / 86_400_000);
  const newRecords = Math.max(0, currentRecordCount - lastBackup.recordCount);

  if (daysSince !== null && daysSince >= BACKUP_REMINDER_STALE_DAYS) {
    return { shouldRemind: true, reason: "stale", daysSince, newRecords };
  }

  if (newRecords >= BACKUP_REMINDER_NEW_RECORDS) {
    return { shouldRemind: true, reason: "many-new", daysSince, newRecords };
  }

  return { shouldRemind: false, reason: null, daysSince, newRecords };
}

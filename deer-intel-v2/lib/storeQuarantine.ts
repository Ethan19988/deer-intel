"use client";

import { useSyncExternalStore } from "react";
import { readStorageValue, writeStorageValue } from "@/lib/storage";

// Safety nets for the local store so a bad record or a damaged save is set
// aside instead of silently disappearing:
//
//  - Quarantine: a record the store can't read (a required field missing or
//    malformed) is copied here before it is left out of the state. Without
//    this, the next save writes the filtered list back and cloud sync spreads
//    the "deletion" to every device.
//  - Corrupt store: when the whole saved state can't be parsed, the raw text
//    is copied to its own key before anything can overwrite it.
//
// Both are surfaced in the UI with a download button so the hunter (or
// support) can recover the data by hand.

export const QUARANTINE_STORAGE_KEY = "deer-intel:quarantine";
export const QUARANTINE_LIMIT = 200;
export const CORRUPT_STATE_KEY_PREFIX = "deer-intel:state.corrupt-";
const CORRUPT_INDEX_KEY = "deer-intel:corrupt-state-index";

export type QuarantineEntry = {
  // Which list in the store the record came from (e.g. "pins").
  collection: string;
  record: unknown;
  // ISO time it was set aside.
  at: string;
};

export type RejectedRecord = { collection: string; record: unknown };

const listeners = new Set<() => void>();

function notify() {
  // Quarantine and corrupt-store writes can happen while the store is read
  // during a render; defer so subscribers never update mid-render.
  const run = () => listeners.forEach((listener) => listener());
  if (typeof queueMicrotask === "function") queueMicrotask(run);
  else run();
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function safeStringify(value: unknown): string {
  try {
    return JSON.stringify(value) ?? "null";
  } catch {
    return String(value);
  }
}

// --- Quarantine ---------------------------------------------------------------

function parseQuarantine(raw: string | null): QuarantineEntry[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (entry): entry is QuarantineEntry =>
        typeof entry === "object" &&
        entry !== null &&
        typeof (entry as QuarantineEntry).collection === "string" &&
        typeof (entry as QuarantineEntry).at === "string",
    );
  } catch {
    return [];
  }
}

let cachedQuarantine: { raw: string | null; entries: QuarantineEntry[] } | null =
  null;

/** Records set aside because they couldn't be read (oldest first). */
export function readQuarantine(): QuarantineEntry[] {
  const raw = readStorageValue(QUARANTINE_STORAGE_KEY);
  if (cachedQuarantine?.raw === raw) return cachedQuarantine.entries;
  const entries = parseQuarantine(raw);
  cachedQuarantine = { raw, entries };
  return entries;
}

/**
 * Pure merge of newly rejected records into the existing quarantine: the
 * same record from the same list is only kept once (the store is re-read on
 * every reload until the next save), and only the newest `limit` are kept.
 */
export function appendQuarantineEntries(
  existing: QuarantineEntry[],
  rejected: RejectedRecord[],
  at: string,
  limit = QUARANTINE_LIMIT,
): QuarantineEntry[] {
  const seen = new Set(
    existing.map((entry) => `${entry.collection}\u0000${safeStringify(entry.record)}`),
  );
  const next = [...existing];

  for (const { collection, record } of rejected) {
    const key = `${collection}\u0000${safeStringify(record)}`;
    if (seen.has(key)) continue;
    seen.add(key);
    next.push({ collection, record, at });
  }

  return next.length > limit ? next.slice(next.length - limit) : next;
}

/** Set rejected records aside. Best-effort: a full device drops the oldest. */
export function quarantineRecords(rejected: RejectedRecord[]): void {
  if (rejected.length === 0) return;

  const existing = readQuarantine();
  let next = appendQuarantineEntries(existing, rejected, new Date().toISOString());
  if (next.length === existing.length) return;

  // Storage full: keep halving the oldest end until it fits (or give up).
  while (next.length > 0) {
    if (writeStorageValue(QUARANTINE_STORAGE_KEY, JSON.stringify(next))) {
      notify();
      return;
    }
    if (next.length === 1) return;
    next = next.slice(Math.ceil(next.length / 2));
  }
}

export function clearQuarantine(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(QUARANTINE_STORAGE_KEY);
  } catch {
    // Ignore.
  }
  notify();
}

export function useQuarantine(): QuarantineEntry[] {
  return useSyncExternalStore(subscribe, readQuarantine, () => EMPTY_ENTRIES);
}

const EMPTY_ENTRIES: QuarantineEntry[] = [];

// --- Corrupt store ------------------------------------------------------------

export type CorruptStoreBackup = {
  // localStorage key holding the copy ("" when the copy couldn't be written).
  key: string;
  // Fingerprint of the raw text, so the same damaged value is copied once.
  hash: string;
  at: string;
  dismissed?: boolean;
};

/** Short fingerprint of a raw string (FNV-1a, 32-bit, plus length). */
export function fingerprint(text: string): string {
  let hash = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }
  return `${(hash >>> 0).toString(36)}.${text.length.toString(36)}`;
}

function readCorruptIndex(): CorruptStoreBackup[] {
  const raw = readStorageValue(CORRUPT_INDEX_KEY);
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter(
          (entry): entry is CorruptStoreBackup =>
            typeof entry === "object" &&
            entry !== null &&
            typeof (entry as CorruptStoreBackup).hash === "string" &&
            typeof (entry as CorruptStoreBackup).key === "string",
        )
      : [];
  } catch {
    return [];
  }
}

function writeCorruptIndex(entries: CorruptStoreBackup[]): boolean {
  return writeStorageValue(CORRUPT_INDEX_KEY, JSON.stringify(entries.slice(-20)));
}

// The damaged text whose copy couldn't be written (device storage full). The
// store won't overwrite it until the hunter has downloaded it or said to go on.
let unsavedCorruptRaw: string | null = null;
let unsavedCorruptInfo: CorruptStoreBackup | null = null;

/**
 * Copy a saved state that couldn't be read to its own key before anything can
 * overwrite it. Runs once per distinct raw value. Returns true when the raw
 * text is safe (copied now or earlier); false when the copy failed, in which
 * case the store must not overwrite the original yet.
 */
export function backupCorruptState(raw: string, now = new Date()): boolean {
  const hash = fingerprint(raw);
  const index = readCorruptIndex();
  const existing = index.find((entry) => entry.hash === hash);

  if (existing?.key && readStorageValue(existing.key) === raw) return true;

  const at = now.toISOString();
  const key = `${CORRUPT_STATE_KEY_PREFIX}${now.getTime()}`;
  const copied = writeStorageValue(key, raw);
  const rest = index.filter((entry) => entry.hash !== hash);

  const entry: CorruptStoreBackup = { key: copied ? key : "", hash, at };
  writeCorruptIndex([...rest, entry]);
  unsavedCorruptRaw = copied ? null : raw;
  unsavedCorruptInfo = copied ? null : entry;
  cachedCorruptNotice = undefined;
  notify();

  return copied;
}

/** True while a damaged save couldn't be copied and must not be overwritten. */
export function isCorruptStateUnsaved(readRaw: () => string | null): boolean {
  // Only read the (possibly large) saved value when a copy is outstanding.
  return unsavedCorruptRaw !== null && readRaw() === unsavedCorruptRaw;
}

/** The hunter downloaded (or chose to drop) the damaged save it couldn't copy. */
export function releaseUnsavedCorruptState(): void {
  unsavedCorruptRaw = null;
  unsavedCorruptInfo = null;
  cachedCorruptNotice = undefined;
  notify();
}

export type CorruptStoreNotice = CorruptStoreBackup & {
  // True when the copy only lives in memory (download it before reloading).
  unsaved: boolean;
};

let cachedCorruptNotice: CorruptStoreNotice | null | undefined;

function readCorruptNotice(): CorruptStoreNotice | null {
  if (cachedCorruptNotice !== undefined) return cachedCorruptNotice;
  // A copy that couldn't be written comes first (even if the index write
  // failed too): nothing saves until it's downloaded.
  if (unsavedCorruptInfo) {
    cachedCorruptNotice = { ...unsavedCorruptInfo, unsaved: true };
    return cachedCorruptNotice;
  }
  const latest = [...readCorruptIndex()].reverse().find((entry) => !entry.dismissed);
  cachedCorruptNotice = latest
    ? { ...latest, unsaved: false }
    : null;
  return cachedCorruptNotice;
}

/** The most recent damaged save that hasn't been dismissed, if any. */
export function useCorruptStoreNotice(): CorruptStoreNotice | null {
  return useSyncExternalStore(subscribe, readCorruptNotice, () => null);
}

/** The damaged save's raw text (from its copy, or memory when it couldn't be copied). */
export function readCorruptStateRaw(notice: CorruptStoreBackup): string | null {
  if (notice.key) return readStorageValue(notice.key);
  return unsavedCorruptRaw;
}

/** Hide the notice; the copy itself stays on the device. */
export function dismissCorruptStoreNotice(hash: string): void {
  const index = readCorruptIndex().map((entry) =>
    entry.hash === hash ? { ...entry, dismissed: true } : entry,
  );
  writeCorruptIndex(index);
  cachedCorruptNotice = undefined;
  notify();
}

/** Download text as a .json file (browser only). */
export function downloadTextFile(text: string, fileName: string): void {
  if (typeof document === "undefined") return;
  const url = URL.createObjectURL(new Blob([text], { type: "application/json" }));
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}
